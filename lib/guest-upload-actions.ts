"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { invalidateGuestGalleryDownloadPackages } from "@/lib/download-packages";
import { kickGalleryMediaProcessing } from "@/lib/media-processing";
import { prisma } from "@/lib/prisma";
import { canViewGallery } from "@/lib/public-actions";
import { isAnyRateLimited } from "@/lib/rate-limit";
import {
  createGuestPhotoObjectKey,
  createPresignedPhotoUploadUrl,
  getPhotoPublicUrl
} from "@/lib/storage";

const MAX_GUEST_UPLOADS_PER_BATCH = 20;
const MAX_GUEST_UPLOADS_PER_GUEST = 200;
const MAX_GUEST_UPLOAD_BYTES = 25 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

type GuestUploadInput = {
  clientId: string;
  filename: string;
  contentType: string;
  fileSize: number;
  imageWidth?: number;
  imageHeight?: number;
};

type GuestUploadTarget = {
  clientId: string;
  filename: string;
  r2Key: string;
  uploadUrl: string;
};

type GuestIdentityInput = {
  guestKey: string;
  name?: string;
  email?: string;
};

function normalizeEmail(email: string | null | undefined) {
  return (email ?? "").trim().toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeGuestKey(value: string | null | undefined) {
  const key = (value ?? "").trim();
  return /^[a-zA-Z0-9_-]{16,100}$/.test(key) ? key : "";
}

function normalizeGuestName(value: string | null | undefined) {
  return (value ?? "").trim().slice(0, 80);
}

function normalizeFilename(filename: string) {
  return filename.trim().slice(0, 180) || "guest-photo.jpg";
}

function normalizeDimension(value: number | undefined) {
  return Number.isFinite(value) && value && value > 0 ? Math.round(value) : 0;
}

export async function createGuestUploadTargetsAction(
  galleryId: string,
  identity: GuestIdentityInput,
  uploads: GuestUploadInput[]
): Promise<{ ok: boolean; message?: string; targets?: GuestUploadTarget[] }> {
  const guestKey = normalizeGuestKey(identity.guestKey);
  const guestName = normalizeGuestName(identity.name);
  const normalizedEmail = normalizeEmail(identity.email);

  if (!guestKey) {
    return { ok: false, message: "A vendégmunkamenet nem érvényes. Frissítsd az oldalt, és próbáld újra." };
  }

  if (normalizedEmail && !isValidEmail(normalizedEmail)) {
    return { ok: false, message: "Az email cím formátuma nem megfelelő." };
  }

  if (uploads.length === 0 || uploads.length > MAX_GUEST_UPLOADS_PER_BATCH) {
    return { ok: false, message: `Egyszerre legfeljebb ${MAX_GUEST_UPLOADS_PER_BATCH} képet tölthetsz fel.` };
  }

  if (
    await isAnyRateLimited([
      { scope: "guest-upload:prepare", limit: 8, windowSeconds: 10 * 60, identifier: `${galleryId}:${guestKey}` },
      { scope: "guest-upload:prepare-hour", limit: 24, windowSeconds: 60 * 60, identifier: `${galleryId}:${guestKey}` }
    ])
  ) {
    return { ok: false, message: "Túl sok feltöltési próbálkozás történt. Próbáld újra kicsit később." };
  }

  const gallery = await prisma.gallery.findUnique({
    where: { id: galleryId },
    select: {
      id: true,
      slug: true,
      password: true,
      isActive: true,
      guestUploadsEnabled: true,
      guestUploadLimit: true,
      guestGalleryExpiresAt: true,
      guestGalleryArchivedAt: true
    }
  });

  if (
    !gallery ||
    !gallery.isActive ||
    !gallery.guestUploadsEnabled ||
    gallery.guestGalleryArchivedAt ||
    (gallery.guestGalleryExpiresAt && gallery.guestGalleryExpiresAt <= new Date())
  ) {
    return { ok: false, message: "Ebben a galériában a vendégfotó feltöltés nem aktív." };
  }

  if (!(await canViewGallery(gallery.slug, gallery.password))) {
    return { ok: false, message: "A feltöltéshez előbb nyisd meg a galériát a PIN-kóddal." };
  }

  const [galleryUploadCount, guestUploadCount] = await Promise.all([
    prisma.galleryGuestUpload.count({ where: { galleryId: gallery.id } }),
    prisma.galleryGuestUpload.count({ where: { galleryId: gallery.id, guestKey } })
  ]);

  if (galleryUploadCount + uploads.length > gallery.guestUploadLimit) {
    return { ok: false, message: "A vendéggaléria elérte a beállított képlimitet." };
  }

  if (guestUploadCount + uploads.length > MAX_GUEST_UPLOADS_PER_GUEST) {
    return { ok: false, message: `Egy vendég legfeljebb ${MAX_GUEST_UPLOADS_PER_GUEST} képet tölthet fel.` };
  }

  for (const upload of uploads) {
    if (!upload.clientId || !upload.filename) {
      return { ok: false, message: "Hiányos feltöltési adat." };
    }

    if (!ALLOWED_IMAGE_TYPES.has(upload.contentType)) {
      return { ok: false, message: "Csak JPG, PNG, WebP, HEIC vagy HEIF képek tölthetők fel." };
    }

    if (!Number.isFinite(upload.fileSize) || upload.fileSize <= 0 || upload.fileSize > MAX_GUEST_UPLOAD_BYTES) {
      return { ok: false, message: "Egy kép legfeljebb 25 MB lehet." };
    }
  }

  const targets = await Promise.all(
    uploads.map(async (upload) => {
      const filename = normalizeFilename(upload.filename);
      const r2Key = createGuestPhotoObjectKey({
        gallerySlug: gallery.slug,
        originalFilename: filename
      });
      const uploadUrl = await createPresignedPhotoUploadUrl({
        r2Key,
        contentType: upload.contentType
      });

      await prisma.galleryGuestUpload.create({
        data: {
          galleryId: gallery.id,
          email: normalizedEmail || null,
          guestName: guestName || null,
          guestKey,
          filename,
          r2Key,
          imageUrl: getPhotoPublicUrl(r2Key),
          thumbnailUrl: getPhotoPublicUrl(r2Key),
          previewUrl: getPhotoPublicUrl(r2Key),
          mediaType: "image",
          fileSize: Math.round(upload.fileSize),
          imageWidth: normalizeDimension(upload.imageWidth),
          imageHeight: normalizeDimension(upload.imageHeight),
          status: "pending",
          processingStatus: "uploading"
        }
      });

      return {
        clientId: upload.clientId,
        filename,
        r2Key,
        uploadUrl
      };
    })
  );

  return { ok: true, targets };
}

export async function completeGuestUploadsAction(
  galleryId: string,
  identity: GuestIdentityInput,
  r2Keys: string[]
): Promise<{ ok: boolean; message?: string; completedCount?: number; awaitingApproval?: boolean }> {
  const guestKey = normalizeGuestKey(identity.guestKey);
  const uniqueKeys = Array.from(new Set(r2Keys.map((key) => key.trim()).filter(Boolean))).slice(0, MAX_GUEST_UPLOADS_PER_BATCH);

  if (!guestKey || uniqueKeys.length === 0) {
    return { ok: false, message: "A feltöltés lezárásához legalább egy kép szükséges." };
  }

  const gallery = await prisma.gallery.findUnique({
    where: { id: galleryId },
    select: {
      id: true,
      slug: true,
      password: true,
      isActive: true,
      guestUploadsEnabled: true,
      guestUploadModerationMode: true,
      guestGalleryExpiresAt: true,
      guestGalleryArchivedAt: true
    }
  });

  if (
    !gallery ||
    !gallery.isActive ||
    !gallery.guestUploadsEnabled ||
    gallery.guestGalleryArchivedAt ||
    (gallery.guestGalleryExpiresAt && gallery.guestGalleryExpiresAt <= new Date())
  ) {
    return { ok: false, message: "Ebben a galériában a vendégfotó feltöltés nem aktív." };
  }

  if (!(await canViewGallery(gallery.slug, gallery.password))) {
    return { ok: false, message: "A feltöltéshez előbb nyisd meg a galériát a PIN-kóddal." };
  }

  const uploads = await prisma.galleryGuestUpload.findMany({
    where: {
      galleryId,
      guestKey,
      r2Key: { in: uniqueKeys },
      status: "pending"
    },
    select: {
      id: true,
      r2Key: true
    }
  });

  if (uploads.length === 0) {
    return { ok: false, message: "Nem található lezárható vendégfeltöltés." };
  }

  const awaitingApproval = gallery.guestUploadModerationMode === "approval";
  const requestedAt = new Date();

  await prisma.$transaction([
    prisma.galleryGuestUpload.updateMany({
      where: { id: { in: uploads.map((upload) => upload.id) } },
      data: {
        status: awaitingApproval ? "pending_review" : "visible",
        processingStatus: "pending",
        processingError: null,
        processingRequestedAt: requestedAt,
        processingCompletedAt: null
      }
    }),
    prisma.mediaProcessingJob.createMany({
      data: uploads.map((upload) => ({
        galleryId: gallery.id,
        photoId: null,
        guestUploadId: upload.id,
        mediaType: "image",
        status: "pending",
        sourceR2Key: upload.r2Key
      }))
    }),
    prisma.gallery.update({
      where: { id: gallery.id },
      data: { guestGalleryRevision: { increment: 1 } }
    })
  ]);
  await invalidateGuestGalleryDownloadPackages(gallery.id);

  revalidatePath(`/g/${gallery.slug}`);
  revalidatePath(`/admin/guest-galleries/${gallery.id}`);

  try {
    after(async () => {
      await kickGalleryMediaProcessing({ galleryId: gallery.id });
    });
  } catch {
    void kickGalleryMediaProcessing({ galleryId: gallery.id });
  }

  return {
    ok: true,
    completedCount: uploads.length,
    awaitingApproval
  };
}

export async function getGuestGalleryPhotosAction(galleryId: string, knownRevision?: number) {
  const gallery = await prisma.gallery.findUnique({
    where: { id: galleryId },
    select: {
      id: true,
      slug: true,
      password: true,
      isActive: true,
      guestGalleryExpiresAt: true,
      guestGalleryArchivedAt: true,
      guestGalleryRevision: true
    }
  });

  if (
    !gallery?.isActive ||
    gallery.guestGalleryArchivedAt ||
    (gallery.guestGalleryExpiresAt && gallery.guestGalleryExpiresAt <= new Date()) ||
    !(await canViewGallery(gallery.slug, gallery.password))
  ) {
    return { ok: false as const, photos: [] };
  }

  if (Number.isInteger(knownRevision) && knownRevision === gallery.guestGalleryRevision) {
    return {
      ok: true as const,
      unchanged: true as const,
      revision: gallery.guestGalleryRevision,
      photos: []
    };
  }

  const photos = await prisma.galleryGuestUpload.findMany({
    where: {
      galleryId: gallery.id,
      status: "visible"
    },
    orderBy: { createdAt: "asc" },
    take: 5000,
    select: {
      id: true,
      filename: true,
      imageUrl: true,
      thumbnailUrl: true,
      previewUrl: true,
      imageWidth: true,
      imageHeight: true,
      guestName: true,
      processingStatus: true,
      createdAt: true
    }
  });

  return {
    ok: true as const,
    unchanged: false as const,
    revision: gallery.guestGalleryRevision,
    photos: photos.map((photo) => ({
      ...photo,
      createdAt: photo.createdAt.toISOString()
    }))
  };
}
