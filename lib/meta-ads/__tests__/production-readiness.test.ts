import assert from "node:assert/strict";
import test from "node:test";
import { buildCapacityForecast } from "@/lib/meta-ads/capacity-forecast";
import { deriveMetaHealthState } from "@/lib/meta-ads/health";
import { reconcileMetaMetrics } from "@/lib/meta-ads/reconciliation";

test("capacity forecast is explicit about missing operational inputs", () => {
  const result = buildCapacityForecast({ eventDate: null, totalCapacity: 20, booked: 4, averageDailyBookings: null, currentDailySpend: 10, costPerBooking: 20, now: new Date("2026-11-25T00:00:00Z") });
  assert.equal(result.reliable, false);
  assert.deepEqual(result.missing, ["eventDate", "averageDailyBookings"]);
});

test("capacity forecast produces capped conservative, base and optimistic scenarios without changing budgets", () => {
  const result = buildCapacityForecast({ eventDate: new Date("2026-12-05T00:00:00Z"), totalCapacity: 20, booked: 10, averageDailyBookings: 0.5, currentDailySpend: 20, costPerBooking: 40, now: new Date("2026-11-25T00:00:00Z") });
  assert.equal(result.reliable, true);
  assert.equal(result.scenarios.length, 3);
  assert.equal(result.scenarios.every((item) => Number(item.expectedBooked) <= 20), true);
  assert.match(String(result.note), /No campaign budget/);
});

test("reconciliation checks additive metrics but flags reach and frequency as non-additive", () => {
  const baseline = { spend: 100, impressions: 1000, linkClicks: 20, outboundClicks: 18, landingPageViews: 15, leads: 2, purchases: 1, reach: 800, frequency: 1.25 };
  const result = reconcileMetaMetrics({ ...baseline, spend: 100.5 }, baseline, 1);
  assert.equal(result.passed, true);
  assert.match(result.nonAdditive.note, /must not be summed/);
});

test("health state machine separates setup, connection, sync and degraded operation", () => {
  const now = new Date("2026-11-25T12:00:00Z");
  const base = { databaseConnected: true, configured: true, connectedAccounts: 1, syncing: false, lastSuccessAt: now, lastFailureAt: null, latestDataAt: now, mappingsComplete: true, schedulesActive: true, now };
  assert.equal(deriveMetaHealthState({ ...base, configured: false }), "NOT_CONFIGURED");
  assert.equal(deriveMetaHealthState({ ...base, connectedAccounts: 0, lastSuccessAt: null, latestDataAt: null }), "CONFIGURED");
  assert.equal(deriveMetaHealthState({ ...base, syncing: true }), "SYNCING");
  assert.equal(deriveMetaHealthState({ ...base, schedulesActive: false }), "DEGRADED");
  assert.equal(deriveMetaHealthState(base), "HEALTHY");
});
