export type GallerySalePricingTier = {
  from: number;
  to: number | null;
  unitPriceCents: number;
};

function parsePositiveInteger(value: FormDataEntryValue | string | null | undefined) {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function normalizeGallerySalePricingTiers(value: unknown): GallerySalePricingTier[] {
  const rawTiers = Array.isArray(value) ? value : [];

  return rawTiers
    .map((tier) => {
      if (!tier || typeof tier !== "object") {
        return null;
      }

      const record = tier as Record<string, unknown>;
      const from = Number.parseInt(String(record.from ?? ""), 10);
      const parsedTo = record.to === null || record.to === "" ? Number.NaN : Number.parseInt(String(record.to ?? ""), 10);
      const unitPriceCents = Number.parseInt(String(record.unitPriceCents ?? ""), 10);

      if (!Number.isFinite(from) || from <= 0 || !Number.isFinite(unitPriceCents) || unitPriceCents < 0) {
        return null;
      }

      const to = Number.isFinite(parsedTo) && parsedTo > 0 ? parsedTo : null;

      if (to !== null && to < from) {
        return null;
      }

      return {
        from,
        to,
        unitPriceCents
      };
    })
    .filter((tier): tier is GallerySalePricingTier => Boolean(tier))
    .sort((a, b) => a.from - b.from)
    .slice(0, 8);
}

export function parseGallerySalePricingTiersFromForm(formData: FormData): GallerySalePricingTier[] {
  const fromValues = formData.getAll("saleTierFrom");
  const toValues = formData.getAll("saleTierTo");
  const priceValues = formData.getAll("saleTierPrice");
  const rows = Math.max(fromValues.length, toValues.length, priceValues.length);
  const tiers: GallerySalePricingTier[] = [];

  for (let index = 0; index < rows; index += 1) {
    const from = parsePositiveInteger(fromValues[index]);
    const price = parsePriceCents(String(priceValues[index] ?? ""));

    if (!from || price === null) {
      continue;
    }

    const to = parsePositiveInteger(toValues[index]);

    if (to && to < from) {
      continue;
    }

    tiers.push({
      from,
      to,
      unitPriceCents: price
    });
  }

  return normalizeGallerySalePricingTiers(tiers);
}

export function parsePriceCents(value: string | null | undefined) {
  const normalized = value?.trim().replace(/\s+/g, "").replace(",", ".") ?? "";
  const parsed = Number.parseFloat(normalized);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return Math.max(0, Math.round(parsed * 100));
}

export function formatPriceInput(cents: number | null | undefined) {
  if (cents === null || cents === undefined || cents <= 0) {
    return "";
  }

  return (cents / 100).toFixed(2).replace(".", ",");
}

export function priceForGalleryPhotoQuantity({
  quantity,
  fallbackUnitPriceCents,
  tiers
}: {
  quantity: number;
  fallbackUnitPriceCents: number;
  tiers: GallerySalePricingTier[];
}) {
  const safeQuantity = Math.max(0, Math.floor(quantity));

  if (safeQuantity <= 0) {
    return 0;
  }

  const matchingTier = normalizeGallerySalePricingTiers(tiers).find((tier) => {
    return safeQuantity >= tier.from && (tier.to === null || safeQuantity <= tier.to);
  });
  const unitPriceCents = matchingTier?.unitPriceCents ?? Math.max(0, fallbackUnitPriceCents);

  return safeQuantity * unitPriceCents;
}

export function pricingTierLabel(tier: GallerySalePricingTier, currency: string, locale = "hu-HU", unitLabel = "kép") {
  const range = tier.to ? `${tier.from}-${tier.to}` : `${tier.from}+`;
  const price = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.toUpperCase()
  }).format(tier.unitPriceCents / 100);

  return `${range}: ${price} / ${unitLabel}`;
}
