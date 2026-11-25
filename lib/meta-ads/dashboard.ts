import { buildAnalytics, calculateMetrics } from "@/lib/meta-ads/analytics";
import { metaAdsConfigurationStatus } from "@/lib/meta-ads/config";
import { prisma } from "@/lib/prisma";
import type { AnalyticsPoint } from "@/lib/meta-ads/types";

function point(row: {
  date: Date; dataStatus: string; spend: unknown; impressions: bigint | null; reach: bigint | null;
  linkClicks: bigint | null; outboundClicks: bigint | null; landingPageViews: bigint | null; leads: bigint | null; purchases: bigint | null;
}): AnalyticsPoint {
  return {
    date: row.date,
    dataStatus: row.dataStatus,
    spend: Number(row.spend ?? 0),
    impressions: Number(row.impressions ?? 0),
    reach: Number(row.reach ?? 0),
    linkClicks: Number(row.linkClicks ?? 0),
    outboundClicks: Number(row.outboundClicks ?? 0),
    landingPageViews: Number(row.landingPageViews ?? 0),
    leads: Number(row.leads ?? 0),
    purchases: Number(row.purchases ?? 0)
  };
}

export async function getMetaAdsOverview(now = new Date()) {
  const since = new Date(now);
  since.setUTCDate(since.getUTCDate() - 180);
  const [accounts, insights, activeAlerts, activeRecommendations, businessConfigs, lastSync] = await Promise.all([
    prisma.metaAdAccount.findMany({ orderBy: { brand: "asc" } }),
    prisma.metaDailyInsight.findMany({ where: { entityLevel: "account", date: { gte: since } }, orderBy: { date: "asc" } }),
    prisma.metaAlert.count({ where: { status: "active" } }),
    prisma.metaRecommendation.count({ where: { status: "active" } }),
    prisma.metaBusinessConfig.findMany({ orderBy: { brand: "asc" } }),
    prisma.metaSyncRun.findFirst({ orderBy: { startedAt: "desc" } })
  ]);
  return {
    generatedAt: now,
    configuration: metaAdsConfigurationStatus(),
    activeAlerts,
    activeRecommendations,
    lastSync,
    businessConfigs,
    accounts: accounts.map((account) => ({
      account,
      analytics: buildAnalytics(insights.filter((row) => row.accountId === account.id).map(point), now)
    }))
  };
}

export async function getMetaCampaignPerformance(brand?: string) {
  const [campaigns, insights] = await Promise.all([
    prisma.metaCampaign.findMany({
      where: brand ? { account: { brand } } : undefined,
      include: { account: { select: { brand: true, currency: true } } },
      orderBy: { lastSyncedAt: "desc" }
    }),
    prisma.metaDailyInsight.findMany({ where: { entityLevel: "campaign", ...(brand ? { brand } : {}) } })
  ]);
  return campaigns.map((campaign) => ({
    ...campaign,
    performance: calculateMetrics(insights.filter((row) => row.accountId === campaign.accountId && row.entityExternalId === campaign.externalId).map(point))
  }));
}

export async function getMetaCreativePerformance(brand?: string) {
  const ads = await prisma.metaAd.findMany({
    where: { creativeId: { not: null }, ...(brand ? { account: { brand } } : {}) },
    include: { creative: true, account: { select: { brand: true, currency: true } } }
  });
  const insights = await prisma.metaDailyInsight.findMany({ where: { entityLevel: "ad", ...(brand ? { brand } : {}) } });
  const grouped = new Map<string, { creative: (typeof ads)[number]["creative"]; brand: string; currency: string | null; rows: AnalyticsPoint[]; ads: string[] }>();
  for (const ad of ads) {
    if (!ad.creativeId) continue;
    const entry = grouped.get(ad.creativeId) ?? { creative: ad.creative, brand: ad.account.brand, currency: ad.account.currency, rows: [], ads: [] };
    entry.ads.push(ad.externalId);
    entry.rows.push(...insights.filter((row) => row.accountId === ad.accountId && row.entityExternalId === ad.externalId).map(point));
    grouped.set(ad.creativeId, entry);
  }
  return [...grouped.values()].map((entry) => ({ ...entry, performance: calculateMetrics(entry.rows), rows: undefined }));
}

