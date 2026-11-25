import { schedules, task } from "@trigger.dev/sdk/v3";
import { buildMetaAdsReport, runMetaAdsPipeline } from "@/lib/meta-ads/pipeline";

const queue = { name: "meta-ads-intelligence", concurrencyLimit: 1 } as const;
const retry = {
  maxAttempts: 4,
  factor: 2,
  minTimeoutInMs: 30_000,
  maxTimeoutInMs: 10 * 60_000,
  randomize: true
} as const;

export const metaAdsManualSyncTask = task({
  id: "meta-ads-manual-sync",
  description: "Manual read-only Meta Ads sync and intelligence evaluation.",
  queue,
  retry,
  maxDuration: 1800,
  run: async (payload: { backfill?: boolean; lookbackDays?: number } = {}) => {
    return runMetaAdsPipeline({
      mode: payload.backfill ? "backfill" : "manual",
      lookbackDays: payload.lookbackDays ?? (payload.backfill ? 90 : 7)
    });
  }
});

export const metaAdsThreeHourlySyncTask = schedules.task({
  id: "meta-ads-three-hourly-sync",
  description: "Read-only Meta Ads sync and anomaly evaluation every three hours.",
  cron: { pattern: "0 */3 * * *", timezone: "Europe/Vienna", environments: ["PRODUCTION"] },
  queue,
  retry,
  maxDuration: 1800,
  run: async () => runMetaAdsPipeline({ mode: "scheduled" })
});

export const metaAdsDailyReportTask = schedules.task({
  id: "meta-ads-daily-report",
  description: "Daily Meta Ads intelligence report at 08:00 Europe/Vienna.",
  cron: { pattern: "0 8 * * *", timezone: "Europe/Vienna", environments: ["PRODUCTION"] },
  queue,
  retry,
  maxDuration: 600,
  run: async () => buildMetaAdsReport("daily")
});

export const metaAdsWeeklyReportTask = schedules.task({
  id: "meta-ads-weekly-report",
  description: "Weekly Meta Ads intelligence report every Monday.",
  cron: { pattern: "0 8 * * 1", timezone: "Europe/Vienna", environments: ["PRODUCTION"] },
  queue,
  retry,
  maxDuration: 600,
  run: async () => buildMetaAdsReport("weekly")
});

export const metaAdsMonthlyReportTask = schedules.task({
  id: "meta-ads-monthly-report",
  description: "Monthly Meta Ads intelligence report on the first day of each month.",
  cron: { pattern: "0 8 1 * *", timezone: "Europe/Vienna", environments: ["PRODUCTION"] },
  queue,
  retry,
  maxDuration: 600,
  run: async () => buildMetaAdsReport("monthly")
});
