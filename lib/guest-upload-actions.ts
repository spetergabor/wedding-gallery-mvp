"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { Prisma } from "@prisma/client";
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
  contentHash: string;
  imageWidth?: number;
  imageHeight?: number;
};

type GuestUploadTarget = {
  clientId: string;
  filename: string;
  r2Key: string;
  uploadUrl: string;
};

type GuestUploadDuplicate = {
  clientId: string;
  filename: string;
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

function normalizeContentHash(value: string | null | undefined) {
  const hash = (value ?? "").trim().toLowerCase();
  return /^[a-f0-9]{64}$/.test(hash) ? hash : "";
}

export async function createGuestUploadTargetsAction(
  galleryId: string,
  identity: GuestIdentityInput,
  uploads: GuestUploadInput[]
): Promise<{
  ok: boolean;
  message?: string;
  targets?: GuestUploadTarget[];
  duplicates?: GuestUploadDuplicate[];
}> {
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
      { scope: "guest-upload:prepare", limit: 30, windowSeconds: 10 * 60, identifier: `${galleryId}:${guestKey}` },
      { scope: "guest-upload:prepare-hour", limit: 80, windowSeconds: 60 * 60, identifier: `${galleryId}:${guestKey}` }
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

    if (!normalizeContentHash(upload.contentHash)) {
      return { ok: false, message: "A kép ellenőrzőösszege hiányzik vagy érvénytelen." };
    }
  }

  const normalizedUploads = uploads.map((upload) => ({
    ...upload,
    filename: normalizeFilename(upload.filename),
    contentHash: normalizeContentHash(upload.contentHash)
  }));
  const existingUploads = await prisma.galleryGuestUpload.findMany({
    where: {
      galleryId: gallery.id,
      contentHash: { in: normalizedUploads.map((upload) => upload.contentHash) }
    },
    select: {
      contentHash: true,
      filename: true,
      guestKey: true,
      r2Key: true,
      status: true
    }
  });
  const existingByHash = new Map(
    existingUploads
      .filter((upload): upload is typeof upload & { contentHash: string } => Boolean(upload.contentHash))
      .map((upload) => [upload.contentHash, upload])
  );
  const seenHashes = new Set<string>();
  const duplicates: GuestUploadDuplicate[] = [];
  const resumableUploads: Array<{ upload: (typeof normalizedUploads)[number]; r2Key: string }> = [];
  const newUploads: typeof normalizedUploads = [];

  for (const upload of normalizedUploads) {
    if (seenHashes.has(upload.contentHash)) {
      duplicates.push({ clientId: upload.clientId, filename: upload.filename });
      continue;
    }

    seenHashes.add(upload.contentHash);
    const existing = existingByHash.get(upload.contentHash);

    if (!existing) {
      newUploads.push(upload);
    } else if (existing.guestKey === guestKey && existing.status === "pending") {
      resumableUploads.push({ upload, r2Key: existing.r2Key });
    } else {
      duplicates.push({ clientId: upload.clientId, filename: upload.filename });
    }
  }

  const [galleryUploadCount, guestUploadCount] = await Promise.all([
    prisma.galleryGuestUpload.count({ where: { galleryId: gallery.id } }),
    prisma.galleryGuestUpload.count({ where: { galleryId: gallery.id, guestKey } })
  ]);

  if (galleryUploadCount + newUploads.length > gallery.guestUploadLimit) {
    return { ok: false, message: "A vendéggaléria elérte a beállított képlimitet." };
  }

  if (guestUploadCount + newUploads.length > MAX_GUEST_UPLOADS_PER_GUEST) {
    return { ok: false, message: `Egy vendég legfeljebb ${MAX_GUEST_UPLOADS_PER_GUEST} képet tölthet fel.` };
  }

  const targets: GuestUploadTarget[] = [];

  for (const resumable of resumableUploads) {
    const uploadUrl = await createPresignedPhotoUploadUrl({
      r2Key: resumable.r2Key,
      contentType: resumable.upload.contentType
    });
    targets.push({
      clientId: resumable.upload.clientId,
      filename: resumable.upload.filename,
      r2Key: resumable.r2Key,
      uploadUrl
    });
  }

  for (const upload of newUploads) {
    try {
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
          contentHash: upload.contentHash,
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

      targets.push({
        clientId: upload.clientId,
        filename,
        r2Key,
        uploadUrl
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
        throw error;
      }

      const existing = await prisma.galleryGuestUpload.findUnique({
        where: {
          galleryId_contentHash: {
            galleryId: gallery.id,
            contentHash: upload.contentHash
          }
        },
        select: { guestKey: true, r2Key: true, status: true }
      });

      if (existing?.guestKey === guestKey && existing.status === "pending") {
        targets.push({
          clientId: upload.clientId,
          filename: upload.filename,
          r2Key: existing.r2Key,
          uploadUrl: await createPresignedPhotoUploadUrl({
            r2Key: existing.r2Key,
            contentType: upload.contentType
          })
        });
      } else {
        duplicates.push({ clientId: upload.clientId, filename: upload.filename });
      }
    }
  }

  return { ok: true, targets, duplicates };
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
        visibleAt: awaitingApproval ? null : requestedAt,
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

const GUEST_PHOTO_PAGE_SIZE = 48;

export type GuestPhotoCursor = {
  visibleAt: string;
  id: string;
};

function normalizePhotoCursor(cursor: GuestPhotoCursor | null | undefined) {
  if (!cursor?.id || cursor.id.length > 100) {
    return null;
  }

  const visibleAt = new Date(cursor.visibleAt);
  return Number.isNaN(visibleAt.getTime()) ? null : { visibleAt, id: cursor.id };
}

function serializeGuestPhoto(photo: {
  id: string;
  filename: string;
  imageUrl: string;
  thumbnailUrl: string;
  previewUrl: string;
  imageWidth: number;
  imageHeight: number;
  guestName: string | null;
  processingStatus: string;
  visibleAt: Date | null;
  createdAt: Date;
}) {
  return {
    ...photo,
    visibleAt: (photo.visibleAt ?? photo.createdAt).toISOString(),
    createdAt: photo.createdAt.toISOString()
  };
}

async function getAccessibleGuestGallery(galleryId: string) {
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
    return null;
  }

  return gallery;
}

export async function getGuestGalleryPhotosPageAction(
  galleryId: string,
  cursor?: GuestPhotoCursor | null
) {
  const gallery = await getAccessibleGuestGallery(galleryId);
  if (!gallery) {
    return { ok: false as const, photos: [], nextCursor: null, totalCount: 0 };
  }

  const normalizedCursor = normalizePhotoCursor(cursor);
  const [rows, totalCount] = await Promise.all([
    prisma.galleryGuestUpload.findMany({
      where: {
        galleryId: gallery.id,
        status: "visible",
        customerDeletedAt: null,
        visibleAt: { not: null },
        ...(normalizedCursor
          ? {
              OR: [
                { visibleAt: { gt: normalizedCursor.visibleAt } },
                { visibleAt: normalizedCursor.visibleAt, id: { gt: normalizedCursor.id } }
              ]
            }
          : {})
      },
      orderBy: [{ visibleAt: "asc" }, { id: "asc" }],
      take: GUEST_PHOTO_PAGE_SIZE + 1,
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
        visibleAt: true,
        createdAt: true
      }
    }),
    prisma.galleryGuestUpload.count({
      where: { galleryId: gallery.id, status: "visible", customerDeletedAt: null }
    })
  ]);
  const hasMore = rows.length > GUEST_PHOTO_PAGE_SIZE;
  const page = rows.slice(0, GUEST_PHOTO_PAGE_SIZE);
  const lastPhoto = page.at(-1);

  return {
    ok: true as const,
    photos: page.map(serializeGuestPhoto),
    nextCursor: hasMore && lastPhoto
      ? {
          visibleAt: (lastPhoto.visibleAt ?? lastPhoto.createdAt).toISOString(),
          id: lastPhoto.id
        }
      : null,
    totalCount
  };
}

