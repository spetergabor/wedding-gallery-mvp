export const GALLERY_SECTION_MODE_ANCHOR = "anchor";
export const GALLERY_SECTION_MODE_SUBGALLERY = "subgallery";

export type GallerySectionDisplayMode =
  | typeof GALLERY_SECTION_MODE_ANCHOR
  | typeof GALLERY_SECTION_MODE_SUBGALLERY;

export function normalizeGallerySectionDisplayMode(value: string | null | undefined): GallerySectionDisplayMode {
  return value === GALLERY_SECTION_MODE_SUBGALLERY
    ? GALLERY_SECTION_MODE_SUBGALLERY
    : GALLERY_SECTION_MODE_ANCHOR;
}

export function gallerySectionDisplayModeLabel(value: string | null | undefined) {
  return normalizeGallerySectionDisplayMode(value) === GALLERY_SECTION_MODE_SUBGALLERY
    ? "Algaléria"
    : "Anchor blokk";
}
