const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

export const GALLERY_TITLE_FONTS = [
  {
    key: "playfair",
    label: "Playfair",
    description: "Elegáns, editorial alapértelmezés.",
    family: '"Playfair Display", Georgia, serif'
  },
  {
    key: "cormorant",
    label: "Cormorant",
    description: "Klasszikus, finom esküvői karakter.",
    family: '"Cormorant Garamond", Georgia, serif'
  },
  {
    key: "lora",
    label: "Lora",
    description: "Lágy, jól olvasható serif.",
    family: '"Lora", Georgia, serif'
  },
  {
    key: "inter",
    label: "Inter",
    description: "Modern, letisztult sans.",
    family: "Inter, ui-sans-serif, system-ui, sans-serif"
  },
  {
    key: "montserrat",
    label: "Montserrat",
    description: "Határozott, prémium brand hangulat.",
    family: '"Montserrat", Arial, sans-serif'
  }
] as const;

export type GalleryTitleFontKey = (typeof GALLERY_TITLE_FONTS)[number]["key"];
export type GalleryBodyFontKey = GalleryTitleFontKey;

export function normalizeGalleryTextColor(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const color = value.trim();

  return HEX_COLOR_PATTERN.test(color) ? color.toLowerCase() : null;
}

export function galleryTextColorOrDefault(value: unknown, fallback: string) {
  return normalizeGalleryTextColor(value) ?? fallback;
}

export function normalizeGalleryBackgroundColor(value: unknown) {
  return normalizeGalleryTextColor(value);
}

export function galleryBackgroundColorOrDefault(value: unknown, fallback = "#f8f7f4") {
  return normalizeGalleryBackgroundColor(value) ?? fallback;
}

export function normalizeGalleryBodyTextColor(value: unknown) {
  return normalizeGalleryTextColor(value);
}

export function galleryBodyTextColorOrDefault(value: unknown, fallback = "#111111") {
  return normalizeGalleryBodyTextColor(value) ?? fallback;
}

function normalizePixelValue(value: unknown, fallback: number, min: number, max: number) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number.parseInt(value, 10) : Number.NaN;

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

export function normalizeGalleryGridGap(value: unknown, fallback = 8) {
  return normalizePixelValue(value, fallback, 0, 32);
}

export function normalizeGalleryImageRadius(value: unknown, fallback = 8) {
  return normalizePixelValue(value, fallback, 0, 32);
}

export function normalizeClassicGradientIntensity(value: unknown, fallback = 100) {
  return normalizePixelValue(value, fallback, 0, 100);
}

export function normalizeGalleryTitleFont(value: unknown): GalleryTitleFontKey {
  if (typeof value !== "string") {
    return "playfair";
  }

  return GALLERY_TITLE_FONTS.some((font) => font.key === value) ? (value as GalleryTitleFontKey) : "playfair";
}

export function galleryTitleFontDefinition(value: unknown) {
  const key = normalizeGalleryTitleFont(value);

  return GALLERY_TITLE_FONTS.find((font) => font.key === key) ?? GALLERY_TITLE_FONTS[0];
}

export function normalizeGalleryBodyFont(value: unknown): GalleryBodyFontKey {
  if (typeof value !== "string") {
    return "inter";
  }

  return GALLERY_TITLE_FONTS.some((font) => font.key === value) ? (value as GalleryBodyFontKey) : "inter";
}

export function galleryBodyFontDefinition(value: unknown) {
  const key = normalizeGalleryBodyFont(value);

  return GALLERY_TITLE_FONTS.find((font) => font.key === key) ?? GALLERY_TITLE_FONTS[3];
}

export function normalizeGalleryTitleSize(value: unknown, fallback = 96) {
  return normalizePixelValue(value, fallback, 48, 128);
}

export function galleryHeroTitleSizeClamp(size: number) {
  const safeSize = normalizeGalleryTitleSize(size);
  const mobileSize = Math.max(44, Math.round(safeSize * 0.54));
  const preferredViewportSize = Math.max(11, Math.round(safeSize / 8));

  return `clamp(${mobileSize}px, ${preferredViewportSize}vw, ${safeSize}px)`;
}
