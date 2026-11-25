import { buildAnalytics, calculateMetrics } from "@/lib/meta-ads/analytics";
import { metaAdsConfigurationStatus } from "@/lib/meta-ads/config";
import { deriveMetaHealthState } from "@/lib/meta-ads/health";
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

function insightSince(days = 30) {
  const normalized = Math.min(365, Math.max(1, Number.isFinite(days) ? Math.floor(days) : 30));
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - normalized + 1);
  return { days: normalized, since };
}

function videoMetrics(rows: Array<{
  videoThreeSecondViews: bigint | null;
  videoThruplays: bigint | null;
  videoAverageTime: unknown;
  videoP25Views: bigint | null;
  videoP50Views: bigint | null;
  videoP75Views: bigint | null;
  videoP95Views: bigint | null;
  videoP100Views: bigint | null;
}>) {
  const sum = (key: "videoThreeSecondViews" | "videoThruplays" | "videoP25Views" | "videoP50Views" | "videoP75Views" | "videoP95Views" | "videoP100Views") =>
    rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
  const averageTimes = rows.map((row) => Number(row.videoAverageTime)).filter(Number.isFinite);
  return {
    videoPlayActions: sum("videoThreeSecondViews"),
    videoThruplays: sum("videoThruplays"),
    videoAverageTime: averageTimes.length ? averageTimes.reduce((total, value) => total + value, 0) / averageTimes.length : null,
    videoP25Views: sum("videoP25Views"),
    videoP50Views: sum("videoP50Views"),
    videoP75Views: sum("videoP75Views"),
    videoP95Views: sum("videoP95Views"),
    videoP100Views: sum("videoP100Views")
  };
}

export async function getMetaCampaignPerformance(brand?: string, requestedDays = 30) {
  const { days, since } = insightSince(requestedDays);
  const [campaigns, insights, alerts] = await Promise.all([
    prisma.metaCampaign.findMany({
      where: brand ? { account: { brand } } : undefined,
      include: { account: { select: { brand: true, currency: true } } },
      orderBy: { lastSyncedAt: "desc" }
    }),
    prisma.metaDailyInsight.findMany({ where: { entityLevel: "campaign", date: { gte: since }, ...(brand ? { brand } : {}) } }),
    prisma.metaAlert.findMany({ where: { status: "active", entityLevel: "campaign", ...(brand ? { brand } : {}) }, select: { entityExternalId: true } })
  ]);
  return campaigns.map((campaign) => ({
    ...campaign,
    days,
    alertCount: alerts.filter((alert) => alert.entityExternalId === campaign.externalId).length,
    performance: calculateMetrics(insights.filter((row) => row.accountId === campaign.accountId && row.entityExternalId === campaign.externalId).map(point))
  }));
}

export async function getMetaCreativePerformance(brand?: string, requestedDays = 30) {
  const { days, since } = insightSince(requestedDays);
  const ads = await prisma.metaAd.findMany({
    where: { creativeId: { not: null }, ...(brand ? { account: { brand } } : {}) },
    include: {
      creative: true,
      campaign: { select: { externalId: true, name: true } },
      account: { select: { brand: true, currency: true } }
    }
  });
  const insights = await prisma.metaDailyInsight.findMany({ where: { entityLevel: "ad", date: { gte: since }, ...(brand ? { brand } : {}) } });
  const grouped = new Map<string, {
    creative: (typeof ads)[number]["creative"];
    brand: string;
    currency: string | null;
    rows: typeof insights;
    ads: Array<{ externalId: string; name: string; campaignExternalId: string | null; campaignName: string | null }>;
  }>();
  for (const ad of ads) {
    if (!ad.creativeId) continue;
    const entry = grouped.get(ad.creativeId) ?? { creative: ad.creative, brand: ad.account.brand, currency: ad.account.currency, rows: [], ads: [] };
    entry.ads.push({ externalId: ad.externalId, name: ad.name, campaignExternalId: ad.campaignExternalId, campaignName: ad.campaign?.name ?? null });
    entry.rows.push(...insights.filter((row) => row.accountId === ad.accountId && row.entityExternalId === ad.externalId));
    grouped.set(ad.creativeId, entry);
  }
  return [...grouped.values()].map((entry) => ({
    ...entry,
    days,
    performance: calculateMetrics(entry.rows.map(point)),
    video: videoMetrics(entry.rows),
    rows: undefined
  }));
}