export async function getGuestGalleryRevisionAction(galleryId: string, knownRevision: number) {
  const gallery = await getAccessibleGuestGallery(galleryId);
  if (!gallery) {
    return { ok: false as const, unchanged: true as const, revision: knownRevision };
  }

  return {
    ok: true as const,
    unchanged: Number.isInteger(knownRevision) && knownRevision === gallery.guestGalleryRevision,
    revision: gallery.guestGalleryRevision
  };
}

export async function getGuestGalleryPhotoUpdatesAction(
  galleryId: string,
  knownRevision: number,
  afterCursor: GuestPhotoCursor | null,
  loadedPhotoIds: string[]
) {
  const gallery = await getAccessibleGuestGallery(galleryId);
  if (!gallery) {
    return { ok: false as const, newPhotos: [], removedPhotoIds: [] };
  }

  if (Number.isInteger(knownRevision) && knownRevision === gallery.guestGalleryRevision) {
    return {
      ok: true as const,
      unchanged: true as const,
      revision: gallery.guestGalleryRevision,
      newPhotos: [],
      removedPhotoIds: []
    };
  }

  const normalizedCursor = normalizePhotoCursor(afterCursor);
  const uniqueLoadedIds = Array.from(new Set(loadedPhotoIds.map((id) => id.trim()).filter(Boolean))).slice(0, 5000);
  const [rows, totalCount, visibleLoadedRows] = await Promise.all([
    prisma.galleryGuestUpload.findMany({
      where: {
        galleryId: gallery.id,
        status: "visible",
        customerDeletedAt: null,
        visibleAt: { not: null },
        ...(normalizedCursor
          ? {
              OR: [
                { visibleAt: { gt: normalizedCursor.visibleAt } },
                { visibleAt: normalizedCursor.visibleAt, id: { gt: normalizedCursor.id } }
              ]
            }
          : {})
      },
      orderBy: [{ visibleAt: "asc" }, { id: "asc" }],
      take: GUEST_PHOTO_PAGE_SIZE + 1,
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
        visibleAt: true,
        createdAt: true
      }
    }),
    prisma.galleryGuestUpload.count({
      where: { galleryId: gallery.id, status: "visible", customerDeletedAt: null }
    }),
    uniqueLoadedIds.length > 0
      ? prisma.galleryGuestUpload.findMany({
          where: {
            galleryId: gallery.id,
            id: { in: uniqueLoadedIds },
            status: "visible",
            customerDeletedAt: null
          },
          select: { id: true }
        })
      : Promise.resolve([])
  ]);
  const hasMore = rows.length > GUEST_PHOTO_PAGE_SIZE;
  const newRows = rows.slice(0, GUEST_PHOTO_PAGE_SIZE);
  const lastPhoto = newRows.at(-1);
  const visibleLoadedIds = new Set(visibleLoadedRows.map((photo) => photo.id));

  return {
    ok: true as const,
    unchanged: false as const,
    revision: gallery.guestGalleryRevision,
    newPhotos: newRows.map(serializeGuestPhoto),
    removedPhotoIds: uniqueLoadedIds.filter((id) => !visibleLoadedIds.has(id)),
    nextLiveCursor: lastPhoto
      ? {
          visibleAt: (lastPhoto.visibleAt ?? lastPhoto.createdAt).toISOString(),
          id: lastPhoto.id
        }
      : afterCursor,
    hasMore,
    totalCount
  };
}
