export const MONETIZATION_FEATURES = [
  {
    key: "featureGallery",
    overrideKey: "featureGalleryOverride",
    label: "Galéria",
    shortLabel: "Galéria"
  },
  {
    key: "featureAlbum",
    overrideKey: "featureAlbumOverride",
    label: "Albumtervező",
    shortLabel: "Album"
  },
  {
    key: "featureContracts",
    overrideKey: "featureContractsOverride",
    label: "Szerződés",
    shortLabel: "Szerződés"
  },
  {
    key: "featureBooking",
    overrideKey: "featureBookingOverride",
    label: "Időpontfoglaló",
    shortLabel: "Foglalás"
  },
  {
    key: "featureStripe",
    overrideKey: "featureStripeOverride",
    label: "Stripe értékesítés",
    shortLabel: "Stripe"
  }
] as const;

export type MonetizationFeatureKey = (typeof MONETIZATION_FEATURES)[number]["key"];
export type MonetizationFeatureOverrideKey = (typeof MONETIZATION_FEATURES)[number]["overrideKey"];

export function formatPlanPrice(cents: number, currency = "EUR") {
  const amount = Math.max(0, cents) / 100;

  return `${amount.toLocaleString("hu-HU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })} ${currency.toUpperCase()}/hó`;
}

export function formatStorageLimit(limitGb: number | null | undefined) {
  if (limitGb == null) {
    return "Korlátlan";
  }

  return `${limitGb.toLocaleString("hu-HU")} GB`;
}

export function resolveFeatureAccess({
  planValue,
  overrideValue,
  freeAccess
}: {
  planValue: boolean | null | undefined;
  overrideValue: boolean | null | undefined;
  freeAccess: boolean;
}) {
  if (freeAccess) {
    return true;
  }

  if (overrideValue != null) {
    return overrideValue;
  }

  return Boolean(planValue);
}

export function normalizePlanSlug(input: string) {
  return input
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}