export async function getMetaBrandOverview(now = new Date()) {
  const since = new Date(now);
  since.setUTCDate(since.getUTCDate() - 180);
  const insights = await prisma.metaDailyInsight.findMany({ where: { entityLevel: "account", date: { gte: since } }, orderBy: { date: "asc" } });
  return ["SPETER", "IRISMOMENT"].map((brand) => ({
    brand,
    analytics: buildAnalytics(insights.filter((row) => row.brand === brand).map(point), now)
  }));
}

export async function getMetaHistoricalTrends(input: { brand?: string; entityLevel?: string; entityExternalId?: string; days?: number }) {
  const days = Math.min(365, Math.max(1, input.days ?? 90));
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days + 1);
  const rows = await prisma.metaDailyInsight.findMany({
    where: {
      date: { gte: since },
      ...(input.brand ? { brand: input.brand } : {}),
      ...(input.entityLevel ? { entityLevel: input.entityLevel } : {}),
      ...(input.entityExternalId ? { entityExternalId: input.entityExternalId } : {})
    },
    orderBy: [{ date: "asc" }, { brand: "asc" }]
  });
  return rows.map((row) => ({
    id: row.id,
    accountId: row.accountId,
    brand: row.brand,
    entityLevel: row.entityLevel,
    entityExternalId: row.entityExternalId,
    attributionSetting: row.attributionSetting,
    dataStatus: row.dataStatus,
    ...point(row)
  }));
}

export async function getMetaAdsAlerts(status = "active") {
  return prisma.metaAlert.findMany({ where: { status }, orderBy: [{ severity: "asc" }, { lastSeenAt: "desc" }], take: 250 });
}

export async function getMetaAdsRecommendations(status = "active") {
  return prisma.metaRecommendation.findMany({ where: { status }, orderBy: { updatedAt: "desc" }, take: 250 });
}

function viennaParts(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Vienna", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(value);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function nextSchedule(now: Date, match: (parts: Record<string, string>) => boolean) {
  const cursor = new Date(now);
  cursor.setUTCMinutes(0, 0, 0);
  cursor.setUTCHours(cursor.getUTCHours() + 1);
  for (let index = 0; index < 24 * 370; index += 1) {
    if (match(viennaParts(cursor))) return cursor.toISOString();
    cursor.setUTCHours(cursor.getUTCHours() + 1);
  }
  return null;
}

export async function getMetaAdsMonitoring(now = new Date()) {
  const [runs, locks] = await Promise.all([
    prisma.metaSyncRun.findMany({ orderBy: { startedAt: "desc" }, take: 100 }),
    prisma.metaJobLock.findMany({ orderBy: { lockedAt: "desc" } })
  ]);
  const latest = runs[0] ?? null;
  return {
    configuration: metaAdsConfigurationStatus(),
    healthy: Boolean(latest?.status === "success" && latest.completedAt && now.getTime() - latest.completedAt.getTime() < 6 * 60 * 60 * 1_000),
    latest,
    runs,
    locks,
    schedule: {
      timezone: "Europe/Vienna",
      sync: "0 */3 * * *",
      dailyReport: "0 8 * * *",
      weeklyReport: "0 8 * * 1",
      monthlyReport: "0 8 1 * *",
      next: {
        sync: nextSchedule(now, (parts) => parts.minute === "00" && Number(parts.hour) % 3 === 0),
        dailyReport: nextSchedule(now, (parts) => parts.minute === "00" && parts.hour === "08"),
        weeklyReport: nextSchedule(now, (parts) => parts.minute === "00" && parts.hour === "08" && parts.weekday === "Mon"),
        monthlyReport: nextSchedule(now, (parts) => parts.minute === "00" && parts.hour === "08" && parts.day === "01")
      }
    }
  };
}