export async function getMetaAdPerformance(input: { brand?: string; campaignExternalId?: string; days?: number }) {
  const { days, since } = insightSince(input.days);
  const ads = await prisma.metaAd.findMany({
    where: {
      ...(input.brand ? { account: { brand: input.brand } } : {}),
      ...(input.campaignExternalId ? { campaignExternalId: input.campaignExternalId } : {})
    },
    include: {
      account: { select: { brand: true, currency: true } },
      campaign: { select: { externalId: true, name: true } },
      adSet: { select: { externalId: true, name: true } },
      creative: true
    },
    orderBy: { lastSyncedAt: "desc" }
  });
  const insights = await prisma.metaDailyInsight.findMany({
    where: { entityLevel: "ad", date: { gte: since }, ...(input.brand ? { brand: input.brand } : {}) }
  });
  return ads.map((ad) => {
    const rows = insights.filter((row) => row.accountId === ad.accountId && row.entityExternalId === ad.externalId);
    return { ...ad, days, performance: calculateMetrics(rows.map(point)), video: videoMetrics(rows) };
  });
}

export async function getMetaAdSetPerformance(input: { brand?: string; campaignExternalId?: string; days?: number }) {
  const { days, since } = insightSince(input.days);
  const adSets = await prisma.metaAdSet.findMany({
    where: {
      ...(input.brand ? { account: { brand: input.brand } } : {}),
      ...(input.campaignExternalId ? { campaignExternalId: input.campaignExternalId } : {})
    },
    include: {
      account: { select: { brand: true, currency: true } },
      campaign: { select: { externalId: true, name: true } },
      _count: { select: { ads: true } }
    },
    orderBy: { lastSyncedAt: "desc" }
  });
  const insights = await prisma.metaDailyInsight.findMany({
    where: { entityLevel: "adset", date: { gte: since }, ...(input.brand ? { brand: input.brand } : {}) }
  });
  return adSets.map((adSet) => ({
    ...adSet,
    days,
    performance: calculateMetrics(insights.filter((row) => row.accountId === adSet.accountId && row.entityExternalId === adSet.externalId).map(point))
  }));
}

