export const GALLERY_MODE_FULL = "full";
export const GALLERY_MODE_PROOFING = "proofing";

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

export type ProofingStatus = (typeof PROOFING_STATUSES)[number]["key"];

export function isProofingGallery(mode: string | null | undefined) {
  return mode === GALLERY_MODE_PROOFING;
}

export function proofingStatusLabel(status: string | null | undefined) {
  return PROOFING_STATUSES.find((item) => item.key === status)?.label ?? PROOFING_STATUSES[0].label;
}

export function proofingStatusDescription(status: string | null | undefined) {
  return PROOFING_STATUSES.find((item) => item.key === status)?.description ?? PROOFING_STATUSES[0].description;
}
