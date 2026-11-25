export type ReconciliationMetrics = {
  spend: number;
  impressions: number;
  linkClicks: number;
  outboundClicks: number;
  landingPageViews: number;
  leads: number;
  purchases: number;
  reach?: number | null;
  frequency?: number | null;
};

export function reconcileMetaMetrics(imported: ReconciliationMetrics, reference: ReconciliationMetrics, tolerancePercent = 1) {
  const additiveFields = ["spend", "impressions", "linkClicks", "outboundClicks", "landingPageViews", "leads", "purchases"] as const;
  const fields = additiveFields.map((field) => {
    const expected = reference[field];
    const actual = imported[field];
    const absoluteDifference = actual - expected;
    const percentDifference = expected === 0 ? (actual === 0 ? 0 : null) : absoluteDifference / expected * 100;
    return { field, imported: actual, reference: expected, absoluteDifference, percentDifference, withinTolerance: percentDifference !== null && Math.abs(percentDifference) <= tolerancePercent };
  });
  return {
    passed: fields.every((field) => field.withinTolerance),
    tolerancePercent,
    fields,
    nonAdditive: {
      reach: { imported: imported.reach ?? null, reference: reference.reach ?? null },
      frequency: { imported: imported.frequency ?? null, reference: reference.frequency ?? null },
      note: "Reach and frequency are compared only for the exact same report scope; they must not be summed across breakdown rows."
    }
  };
}
