import { invalidateGuestGalleryDownloadPackages } from "@/lib/download-packages";
import { prisma } from "@/lib/prisma";
import { GALLERY_MODE_GUEST } from "@/lib/proofing";
import { deletePhotoObject, getR2KeyFromPublicUrl } from "@/lib/storage";

export const CUSTOMER_GUEST_TRASH_RETENTION_DAYS = 30;

export async function archiveExpiredGuestGalleries(now = new Date()) {
  const result = await prisma.gallery.updateMany({
    where: {
      galleryMode: GALLERY_MODE_GUEST,
      guestGalleryArchivedAt: null,
      guestGalleryExpiresAt: { lte: now }
    },
    data: {
      isActive: false,
      guestUploadsEnabled: false,
      guestGalleryArchivedAt: now
    }
  });

  return { archived: result.count };
}

export async function cleanupExpiredCustomerGuestTrash(now = new Date(), limit = 500) {
  const cutoff = new Date(now.getTime() - CUSTOMER_GUEST_TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const uploads = await prisma.galleryGuestUpload.findMany({
    where: { customerDeletedAt: { lte: cutoff } },
    orderBy: [{ customerDeletedAt: "asc" }, { id: "asc" }],
    take: Math.max(1, Math.min(1000, limit)),
    select: {
      id: true,
      galleryId: true,
      r2Key: true,
      imageUrl: true,
      thumbnailUrl: true,
      previewUrl: true
    }
  });

  if (uploads.length === 0) {
    return { deleted: 0, galleries: 0 };
  }

  const idsByGallery = new Map<string, string[]>();
  uploads.forEach((upload) => {
    const ids = idsByGallery.get(upload.galleryId) ?? [];
    ids.push(upload.id);
    idsByGallery.set(upload.galleryId, ids);
  });

  await prisma.$transaction(async (transaction) => {
    await transaction.galleryGuestUpload.deleteMany({
      where: { id: { in: uploads.map((upload) => upload.id) }, customerDeletedAt: { lte: cutoff } }
    });

    for (const [galleryId, photoIds] of idsByGallery) {
      await transaction.guestGalleryAuditLog.create({
        data: {
          galleryId,
          actorType: "system",
          actorLabel: "Automatikus lomtárürítés",
          action: "trash_auto_delete",
          photoCount: photoIds.length,
          photoIds,
          metadata: { retentionDays: CUSTOMER_GUEST_TRASH_RETENTION_DAYS }
        }
      });
      await transaction.gallery.update({
        where: { id: galleryId },
        data: { guestGalleryRevision: { increment: 1 } }
      });
    }
  });

  for (const galleryId of idsByGallery.keys()) {
    await invalidateGuestGalleryDownloadPackages(galleryId);
  }

  const objectKeys = new Set(
    uploads.flatMap((upload) => [
      upload.r2Key,
      getR2KeyFromPublicUrl(upload.imageUrl),
      getR2KeyFromPublicUrl(upload.thumbnailUrl),
      getR2KeyFromPublicUrl(upload.previewUrl)
    ]).filter((key): key is string => Boolean(key))
  );
  const keys = [...objectKeys];

  for (let offset = 0; offset < keys.length; offset += 100) {
    await Promise.allSettled(keys.slice(offset, offset + 100).map((key) => deletePhotoObject(key)));
  }

  return { deleted: uploads.length, galleries: idsByGallery.size };
}

export function isGuestGalleryExpired(
  gallery: {
    galleryMode: string;
    guestGalleryExpiresAt: Date | null;
    guestGalleryArchivedAt: Date | null;
  },
  now = new Date()
) {
  return gallery.galleryMode === GALLERY_MODE_GUEST && (
    Boolean(gallery.guestGalleryArchivedAt) ||
    Boolean(gallery.guestGalleryExpiresAt && gallery.guestGalleryExpiresAt <= now)
  );
}
