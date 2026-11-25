import assert from "node:assert/strict";
import test from "node:test";
import { detectAnomalies } from "@/lib/meta-ads/anomalies";
import { generateRecommendations } from "@/lib/meta-ads/recommendations";
import type { CalculatedMetrics, PeriodComparison } from "@/lib/meta-ads/types";

const base: CalculatedMetrics = {
  spend: 100, impressions: 10_000, reach: 5_000, linkClicks: 200, outboundClicks: 150,
  landingPageViews: 100, leads: 10, purchases: 0, frequency: 2, cpm: 10, ctr: 2,
  outboundCtr: 1.5, cpc: 0.5, costPerLandingPageView: 1, costPerLead: 10,
  costPerPurchase: null, landingPageConversionRate: 10
};

function comparison(current: CalculatedMetrics, previous = base, reliability: PeriodComparison["reliability"] = "high"): PeriodComparison {
  const changes = Object.fromEntries(Object.keys(current).map((key) => [key, 0])) as PeriodComparison["changes"];
  return { label: "7 nap", days: 7, current, previous, changes, reliability, notes: [] };
}

test("detects a critical click-to-landing-page measurement gap", () => {
  const input = comparison({ ...base, landingPageViews: 0, leads: 0, landingPageConversionRate: null, costPerLandingPageView: null, costPerLead: null });
  const anomalies = detectAnomalies(input);
  assert.equal(anomalies.some((item) => item.anomalyType === "TRACKING_OR_LANDING_PAGE_GAP" && item.severity === "CRITICAL"), true);
});

test("recommendations are explainable and do not imply an automatic live mutation", () => {
  const input = comparison(base);
  const recommendations = generateRecommendations(input, [], { costPerLead: 15 });
  const scale = recommendations.find((item) => item.type === "SCALE");
  assert.ok(scale);
  assert.match(scale.recommendation, /15–20%/);
  assert.ok(scale.rationale.length > 10);
  assert.ok(scale.potentialImpact.length > 10);
});

test("low volume returns insufficient-data guidance", () => {
  const recommendations = generateRecommendations(comparison({ ...base, spend: 2, impressions: 100, linkClicks: 1, leads: 0 }, base, "low"), []);
  assert.equal(recommendations[0]?.type, "INSUFFICIENT_DATA");
});