export async function getMetaPlacementPerformance(input: { brand?: string; campaignExternalId?: string; days?: number }) {
  const days = Math.min(180, Math.max(1, Number.isFinite(input.days) ? input.days! : 30));
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days + 1);
  const rows = await prisma.metaPlacementInsight.findMany({
    where: {
      date: { gte: since },
      ...(input.brand ? { brand: input.brand } : {}),
      ...(input.campaignExternalId ? { campaignExternalId: input.campaignExternalId } : {})
    }
  });
  const grouped = new Map<string, { publisherPlatform: string; platformPosition: string; impressionDevice: string; spend: number; impressions: number; linkClicks: number; outboundClicks: number; landingPageViews: number; leads: number; purchases: number }>();
  for (const row of rows) {
    const key = `${row.publisherPlatform}|${row.platformPosition}|${row.impressionDevice}`;
    const value = grouped.get(key) ?? { publisherPlatform: row.publisherPlatform, platformPosition: row.platformPosition, impressionDevice: row.impressionDevice, spend: 0, impressions: 0, linkClicks: 0, outboundClicks: 0, landingPageViews: 0, leads: 0, purchases: 0 };
    value.spend += Number(row.spend ?? 0);
    value.impressions += Number(row.impressions ?? 0);
    value.linkClicks += Number(row.linkClicks ?? 0);
    value.outboundClicks += Number(row.outboundClicks ?? 0);
    value.landingPageViews += Number(row.landingPageViews ?? 0);
    value.leads += Number(row.leads ?? 0);
    value.purchases += Number(row.purchases ?? 0);
    grouped.set(key, value);
  }
  const placements = [...grouped.values()].map((row) => ({
    ...row,
    cpm: row.impressions ? row.spend / row.impressions * 1_000 : null,
    linkCtr: row.impressions ? row.linkClicks / row.impressions * 100 : null,
    costPerLandingPageView: row.landingPageViews ? row.spend / row.landingPageViews : null,
    costPerLead: row.leads ? row.spend / row.leads : null,
    reach: null,
    frequency: null
  })).sort((a, b) => b.spend - a.spend);
  return { days, placements, caveats: ["Reach and frequency are intentionally not summed across placement breakdown rows.", "Creative format remains unclassified unless verified asset metadata is available."] };
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
  let databaseConnected = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    databaseConnected = true;
  } catch {
    databaseConnected = false;
  }
  const configuration = metaAdsConfigurationStatus();
  const [runs, locks, storedAccounts, dataRange, activeAlerts, businessConfigs] = databaseConnected
    ? await Promise.all([
      prisma.metaSyncRun.findMany({ orderBy: { startedAt: "desc" }, take: 100 }),
      prisma.metaJobLock.findMany({ orderBy: { lockedAt: "desc" } }),
      prisma.metaAdAccount.findMany({ select: { id: true, externalId: true, brand: true, lastSyncedAt: true } }),
      prisma.metaDailyInsight.aggregate({ _min: { date: true }, _max: { date: true, syncedAt: true } }),
      prisma.metaAlert.count({ where: { status: "active" } }),
      prisma.metaBusinessConfig.findMany()
    ])
    : [[], [], [], { _min: { date: null }, _max: { date: null, syncedAt: null } }, 0, []];
  const latest = runs[0] ?? null;
  const lastSuccess = runs.find((run) => run.status === "success") ?? null;
  const lastFailure = runs.find((run) => run.status === "failed") ?? null;
  const mappedIds = new Set(configuration.accounts.map((account) => account.accountId));
  const storedIds = new Set(storedAccounts.map((account) => account.externalId));
  const mappingsComplete = mappedIds.size > 0 && mappedIds.size === storedIds.size && [...mappedIds].every((id) => storedIds.has(id));
  const missingBusinessConfiguration = ["SPETER", "IRISMOMENT"].flatMap((brand) => {
    const config = businessConfigs.find((item) => item.brand === brand);
    if (!config) return [`${brand}:all`];
    const missing: string[] = [];
    if (brand === "SPETER") {
      if (!config.qualifiedLeadDefinition) missing.push("qualifiedLeadDefinition");
      if (!config.consultationDefinition) missing.push("consultationDefinition");
      if (!config.bookingDefinition) missing.push("bookingDefinition");
      if (config.customerAcquisitionCost == null) missing.push("customerAcquisitionCost");
      if (config.contractValue == null) missing.push("contractValue");
    } else {
      if (!config.eventLocation) missing.push("eventLocation");
      if (!config.eventDate) missing.push("eventDate");
      if (config.availableAppointments == null) missing.push("availableAppointments");
      if (config.bookedAppointments == null) missing.push("bookedAppointments");
      if (config.costPerBookingTarget == null) missing.push("costPerBookingTarget");
      if (config.averageCustomerValue == null) missing.push("averageCustomerValue");
    }
    return missing.map((field) => `${brand}:${field}`);
  });
  const schedulesActive = process.env.META_ADS_SCHEDULES_ACTIVE === "true" && Boolean(process.env.TRIGGER_SECRET_KEY);
  const state = deriveMetaHealthState({
    databaseConnected,
    configured: configuration.configured,
    connectedAccounts: storedAccounts.length,
    syncing: locks.some((lock) => lock.key === "meta-ads:sync" && lock.expiresAt > now),
    lastSuccessAt: lastSuccess?.completedAt ?? null,
    lastFailureAt: lastFailure?.completedAt ?? lastFailure?.startedAt ?? null,
    latestDataAt: dataRange._max.syncedAt,
    mappingsComplete,
    schedulesActive,
    now
  });
  return {
    state,
    healthy: state === "HEALTHY",
    checkedAt: now,
    database: { connected: databaseConnected },
    metaConnection: {
      configured: configuration.configured,
      tokenConfigured: configuration.tokenConfigured,
      apiVersion: configuration.apiVersion,
      connectedAccounts: storedAccounts.length
    },
    accountMapping: {
      configured: configuration.accounts,
      stored: storedAccounts.map((account) => ({ externalId: account.externalId, brand: account.brand, lastSyncedAt: account.lastSyncedAt })),
      complete: mappingsComplete
    },
    configuration,
    latest,
    lastSuccessfulSync: lastSuccess,
    lastFailedSync: lastFailure,
    dataFreshness: {
      latestSyncedAt: dataRange._max.syncedAt,
      latestDataDate: dataRange._max.date,
      earliestDataDate: dataRange._min.date
    },
    activeAlerts,
    missingBusinessConfiguration,
    runs,
    locks,
    schedule: {
      deployedAndActive: schedulesActive,
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
