import assert from "node:assert/strict";
import test from "node:test";
import { actionValue, normalizeInsight } from "@/lib/meta-ads/metrics";

test("action values distinguish missing from a measured zero", () => {
  assert.equal(actionValue(undefined, ["lead"]), null);
  assert.equal(actionValue([{ action_type: "lead", value: "0" }], ["lead"]), 0);
  assert.equal(actionValue([{ action_type: "lead", value: "2" }, { action_type: "lead", value: "3" }], ["lead"]), 5);
});

test("normalization keeps missing metrics null and marks recent attribution data provisional", () => {
  const normalized = normalizeInsight({
    account_id: "123",
    date_start: "2026-11-25",
    date_stop: "2026-11-25",
    spend: "12.50",
    impressions: "1000",
    inline_link_clicks: "20",
    actions: [{ action_type: "landing_page_view", value: "10" }, { action_type: "lead", value: "0" }]
  }, "account", "7d_click_1d_view", new Date("2026-11-25T12:00:00Z"));
  assert.equal(normalized.spend, 12.5);
  assert.equal(normalized.landingPageViews, BigInt(10));
  assert.equal(normalized.leads, BigInt(0));
  assert.equal(normalized.purchases, null);
  assert.equal(normalized.metricStatuses.leads, "provisional");
  assert.equal(normalized.metricStatuses.purchases, "missing");
  assert.equal(normalized.dataStatus, "provisional");
});
