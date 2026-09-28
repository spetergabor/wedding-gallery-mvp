export const ALBUM_REVIEW_TITLE_SUFFIX = "Fotobuch-Vorschau";

export function createAlbumReviewTitle(baseTitle?: string | null) {
  const normalizedBase = (baseTitle ?? "")
    .trim()
    .replace(/\s*(?:[–—-]\s*)?(?:ellenőrző|Fotobuch(?:-|\s)?Vorschau)$/iu, "")
    .trim();

  return normalizedBase ? `${normalizedBase} – ${ALBUM_REVIEW_TITLE_SUFFIX}` : ALBUM_REVIEW_TITLE_SUFFIX;
}
