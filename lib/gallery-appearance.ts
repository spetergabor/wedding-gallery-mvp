const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

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
