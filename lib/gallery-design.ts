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
    label: "Timeless",
    eyebrow: "Klasszikus",
    description:
      "Elegáns, bevált galéria nézet nagy borítóval, szekciókkal és lebegő funkciósávval."
  },
  {
    key: GALLERY_DESIGN_COVER_STICKY,
    label: "Editorial",
    eyebrow: "Modern cover",
    description:
      "Magazinos hatású cover nézet letisztult, görgetéskor fent maradó funkciósávval."
  }
];

export function normalizeGalleryDesign(value: unknown): GalleryDesign {
  return value === GALLERY_DESIGN_COVER_STICKY ? GALLERY_DESIGN_COVER_STICKY : GALLERY_DESIGN_CLASSIC;
}
