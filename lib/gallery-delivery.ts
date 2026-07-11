export const GALLERY_DELIVERY_VIEW_ONLY = "view_only";
export const GALLERY_DELIVERY_FREE_DOWNLOAD = "free_download";
export const GALLERY_DELIVERY_PAID = "paid";

export type GalleryDeliveryMode =
  | typeof GALLERY_DELIVERY_VIEW_ONLY
  | typeof GALLERY_DELIVERY_FREE_DOWNLOAD
  | typeof GALLERY_DELIVERY_PAID;

export const GALLERY_DELIVERY_MODES = [
  GALLERY_DELIVERY_VIEW_ONLY,
  GALLERY_DELIVERY_FREE_DOWNLOAD,
  GALLERY_DELIVERY_PAID
] as const;

export function normalizeGalleryDeliveryMode(value: string | null | undefined): GalleryDeliveryMode {
  if (value === GALLERY_DELIVERY_VIEW_ONLY || value === GALLERY_DELIVERY_PAID) {
    return value;
  }

  return GALLERY_DELIVERY_FREE_DOWNLOAD;
}

export function galleryDeliveryAllowsDownloads(value: string | null | undefined) {
  return normalizeGalleryDeliveryMode(value) === GALLERY_DELIVERY_FREE_DOWNLOAD;
}

export function galleryDeliveryUsesPayment(value: string | null | undefined) {
  return normalizeGalleryDeliveryMode(value) === GALLERY_DELIVERY_PAID;
}

export function galleryDeliveryLabel(value: string | null | undefined) {
  const mode = normalizeGalleryDeliveryMode(value);

  if (mode === GALLERY_DELIVERY_VIEW_ONLY) {
    return "Csak megtekintés";
  }

  if (mode === GALLERY_DELIVERY_PAID) {
    return "Megvásárolható";
  }

  return "Ingyenesen letölthető";
}
