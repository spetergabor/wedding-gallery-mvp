export const IRISMOMENT_INVOICE_PRICING = {
  basePricesCents: [5999, 11999, 15999, 19999, 23999],
  extraPersonCents: 4000
} as const;

export function irismomentInvoiceTotalCents(personCount: number) {
  if (!Number.isInteger(personCount) || personCount < 1) return null;
  const listedPrice = IRISMOMENT_INVOICE_PRICING.basePricesCents[personCount - 1];
  if (listedPrice !== undefined) return listedPrice;
  return IRISMOMENT_INVOICE_PRICING.basePricesCents.at(-1)! +
    (personCount - IRISMOMENT_INVOICE_PRICING.basePricesCents.length) *
      IRISMOMENT_INVOICE_PRICING.extraPersonCents;
}
