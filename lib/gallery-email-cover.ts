import { emailImageUrl } from "@/lib/email-image-url";
export { emailImageUrl } from "@/lib/email-image-url";
import { prisma } from "@/lib/prisma";
import { isProofingGallery, PROOFING_STATUS_DELIVERED } from "@/lib/proofing";

export type GalleryEmailCover = { url: string; width: number };


export async function loadGalleryEmailCover(galleryId: string, publicUrl: string, kind: "proofing" | "final"): Promise<GalleryEmailCover | null> {
  const gallery = await prisma.gallery.findUnique({
    where: { id: galleryId },
    select: { coverPhotoId: true, galleryMode: true, proofingStatus: true, deliveryMode: true, password: true, slug: true }
  });
  if (!gallery) return null;
  const deliveryStage = kind === "proofing" && isProofingGallery(gallery.galleryMode) && gallery.proofingStatus !== PROOFING_STATUS_DELIVERED ? "raw" : "final";
  const where = { galleryId, deliveryStage, isClientHidden: false, mediaType: "image", processingStatus: "ready" };
  const select = { id: true, previewUrl: true, thumbnailUrl: true, imageUrl: true, imageWidth: true, imageHeight: true };
  const selected = gallery.coverPhotoId ? await prisma.photo.findFirst({ where: { ...where, id: gallery.coverPhotoId }, select }) : null;
  const photo = selected ?? await prisma.photo.findFirst({ where, select, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  if (!photo) return null;
  // Keep the existing paid-gallery protection. Password-protected paid previews
  // cannot load in email clients, so those messages keep their text-only layout.
  if (gallery.deliveryMode === "paid") {
    if (gallery.password) return null;
    return { url: new URL(`/g/${gallery.slug}/watermark/${photo.id}?v=6`, publicUrl).toString(), width: 560 };
  }
  const url = [photo.previewUrl, photo.thumbnailUrl]
    .filter(value => value && value !== photo.imageUrl)
    .map(value => emailImageUrl(value, publicUrl))
    .find(Boolean);
  if (!url) return null;
  // Show the complete photo; cap portrait images without relying on object-fit,
  // which some email clients do not support.
  const width = photo.imageWidth > 0 && photo.imageHeight > 0
    ? Math.max(1, Math.min(560, Math.round(420 * photo.imageWidth / photo.imageHeight)))
    : 560;
  return { url, width };
}
