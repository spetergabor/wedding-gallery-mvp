export type GalleryDownloadQuality = "original" | "web";

export const DEFAULT_GALLERY_DOWNLOAD_QUALITY: GalleryDownloadQuality = "web";

export const GALLERY_DOWNLOAD_QUALITIES = [
  { value: "web", label: { hu: "Webes méret", de: "Webgröße" } },
  { value: "original", label: { hu: "Teljes felbontás", de: "Volle Auflösung" } }
] as const;

export function normalizeGalleryDownloadQuality(value: string | null | undefined): GalleryDownloadQuality {
  return value === "web" ? "web" : "original";
}

export function galleryDownloadQualityLabel(value: string | null | undefined, language: "hu" | "de" = "de") {
  const quality = normalizeGalleryDownloadQuality(value);
  return GALLERY_DOWNLOAD_QUALITIES.find((item) => item.value === quality)?.label[language] ?? GALLERY_DOWNLOAD_QUALITIES[0].label[language];
}
