import type { AdminLanguage } from "@/lib/admin-language";

export const GALLERY_MODE_FULL = "full";
export const GALLERY_MODE_PROOFING = "proofing";
export const GALLERY_MODE_ALBUM_SOURCE = "album_source";

export const PHOTO_DELIVERY_STAGE_RAW = "raw";
export const PHOTO_DELIVERY_STAGE_FINAL = "final";

export const PROOFING_STATUS_NOT_OPENED = "not_opened";
export const PROOFING_STATUS_IN_PROGRESS = "in_progress";
export const PROOFING_STATUS_SUBMITTED = "submitted";
export const PROOFING_STATUS_PROCESSING = "processing";
export const PROOFING_STATUS_DELIVERED = "delivered";

export const PROOFING_STATUSES = [
  {
    key: PROOFING_STATUS_NOT_OPENED,
    label: "Ügyfél még nem nyitotta meg",
    description: "A válogató link elkészült, de még nincs ügyfél aktivitás."
  },
  {
    key: PROOFING_STATUS_IN_PROGRESS,
    label: "Válogatás folyamatban",
    description: "Az ügyfél már megnyitotta vagy elkezdte a válogatást."
  },
  {
    key: PROOFING_STATUS_SUBMITTED,
    label: "Válogatás leadva",
    description: "Az ügyfél lezárta a kiválasztást."
  },
  {
    key: PROOFING_STATUS_PROCESSING,
    label: "Feldolgozás alatt",
    description: "A kiválasztott képek utómunkája folyamatban van."
  },
  {
    key: PROOFING_STATUS_DELIVERED,
    label: "Kész képek átadva",
    description: "A végleges anyag át lett adva az ügyfélnek."
  }
] as const;

const PROOFING_STATUS_LABELS: Record<AdminLanguage, Record<string, string>> = {
  hu: {
    [PROOFING_STATUS_NOT_OPENED]: "Ügyfél még nem nyitotta meg",
    [PROOFING_STATUS_IN_PROGRESS]: "Válogatás folyamatban",
    [PROOFING_STATUS_SUBMITTED]: "Válogatás leadva",
    [PROOFING_STATUS_PROCESSING]: "Feldolgozás alatt",
    [PROOFING_STATUS_DELIVERED]: "Kész képek átadva"
  },
  de: {
    [PROOFING_STATUS_NOT_OPENED]: "Kunde hat noch nicht geöffnet",
    [PROOFING_STATUS_IN_PROGRESS]: "Auswahl läuft",
    [PROOFING_STATUS_SUBMITTED]: "Auswahl abgegeben",
    [PROOFING_STATUS_PROCESSING]: "In Bearbeitung",
    [PROOFING_STATUS_DELIVERED]: "Fertige Bilder ausgeliefert"
  },
  en: {
    [PROOFING_STATUS_NOT_OPENED]: "Client has not opened yet",
    [PROOFING_STATUS_IN_PROGRESS]: "Selection in progress",
    [PROOFING_STATUS_SUBMITTED]: "Selection submitted",
    [PROOFING_STATUS_PROCESSING]: "Processing",
    [PROOFING_STATUS_DELIVERED]: "Final photos delivered"
  }
};

export type ProofingStatus = (typeof PROOFING_STATUSES)[number]["key"];

export function isProofingGallery(mode: string | null | undefined) {
  return mode === GALLERY_MODE_PROOFING;
}

export function normalizePhotoDeliveryStage(value: string | null | undefined) {
  return value === PHOTO_DELIVERY_STAGE_RAW ? PHOTO_DELIVERY_STAGE_RAW : PHOTO_DELIVERY_STAGE_FINAL;
}

export function defaultPhotoDeliveryStageForGalleryMode(mode: string | null | undefined) {
  return isProofingGallery(mode) ? PHOTO_DELIVERY_STAGE_RAW : PHOTO_DELIVERY_STAGE_FINAL;
}

export function photoDeliveryStageLabel(stage: string | null | undefined) {
  return stage === PHOTO_DELIVERY_STAGE_RAW ? "Nyers" : "Kész";
}

export function proofingStatusLabel(status: string | null | undefined, language: AdminLanguage = "hu") {
  const normalizedStatus = PROOFING_STATUSES.find((item) => item.key === status)?.key ?? PROOFING_STATUS_NOT_OPENED;
  return PROOFING_STATUS_LABELS[language][normalizedStatus] ?? PROOFING_STATUS_LABELS[language][PROOFING_STATUS_NOT_OPENED];
}

export function proofingStatusDescription(status: string | null | undefined) {
  return PROOFING_STATUSES.find((item) => item.key === status)?.description ?? PROOFING_STATUSES[0].description;
}
