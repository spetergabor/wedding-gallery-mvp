import { MetaGraphClient, MetaGraphError, MetaTokenExpiredError } from "@/lib/meta-ads/client";
import { MetaAdsCollector } from "@/lib/meta-ads/collector";
import { readMetaAdsRuntimeConfig } from "@/lib/meta-ads/config";
import { normalizeInsight } from "@/lib/meta-ads/metrics";
import { MetaAdsRepository } from "@/lib/meta-ads/repository";
import type { MetaAccountMapping } from "@/lib/meta-ads/types";

export type MetaSyncMode = "scheduled" | "manual" | "backfill";

type RunMetaAdsSyncOptions = {
  mode?: MetaSyncMode;
  now?: Date;
  accountIds?: string[];
  lookbackDays?: number;
  repository?: MetaAdsRepository;
  collector?: MetaAdsCollector;
};

function startOfUtcDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function rangeFor(mode: MetaSyncMode, now: Date, lookbackDays?: number) {
  const until = startOfUtcDay(now);
  const days = lookbackDays ?? (mode === "backfill" ? 90 : 7);
  const since = new Date(until);
  since.setUTCDate(since.getUTCDate() - Math.max(1, days) + 1);
  return { since, until };
}

function idempotencyKey(mode: MetaSyncMode, account: MetaAccountMapping, since: Date, until: Date, now: Date) {
  const execution = mode === "scheduled"
    ? String(Math.floor(now.getTime() / (3 * 60 * 60 * 1_000)))
    : now.toISOString();
  return `${mode}:${account.accountId}:${since.toISOString().slice(0, 10)}:${until.toISOString().slice(0, 10)}:${execution}`;
}

async function persistPages<T>(pages: AsyncGenerator<T[], void, void>, writer: (row: T) => Promise<unknown>) {
  let read = 0;
  let written = 0;
  for await (const page of pages) {
    for (const row of page) {
      read += 1;
      await writer(row);
      written += 1;
    }
  }
  return { read, written };
}

