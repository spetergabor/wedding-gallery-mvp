"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { canViewGallery } from "@/lib/public-actions";
import { isAnyRateLimited } from "@/lib/rate-limit";
import {
  createGuestPhotoObjectKey,
  createPresignedPhotoUploadUrl,
  getPhotoPublicUrl
} from "@/lib/storage";

const MAX_GUEST_UPLOADS_PER_BATCH = 20;
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

function normalizeEmail(email: string | null | undefined) {
  return (email ?? "").trim().toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeFilename(filename: string) {
  return filename.trim().slice(0, 180) || "guest-photo.jpg";
}

function normalizeDimension(value: number | undefined) {
  return Number.isFinite(value) && value && value > 0 ? Math.round(value) : 0;
}

export async function createGuestUploadTargetsAction(
  galleryId: string,
  email: string,
  uploads: GuestUploadInput[]
): Promise<{ ok: boolean; message?: string; targets?: GuestUploadTarget[] }> {
  const normalizedEmail = normalizeEmail(email);

  if (!isValidEmail(normalizedEmail)) {
    return { ok: false, message: "Adj meg egy érvényes email címet a feltöltéshez." };
  }

  if (uploads.length === 0 || uploads.length > MAX_GUEST_UPLOADS_PER_BATCH) {
    return { ok: false, message: `Egyszerre legfeljebb ${MAX_GUEST_UPLOADS_PER_BATCH} képet tölthetsz fel.` };
  }

  if (
    await isAnyRateLimited([
      { scope: "guest-upload:prepare", limit: 8, windowSeconds: 10 * 60, identifier: `${galleryId}:${normalizedEmail}` },
      { scope: "guest-upload:prepare-hour", limit: 24, windowSeconds: 60 * 60, identifier: `${galleryId}:${normalizedEmail}` }
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
      guestUploadsEnabled: true
    }
  });

  if (!gallery || !gallery.isActive || !gallery.guestUploadsEnabled) {
    return { ok: false, message: "Ebben a galériában a vendégfotó feltöltés nem aktív." };
  }

  if (!(await canViewGallery(gallery.slug, gallery.password))) {
    return { ok: false, message: "A feltöltéshez előbb nyisd meg a galériát a PIN-kóddal." };
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
          email: normalizedEmail,
          filename,
          r2Key,
          imageUrl: getPhotoPublicUrl(r2Key),
          thumbnailUrl: getPhotoPublicUrl(r2Key),
          previewUrl: getPhotoPublicUrl(r2Key),
          mediaType: "image",
          fileSize: Math.round(upload.fileSize),
          imageWidth: normalizeDimension(upload.imageWidth),
          imageHeight: normalizeDimension(upload.imageHeight),
          status: "pending"
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
  email: string,
  r2Keys: string[]
): Promise<{ ok: boolean; message?: string; completedCount?: number }> {
  const normalizedEmail = normalizeEmail(email);
  const uniqueKeys = Array.from(new Set(r2Keys.map((key) => key.trim()).filter(Boolean))).slice(0, MAX_GUEST_UPLOADS_PER_BATCH);

  if (!isValidEmail(normalizedEmail) || uniqueKeys.length === 0) {
    return { ok: false, message: "A feltöltés lezárásához email és legalább egy kép szükséges." };
  }

  const gallery = await prisma.gallery.findUnique({
    where: { id: galleryId },
    select: {
      id: true,
      slug: true,
      password: true,
      isActive: true,
      guestUploadsEnabled: true
    }
  });

  if (!gallery || !gallery.isActive || !gallery.guestUploadsEnabled) {
    return { ok: false, message: "Ebben a galériában a vendégfotó feltöltés nem aktív." };
  }

  if (!(await canViewGallery(gallery.slug, gallery.password))) {
    return { ok: false, message: "A feltöltéshez előbb nyisd meg a galériát a PIN-kóddal." };
  }

  const result = await prisma.galleryGuestUpload.updateMany({
    where: {
      galleryId,
      email: normalizedEmail,
      r2Key: { in: uniqueKeys },
      status: "pending"
    },
    data: {
      status: "visible"
    }
  });

  revalidatePath(`/g/${gallery.slug}`);

  return {
    ok: true,
    completedCount: result.count
  };
}
