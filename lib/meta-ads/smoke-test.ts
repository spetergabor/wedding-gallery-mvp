import { MetaGraphClient, type MetaApiResponseTelemetry } from "@/lib/meta-ads/client";
import { MetaAdsCollector } from "@/lib/meta-ads/collector";
import { readMetaAdsRuntimeConfig } from "@/lib/meta-ads/config";
import type { MetaAction, MetaInsightPayload } from "@/lib/meta-ads/types";

async function firstPage<T>(pages: AsyncGenerator<T[], void, void>) {
  const page = await pages.next();
  return page.done ? [] : page.value;
}

function actionTypes(rows: MetaInsightPayload[]) {
  const values = new Set<string>();
  for (const row of rows) {
    for (const action of (row.actions ?? []) as MetaAction[]) {
      if (action.action_type) values.add(action.action_type);
    }
  }
  return [...values].sort();
}

function availableFields(rows: MetaInsightPayload[]) {
  const fields = new Set<string>();
  for (const row of rows) {
    for (const [key, value] of Object.entries(row)) {
      if (value !== null && value !== undefined) fields.add(key);
    }
  }
  return [...fields].sort();
}

export async function runMetaAdsSmokeTest(now = new Date()) {
  const config = readMetaAdsRuntimeConfig();
  const telemetry: MetaApiResponseTelemetry[] = [];
  const client = new MetaGraphClient({
    accessToken: config.accessToken,
    apiVersion: config.apiVersion,
    requestTimeoutMs: config.requestTimeoutMs,
    maxRetries: Math.min(config.maxRetries, 2),
    onResponse: (event) => telemetry.push(event)
  });
  const collector = new MetaAdsCollector(client);
  const until = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const since = new Date(until);
  since.setUTCDate(since.getUTCDate() - 2);
  const accounts = [];

  for (const mapping of config.accounts) {
    const account = await collector.getAccount(mapping.accountId);
    const [campaigns, adSets, ads, creatives, accountInsights, campaignInsights, adInsights, placementInsights] = await Promise.all([
      firstPage(collector.collectCampaigns(mapping.accountId)),
      firstPage(collector.collectAdSets(mapping.accountId)),
      firstPage(collector.collectAds(mapping.accountId)),
      firstPage(collector.collectCreatives(mapping.accountId)),
      firstPage(collector.collectInsights(mapping.accountId, "account", since, until)),
      firstPage(collector.collectInsights(mapping.accountId, "campaign", since, until)),
      firstPage(collector.collectInsights(mapping.accountId, "ad", since, until)),
      firstPage(collector.collectPlacementInsights(mapping.accountId, since, until)).catch(() => [])
    ]);
    const insightRows = [...accountInsights, ...campaignInsights, ...adInsights];
    accounts.push({
      brand: mapping.brand,
      accountId: mapping.accountId,
      account: {
        name: typeof account.name === "string" ? account.name : null,
        currency: typeof account.currency === "string" ? account.currency : null,
        timezone: typeof account.timezone_name === "string" ? account.timezone_name : null,
        status: account.account_status == null ? null : String(account.account_status)
      },
      firstPageCounts: {
        campaigns: campaigns.length,
        adSets: adSets.length,
        ads: ads.length,
        creatives: creatives.length,
        accountInsights: accountInsights.length,
        campaignInsights: campaignInsights.length,
        adInsights: adInsights.length,
        placementInsights: placementInsights.length
      },
      actionTypes: actionTypes(insightRows),
      attributionSettings: [...new Set(insightRows.map((row) => row.attribution_setting).filter(Boolean))].sort(),
      availableInsightFields: availableFields(insightRows),
      availableVideoFields: availableFields(insightRows).filter((field) => field.startsWith("video_")),
      placementBreakdownAvailable: placementInsights.length > 0
    });
  }

  return {
    ok: true,
    testedAt: now,
    apiVersion: config.apiVersion,
    readOnly: true,
    token: { validForRequestedCalls: true, expiration: "not_verified_without_app_credentials" },
    requestCount: telemetry.length,
    lastRateLimitHeaders: telemetry.at(-1) ?? null,
    range: { since: since.toISOString(), until: until.toISOString() },
    accounts
  };
}
