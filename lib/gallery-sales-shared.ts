export const PAID_PURCHASE_SCOPE_PREFIX = "paid_purchase:";
export const PAID_GALLERY_SCOPE_PREFIX = "paid_gallery:";

export function paidPurchaseScope(purchaseId: string) {
  return `${PAID_PURCHASE_SCOPE_PREFIX}${purchaseId}`;
}

export function paidGalleryScope(galleryId: string) {
  return `${PAID_GALLERY_SCOPE_PREFIX}${galleryId}`;
}

export function isPaidPurchaseScope(scope: string | null | undefined) {
  return Boolean(scope?.startsWith(PAID_PURCHASE_SCOPE_PREFIX));
}

export function isPaidGalleryScope(scope: string | null | undefined) {
  return Boolean(scope?.startsWith(PAID_GALLERY_SCOPE_PREFIX));
}

export function isPaidDownloadScope(scope: string | null | undefined) {
  return isPaidPurchaseScope(scope) || isPaidGalleryScope(scope);
}

export function paidPurchaseIdFromScope(scope: string | null | undefined) {
  return isPaidPurchaseScope(scope) ? scope!.slice(PAID_PURCHASE_SCOPE_PREFIX.length) : null;
}
