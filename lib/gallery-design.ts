export const GALLERY_DESIGN_CLASSIC = "classic";
export const GALLERY_DESIGN_COVER_STICKY = "cover_sticky";
export const GALLERY_DESIGN_FULLSCREEN_COVER = "fullscreen_cover";

export type GalleryDesign =
  | typeof GALLERY_DESIGN_CLASSIC
  | typeof GALLERY_DESIGN_COVER_STICKY
  | typeof GALLERY_DESIGN_FULLSCREEN_COVER;

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
  },
  {
    key: GALLERY_DESIGN_FULLSCREEN_COVER,
    label: "Cinematic",
    eyebrow: "Teljes cover",
    description:
      "Teljes képernyős borítókép filmszerű alsó szövegelrendezéssel, Editorial funkciósávval."
  }
];

export function normalizeGalleryDesign(value: unknown): GalleryDesign {
  if (value === GALLERY_DESIGN_COVER_STICKY || value === GALLERY_DESIGN_FULLSCREEN_COVER) {
    return value;
  }

  return GALLERY_DESIGN_CLASSIC;
}