export async function runMetaAdsSync(options: RunMetaAdsSyncOptions = {}) {
  const config = readMetaAdsRuntimeConfig();
  const mode = options.mode ?? "manual";
  const now = options.now ?? new Date();
  const effectiveLookback = options.lookbackDays ?? (mode === "scheduled" ? config.recentRefreshDays : undefined);
  const { since, until } = rangeFor(mode, now, effectiveLookback);
  const repository = options.repository ?? new MetaAdsRepository();
  const apiTelemetry: Array<{ status: number; attempt: number; appUsage: string | null; adAccountUsage: string | null; insightsThrottle: string | null }> = [];
  const client = new MetaGraphClient({
    accessToken: config.accessToken,
    apiVersion: config.apiVersion,
    requestTimeoutMs: config.requestTimeoutMs,
    maxRetries: config.maxRetries,
    onResponse: (telemetry) => apiTelemetry.push(telemetry)
  });
  const collector = options.collector ?? new MetaAdsCollector(client);
  const selectedAccounts = options.accountIds?.length
    ? config.accounts.filter((account) => options.accountIds?.includes(account.accountId))
    : config.accounts;

  const lockKey = "meta-ads:sync";
  const ownerId = await repository.acquireLock(lockKey, 2 * 60 * 60 * 1_000);
  if (!ownerId) {
    return { ok: true, skipped: true, reason: "A Meta Ads sync is already running.", accounts: [] };
  }

  const results: Array<Record<string, unknown>> = [];
  try {
    for (const mapping of selectedAccounts) {
      const telemetryStart = apiTelemetry.length;
      const run = await repository.startSyncRun({
        brand: mapping.brand,
        mode,
        idempotencyKey: idempotencyKey(mode, mapping, since, until, now),
        rangeStart: since,
        rangeEnd: until
      });

      let recordsRead = 0;
      let recordsWritten = 0;
      let placementStatus: { status: "success" | "failed"; rows: number; error?: string } = { status: "success", rows: 0 };
      try {
        const accountPayload = await collector.getAccount(mapping.accountId);
        const account = await repository.upsertAccount(mapping.brand, mapping.accountId, accountPayload);
        const accountRange = mode === "scheduled" && options.lookbackDays === undefined && !(await repository.hasInsights(account.id))
          ? rangeFor("backfill", now, 90)
          : { since, until };
        await repository.prepareSyncRun(run.id, { accountId: account.id, rangeStart: accountRange.since, rangeEnd: accountRange.until });
        recordsRead += 1;
        recordsWritten += 1;
        const campaignStats = await persistPages(collector.collectCampaigns(mapping.accountId), (row) => repository.upsertCampaign(account.id, row));
        recordsRead += campaignStats.read;
        recordsWritten += campaignStats.written;

        const adSetStats = await persistPages(collector.collectAdSets(mapping.accountId), (row) => repository.upsertAdSet(account.id, row));
        recordsRead += adSetStats.read;
        recordsWritten += adSetStats.written;

        const creativeStats = await persistPages(collector.collectCreatives(mapping.accountId), (row) => repository.upsertCreative(account.id, row));
        recordsRead += creativeStats.read;
        recordsWritten += creativeStats.written;

        const adStats = await persistPages(collector.collectAds(mapping.accountId), (row) => repository.upsertAd(account.id, row));
        recordsRead += adStats.read;
        recordsWritten += adStats.written;

        for (const level of ["account", "campaign", "adset", "ad"] as const) {
          const insightStats = await persistPages(
            collector.collectInsights(mapping.accountId, level, accountRange.since, accountRange.until),
            (row) => repository.upsertInsight(
              account.id,
              mapping.brand,
              normalizeInsight(row, level, row.attribution_setting || "account_default", now)
            )
          );
          recordsRead += insightStats.read;
          recordsWritten += insightStats.written;
        }

        try {
          const placementStats = await persistPages(
            collector.collectPlacementInsights(mapping.accountId, accountRange.since, accountRange.until),
            (row) => repository.upsertPlacementInsight(
              account.id,
              mapping.brand,
              row,
              normalizeInsight(row, "ad", row.attribution_setting || "account_default", now)
            )
          );
          recordsRead += placementStats.read;
          recordsWritten += placementStats.written;
          placementStatus = { status: "success", rows: placementStats.written };
        } catch (error) {
          const rawMessage = error instanceof Error ? error.message : "Placement breakdown collection failed.";
          placementStatus = {
            status: "failed",
            rows: 0,
            error: config.accessToken ? rawMessage.split(config.accessToken).join("[REDACTED]").slice(0, 500) : rawMessage.slice(0, 500)
          };
        }

        await repository.finishSyncRun(run.id, {
          status: "success",
          recordsRead,
          recordsWritten,
          metadata: {
            apiRequests: apiTelemetry.length - telemetryStart,
            lastRateLimitHeaders: apiTelemetry.slice(telemetryStart).at(-1) ?? null,
            placement: placementStatus
          }
        });
        results.push({
          brand: mapping.brand,
          accountId: mapping.accountId,
          status: "success",
          range: { since: accountRange.since.toISOString(), until: accountRange.until.toISOString() },
          recordsRead,
          recordsWritten,
          placement: placementStatus
        });
      } catch (error) {
        const code = error instanceof MetaTokenExpiredError
          ? "TOKEN_EXPIRED"
          : error instanceof MetaGraphError
            ? `META_${error.code ?? error.status}`
            : "SYNC_FAILED";
        const rawMessage = error instanceof Error ? error.message : "Unknown Meta sync failure.";
        const message = config.accessToken ? rawMessage.split(config.accessToken).join("[REDACTED]") : rawMessage;
        await repository.finishSyncRun(run.id, {
          status: "failed",
          recordsRead,
          recordsWritten,
          errorCode: code,
          errorMessage: message,
          metadata: { apiRequests: apiTelemetry.length - telemetryStart, lastRateLimitHeaders: apiTelemetry.slice(telemetryStart).at(-1) ?? null }
        });
        results.push({ brand: mapping.brand, accountId: mapping.accountId, status: "failed", errorCode: code, errorMessage: message });
      }
    }

    return {
      ok: results.every((result) => result.status === "success"),
      skipped: false,
      range: { since: since.toISOString(), until: until.toISOString() },
      accounts: results
    };
  } finally {
    await repository.releaseLock(lockKey, ownerId);
  }
}
