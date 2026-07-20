export const GALLERY_DESIGN_CLASSIC = "classic";
export const GALLERY_DESIGN_COVER_STICKY = "cover_sticky";

export type GalleryDesign = typeof GALLERY_DESIGN_CLASSIC | typeof GALLERY_DESIGN_COVER_STICKY;

export const GALLERY_DESIGNS: Array<{
  key: GalleryDesign;
  label: string;
  eyebrow: string;
  description: string;
}> = [
  {
    key: GALLERY_DESIGN_CLASSIC,
    label: "Spetly Classic",
    eyebrow: "Alap stílus",
    description:
      "A jelenlegi publikus galéria nézet: nagy borítókép, anchor blokkok, videók elöl, sticky navigáció és letöltési sáv."
  },
  {
    key: GALLERY_DESIGN_COVER_STICKY,
    label: "Cover + sticky sáv",
    eyebrow: "Minimál cover",
    description:
      "A borítókép alatt letisztult sáv jelenik meg: bal oldalt név, jobb oldalt megosztás és letöltés. Görgetéskor fent marad."
  }
];

export function normalizeGalleryDesign(value: unknown): GalleryDesign {
  return value === GALLERY_DESIGN_COVER_STICKY ? GALLERY_DESIGN_COVER_STICKY : GALLERY_DESIGN_CLASSIC;
}
