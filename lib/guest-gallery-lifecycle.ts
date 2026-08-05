import { prisma } from "@/lib/prisma";
import { GALLERY_MODE_GUEST } from "@/lib/proofing";

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
