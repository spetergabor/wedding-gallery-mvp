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
