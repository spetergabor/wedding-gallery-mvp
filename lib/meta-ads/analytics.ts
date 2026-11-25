import type { AnalyticsPoint, CalculatedMetrics, PeriodComparison } from "@/lib/meta-ads/types";

export const ANALYTICS_WINDOWS = [1, 3, 7, 14, 30, 90] as const;

const ZERO_METRICS = {
  spend: 0,
  impressions: 0,
  reach: 0,
  linkClicks: 0,
  outboundClicks: 0,
  landingPageViews: 0,
  leads: 0,
  purchases: 0
};

function divide(numerator: number, denominator: number, multiplier = 1) {
  return denominator > 0 ? (numerator / denominator) * multiplier : null;
}

export function calculateMetrics(points: AnalyticsPoint[]): CalculatedMetrics {
  const totals = points.reduce(
    (result, point) => ({
      spend: result.spend + point.spend,
      impressions: result.impressions + point.impressions,
      reach: result.reach + point.reach,
      linkClicks: result.linkClicks + point.linkClicks,
      outboundClicks: result.outboundClicks + point.outboundClicks,
      landingPageViews: result.landingPageViews + point.landingPageViews,
      leads: result.leads + point.leads,
      purchases: result.purchases + point.purchases
    }),
    { ...ZERO_METRICS }
  );

  return {
    ...totals,
    frequency: divide(totals.impressions, totals.reach),
    cpm: divide(totals.spend, totals.impressions, 1_000),
    ctr: divide(totals.linkClicks, totals.impressions, 100),
    outboundCtr: divide(totals.outboundClicks, totals.impressions, 100),
    cpc: divide(totals.spend, totals.linkClicks),
    costPerLandingPageView: divide(totals.spend, totals.landingPageViews),
    costPerLead: divide(totals.spend, totals.leads),
    costPerPurchase: divide(totals.spend, totals.purchases),
    landingPageConversionRate: divide(totals.leads, totals.landingPageViews, 100)
  };
}

function percentChange(current: number | null, previous: number | null) {
  if (current === null || previous === null || previous === 0) {
    return null;
  }
  return ((current - previous) / Math.abs(previous)) * 100;
}

function utcDay(value: Date) {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

function period(points: AnalyticsPoint[], fromInclusive: number, toExclusive: number) {
  return points.filter((point) => {
    const timestamp = utcDay(point.date);
    return timestamp >= fromInclusive && timestamp < toExclusive;
  });
}

function reliabilityFor(points: AnalyticsPoint[], metrics: CalculatedMetrics) {
  if (points.length === 0 || metrics.impressions < 1_000 || metrics.linkClicks < 10) {
    return "low" as const;
  }
  if (metrics.impressions < 5_000 || metrics.linkClicks < 50 || points.some((point) => point.dataStatus === "provisional")) {
    return "medium" as const;
  }
  return "high" as const;
}

export function compareWindow(points: AnalyticsPoint[], days: number, now = new Date()): PeriodComparison {
  const tomorrow = utcDay(now) + 24 * 60 * 60 * 1_000;
  const currentStart = tomorrow - days * 24 * 60 * 60 * 1_000;
  const previousStart = currentStart - days * 24 * 60 * 60 * 1_000;
  const currentPoints = period(points, currentStart, tomorrow);
  const previousPoints = period(points, previousStart, currentStart);
  const current = calculateMetrics(currentPoints);
  const previous = calculateMetrics(previousPoints);
  const changes = Object.fromEntries(
    Object.keys(current).map((key) => [
      key,
      percentChange(current[key as keyof CalculatedMetrics], previous[key as keyof CalculatedMetrics])
    ])
  ) as Record<keyof CalculatedMetrics, number | null>;
  const notes: string[] = [];

  if (currentPoints.length < days) notes.push("A jelenlegi időszak nem tartalmaz minden napra adatot.");
  if (previousPoints.length < days) notes.push("Az előző összehasonlítási időszak hiányos.");
  if (currentPoints.some((point) => point.dataStatus === "provisional")) {
    notes.push("Az utolsó 72 óra konverziós adatai még változhatnak az attribúciós késleltetés miatt.");
  }
  if (days % 7 === 0) {
    notes.push("Az összehasonlítás azonos hétköznapi összetételű időszakot használ.");
  } else {
    notes.push("A rövid időablak hétköznapi összetétele eltérhet; ezt szezonalitási zajként kell kezelni.");
  }
  if (current.leads === 0) notes.push("A nulla lead tényleges nulla, nem azonos a hiányzó mérési adattal.");

  return {
    label: `${days} nap`,
    days,
    current,
    previous,
    changes,
    reliability: reliabilityFor(currentPoints, current),
    notes
  };
}

export function buildAnalytics(points: AnalyticsPoint[], now = new Date()) {
  const comparisons = ANALYTICS_WINDOWS.map((days) => compareWindow(points, days, now));
  const lifetime = calculateMetrics(points);
  return {
    generatedAt: now,
    comparisons,
    lifetime,
    lifetimeReliability: reliabilityFor(points, lifetime),
    earliestDate: points.length ? new Date(Math.min(...points.map((point) => point.date.getTime()))) : null,
    latestDate: points.length ? new Date(Math.max(...points.map((point) => point.date.getTime()))) : null
  };
}
