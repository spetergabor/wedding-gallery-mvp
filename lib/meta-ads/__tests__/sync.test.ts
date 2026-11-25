import assert from "node:assert/strict";
import test from "node:test";

test("first scheduled synchronization requests a 90-day backfill and remains restartable", async () => {
  process.env.DATABASE_URL = "postgresql://placeholder:placeholder@localhost:5432/placeholder";
  process.env.META_ADS_ACCESS_TOKEN = "test-token";
  process.env.META_AD_ACCOUNT_MAPPINGS_JSON = JSON.stringify([{ brand: "IRISMOMENT", accountId: "act_123" }]);
  const { runMetaAdsSync } = await import("@/lib/meta-ads/sync");
  const ranges: Array<{ since: Date; until: Date }> = [];
  const insightWrites: unknown[] = [];
  const empty = async function* () { yield []; };
  const collector = {
    getAccount: async () => ({ id: "act_123", name: "IRISMOMENT", currency: "EUR" }),
    collectCampaigns: empty,
    collectAdSets: empty,
    collectCreatives: empty,
    collectAds: empty,
    collectInsights: (_accountId: string, level: string, since: Date, until: Date) => {
      ranges.push({ since, until });
      return (async function* () {
        if (level === "account") {
          yield [{ account_id: "123", date_start: "2026-11-25", date_stop: "2026-11-25", spend: "0", impressions: "0" }];
        } else yield [];
      })();
    }
  };
  const repository = {
    acquireLock: async () => "owner",
    releaseLock: async () => undefined,
    upsertAccount: async () => ({ id: "db-account" }),
    hasInsights: async () => false,
    startSyncRun: async () => ({ id: "run" }),
    prepareSyncRun: async () => undefined,
    finishSyncRun: async () => undefined,
    upsertCampaign: async () => undefined,
    upsertAdSet: async () => undefined,
    upsertCreative: async () => undefined,
    upsertAd: async () => undefined,
    upsertInsight: async (_accountId: string, _brand: string, row: unknown) => { insightWrites.push(row); }
  };

  const result = await runMetaAdsSync({
    mode: "scheduled",
    now: new Date("2026-11-25T12:00:00Z"),
    collector: collector as never,
    repository: repository as never
  });
  assert.equal(result.ok, true);
  assert.equal(insightWrites.length, 1);
  assert.equal(ranges.length, 4);
  assert.equal(ranges[0].since.toISOString().slice(0, 10), "2026-08-28");
  assert.equal(ranges[0].until.toISOString().slice(0, 10), "2026-11-25");
});
