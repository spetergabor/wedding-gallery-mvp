import assert from "node:assert/strict";
import test from "node:test";
import { buildAnalytics, calculateMetrics, compareWindow } from "@/lib/meta-ads/analytics";
import type { AnalyticsPoint } from "@/lib/meta-ads/types";

function point(date: string, overrides: Partial<AnalyticsPoint> = {}): AnalyticsPoint {
  return {
    date: new Date(`${date}T00:00:00Z`), spend: 10, impressions: 1_000, reach: 800,
    linkClicks: 20, outboundClicks: 15, landingPageViews: 10, leads: 2, purchases: 1,
    ...overrides
  };
}

test("calculated rates are recomputed from period totals", () => {
  const metrics = calculateMetrics([point("2026-11-24"), point("2026-11-25", { spend: 20, leads: 1 })]);
  assert.equal(metrics.spend, 30);
  assert.equal(metrics.leads, 3);
  assert.equal(metrics.costPerLead, 10);
  assert.equal(metrics.ctr, 2);
});

test("window comparison uses the immediately preceding equal-length period", () => {
  const comparison = compareWindow([
    point("2026-11-18", { leads: 1 }), point("2026-11-19", { leads: 1 }), point("2026-11-20", { leads: 1 }),
    point("2026-11-21", { leads: 1 }), point("2026-11-22", { leads: 1 }), point("2026-11-23", { leads: 1 }), point("2026-11-24", { leads: 1 }),
    point("2026-11-25", { leads: 2 })
  ], 7, new Date("2026-11-25T12:00:00Z"));
  assert.equal(comparison.current.leads, 8);
  assert.equal(comparison.previous.leads, 1);
  assert.equal(comparison.changes.leads, 700);
});

test("analytics exposes every required window and lifetime", () => {
  const analytics = buildAnalytics([point("2026-11-25")], new Date("2026-11-25T12:00:00Z"));
  assert.deepEqual(analytics.comparisons.map((item) => item.days), [1, 3, 7, 14, 30, 90]);
  assert.equal(analytics.lifetime.spend, 10);
});
