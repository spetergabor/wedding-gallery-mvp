import { Prisma } from "@prisma/client";
import { buildAnalytics } from "@/lib/meta-ads/analytics";
import { detectAnomalies } from "@/lib/meta-ads/anomalies";
import { generateRecommendations } from "@/lib/meta-ads/recommendations";
import { stablePayloadHash } from "@/lib/meta-ads/hash";
import { runMetaAdsSync, type MetaSyncMode } from "@/lib/meta-ads/sync";
import type { AnalyticsPoint, MetaBrand } from "@/lib/meta-ads/types";
import { prisma } from "@/lib/prisma";

const ANALYTICS_ANOMALY_TYPES = [
  "TRACKING_OR_LANDING_PAGE_GAP",
  "SPEND_WITHOUT_LEADS",
  "SPEND_SPIKE",
  "CPL_INCREASE",
  "CONVERSION_DROP",
  "CTR_DECLINE",
  "CPM_INCREASE",
  "CREATIVE_FATIGUE",
  "EFFICIENCY_IMPROVEMENT",
  "LOW_DATA_VOLUME"
];

function number(value: Prisma.Decimal | bigint | number | null) {
  return value == null ? 0 : Number(value);
}

function insightPoint(row: {
  date: Date;
  dataStatus: string;
  spend: Prisma.Decimal | null;
  impressions: bigint | null;
  reach: bigint | null;
  linkClicks: bigint | null;
  outboundClicks: bigint | null;
  landingPageViews: bigint | null;
  leads: bigint | null;
  purchases: bigint | null;
}): AnalyticsPoint {
  return {
    date: row.date,
    dataStatus: row.dataStatus,
    spend: number(row.spend),
    impressions: number(row.impressions),
    reach: number(row.reach),
    linkClicks: number(row.linkClicks),
    outboundClicks: number(row.outboundClicks),
    landingPageViews: number(row.landingPageViews),
    leads: number(row.leads),
    purchases: number(row.purchases)
  };
}

async function ensureBusinessConfigs() {
  for (const brand of ["SPETER", "IRISMOMENT"] as const) {
    await prisma.metaBusinessConfig.upsert({
      where: { brand },
      create: { brand, thresholds: { configurationStatus: "unconfigured" } },
      update: {}
    });
  }
}

async function upsertOperationalAlert(input: {
  fingerprintParts: Record<string, unknown>;
  accountId?: string;
  brand: MetaBrand;
  entityLevel?: string;
  entityExternalId?: string;
  anomalyType: string;
  severity: "CRITICAL" | "WARNING" | "OPPORTUNITY" | "INFO";
  title: string;
  evidence: Record<string, unknown>;
  possibleCause: string;
  recommendedAction: string;
  confidence: number;
  now: Date;
}) {
  const fingerprint = stablePayloadHash(input.fingerprintParts);
  return prisma.metaAlert.upsert({
    where: { fingerprint },
    create: {
      fingerprint,
      accountId: input.accountId,
      brand: input.brand,
      entityLevel: input.entityLevel,
      entityExternalId: input.entityExternalId,
      anomalyType: input.anomalyType,
      severity: input.severity,
      title: input.title,
      evidence: input.evidence as Prisma.InputJsonValue,
      possibleCause: input.possibleCause,
      recommendedAction: input.recommendedAction,
      confidence: new Prisma.Decimal(input.confidence),
      dataReliability: "high",
      detectedAt: input.now,
      lastSeenAt: input.now
    },
    update: {
      severity: input.severity,
      title: input.title,
      evidence: input.evidence as Prisma.InputJsonValue,
      possibleCause: input.possibleCause,
      recommendedAction: input.recommendedAction,
      confidence: new Prisma.Decimal(input.confidence),
      status: "active",
      resolvedAt: null,
      lastSeenAt: input.now,
      occurrenceCount: { increment: 1 }
    }
  });
}

async function evaluateOperationalState(account: { id: string; brand: string }, now: Date) {
  const brand = account.brand as MetaBrand;
  const liveFingerprints: string[] = [];
  const [rejectedAds, expiredCampaigns, snapshots] = await Promise.all([
    prisma.metaAd.findMany({
      where: { accountId: account.id, effectiveStatus: { in: ["DISAPPROVED", "WITH_ISSUES", "ERROR"] } },
      select: { externalId: true, name: true, effectiveStatus: true }
    }),
    prisma.metaCampaign.findMany({
      where: { accountId: account.id, stopTime: { lt: now }, effectiveStatus: { in: ["ACTIVE", "PAUSED"] } },
      select: { externalId: true, name: true, effectiveStatus: true, stopTime: true }
    }),
    prisma.metaEntitySnapshot.findMany({
      where: { accountId: account.id, entityLevel: { in: ["campaign", "adset"] } },
      orderBy: { capturedAt: "desc" },
      take: 500
    })
  ]);

  for (const ad of rejectedAds) {
    liveFingerprints.push(stablePayloadHash({ accountId: account.id, adId: ad.externalId, anomalyType: "REJECTED_AD" }));
    await upsertOperationalAlert({
      fingerprintParts: { accountId: account.id, adId: ad.externalId, anomalyType: "REJECTED_AD" },
      accountId: account.id, brand, entityLevel: "ad", entityExternalId: ad.externalId,
      anomalyType: "REJECTED_AD", severity: "CRITICAL", title: `Elutasított vagy hibás hirdetés: ${ad.name}`,
      evidence: { effectiveStatus: ad.effectiveStatus },
      possibleCause: "Meta szabályzati elutasítás vagy kézbesítési hiba.",
      recommendedAction: "Nyisd meg az elutasítás indokát az Ads Managerben; a rendszer nem módosítja a hirdetést.",
      confidence: 0.99, now
    });
  }

  for (const campaign of expiredCampaigns) {
    liveFingerprints.push(stablePayloadHash({ accountId: account.id, campaignId: campaign.externalId, anomalyType: "EXPIRED_EVENT_CAMPAIGN" }));
    await upsertOperationalAlert({
      fingerprintParts: { accountId: account.id, campaignId: campaign.externalId, anomalyType: "EXPIRED_EVENT_CAMPAIGN" },
      accountId: account.id, brand, entityLevel: "campaign", entityExternalId: campaign.externalId,
      anomalyType: "EXPIRED_EVENT_CAMPAIGN", severity: "WARNING", title: `Lejárt dátumú kampány még kézbesíthető: ${campaign.name}`,
      evidence: { effectiveStatus: campaign.effectiveStatus, stopTime: campaign.stopTime?.toISOString() },
      possibleCause: "Az esemény időpontja vagy a kampány zárása nincs összhangban.",
      recommendedAction: "Ellenőrizd manuálisan a kampány dátumát és üzleti relevanciáját.",
      confidence: 0.95, now
    });
  }

  const byEntity = new Map<string, typeof snapshots>();
  for (const snapshot of snapshots) {
    const key = `${snapshot.entityLevel}:${snapshot.entityExternalId}`;
    const values = byEntity.get(key) ?? [];
    if (values.length < 2) values.push(snapshot);
    byEntity.set(key, values);
  }
  for (const [key, values] of byEntity) {
    if (values.length < 2) continue;
    const current = Number(values[0].dailyBudget ?? values[0].lifetimeBudget ?? 0);
    const previous = Number(values[1].dailyBudget ?? values[1].lifetimeBudget ?? 0);
    if (current <= 0 || previous <= 0 || Math.abs(current - previous) / previous < 0.5) continue;
    await upsertOperationalAlert({
      fingerprintParts: { accountId: account.id, key, anomalyType: "BUDGET_CHANGE" },
      accountId: account.id, brand, entityLevel: values[0].entityLevel, entityExternalId: values[0].entityExternalId,
      anomalyType: "BUDGET_CHANGE", severity: "INFO", title: "Legalább 50%-os költségkeret-változás",
      evidence: { previousBudget: previous, currentBudget: current, capturedAt: values[0].capturedAt.toISOString() },
      possibleCause: "Manuális módosítás vagy kampány-életciklus változás.",
      recommendedAction: "Ellenőrizd, hogy a változás szándékos-e, majd figyeld a következő 48 óra teljesítményét.",
      confidence: 0.96, now
    });
  }
  await prisma.metaAlert.updateMany({
    where: {
      accountId: account.id,
      status: "active",
      anomalyType: { in: ["REJECTED_AD", "EXPIRED_EVENT_CAMPAIGN"] },
      ...(liveFingerprints.length ? { fingerprint: { notIn: liveFingerprints } } : {})
    },
    data: { status: "resolved", resolvedAt: now }
  });
  return rejectedAds.length + expiredCampaigns.length;
}

export async function evaluateStoredMetaAds(now = new Date()) {
  await ensureBusinessConfigs();
  const accounts = await prisma.metaAdAccount.findMany();
  const configs = await prisma.metaBusinessConfig.findMany();
  const configByBrand = new Map(configs.map((config) => [config.brand, config]));
  const evaluationStart = new Date(now);
  evaluationStart.setUTCDate(evaluationStart.getUTCDate() - 180);
  let alertCount = 0;
  let recommendationCount = 0;

  for (const account of accounts) {
    alertCount += await evaluateOperationalState(account, now);
    const entities = await prisma.metaDailyInsight.findMany({
      where: {
        accountId: account.id,
        entityLevel: "campaign",
        date: { gte: evaluationStart }
      },
      orderBy: { date: "asc" }
    });
    const grouped = new Map<string, typeof entities>();
    for (const row of entities) {
      grouped.set(row.entityExternalId, [...(grouped.get(row.entityExternalId) ?? []), row]);
    }

    for (const [entityExternalId, rows] of grouped) {
      const analytics = buildAnalytics(rows.map(insightPoint), now);
      const primaryComparison = analytics.comparisons.find((comparison) => comparison.days === 7)!;
      const anomalies = detectAnomalies(primaryComparison);
      const business = configByBrand.get(account.brand);
      const recommendations = generateRecommendations(primaryComparison, anomalies, {
        costPerLead: business?.customerAcquisitionCost == null ? null : Number(business.customerAcquisitionCost),
        costPerBooking: business?.costPerBookingTarget == null ? null : Number(business.costPerBookingTarget)
      });
      const seenAlerts: string[] = [];
      const seenRecommendations: string[] = [];

      for (const anomaly of anomalies) {
        const fingerprint = stablePayloadHash({ accountId: account.id, entityExternalId, anomalyType: anomaly.anomalyType });
        seenAlerts.push(fingerprint);
        await prisma.metaAlert.upsert({
          where: { fingerprint },
          create: {
            fingerprint,
            accountId: account.id,
            brand: account.brand,
            entityLevel: "campaign",
            entityExternalId,
            anomalyType: anomaly.anomalyType,
            severity: anomaly.severity,
            title: anomaly.title,
            evidence: anomaly.evidence as Prisma.InputJsonValue,
            possibleCause: anomaly.possibleCause,
            recommendedAction: anomaly.recommendedAction,
            confidence: new Prisma.Decimal(anomaly.confidence),
            dataReliability: anomaly.dataReliability
          },
          update: {
            severity: anomaly.severity,
            title: anomaly.title,
            evidence: anomaly.evidence as Prisma.InputJsonValue,
            possibleCause: anomaly.possibleCause,
            recommendedAction: anomaly.recommendedAction,
            confidence: new Prisma.Decimal(anomaly.confidence),
            dataReliability: anomaly.dataReliability,
            status: "active",
            resolvedAt: null,
            lastSeenAt: now,
            occurrenceCount: { increment: 1 }
          }
        });
        alertCount += 1;
      }

      await prisma.metaAlert.updateMany({
        where: {
          accountId: account.id,
          entityLevel: "campaign",
          entityExternalId,
          status: "active",
          anomalyType: { in: ANALYTICS_ANOMALY_TYPES },
          ...(seenAlerts.length ? { fingerprint: { notIn: seenAlerts } } : {})
        },
        data: { status: "resolved", resolvedAt: now }
      });

      for (const recommendation of recommendations) {
        const fingerprint = stablePayloadHash({ accountId: account.id, entityExternalId, type: recommendation.type });
        seenRecommendations.push(fingerprint);
        await prisma.metaRecommendation.upsert({
          where: { fingerprint },
          create: {
            fingerprint,
            accountId: account.id,
            brand: account.brand,
            entityLevel: "campaign",
            entityExternalId,
            type: recommendation.type,
            title: recommendation.title,
            recommendation: recommendation.recommendation,
            rationale: recommendation.rationale,
            evidence: recommendation.evidence as Prisma.InputJsonValue,
            potentialImpact: recommendation.potentialImpact,
            risk: recommendation.risk,
            confidence: new Prisma.Decimal(recommendation.confidence),
            reevaluateAt: new Date(now.getTime() + recommendation.reevaluateAfterHours * 60 * 60 * 1_000)
          },
          update: {
            title: recommendation.title,
            recommendation: recommendation.recommendation,
            rationale: recommendation.rationale,
            evidence: recommendation.evidence as Prisma.InputJsonValue,
            potentialImpact: recommendation.potentialImpact,
            risk: recommendation.risk,
            confidence: new Prisma.Decimal(recommendation.confidence),
            reevaluateAt: new Date(now.getTime() + recommendation.reevaluateAfterHours * 60 * 60 * 1_000),
            status: "active"
          }
        });
        recommendationCount += 1;
      }

      await prisma.metaRecommendation.updateMany({
        where: {
          accountId: account.id,
          entityLevel: "campaign",
          entityExternalId,
          status: "active",
          ...(seenRecommendations.length ? { fingerprint: { notIn: seenRecommendations } } : {})
        },
        data: { status: "superseded" }
      });
    }
  }

  return { accountsEvaluated: accounts.length, alertsEvaluated: alertCount, recommendationsEvaluated: recommendationCount };
}

export async function runMetaAdsPipeline(options: { mode?: MetaSyncMode; now?: Date; lookbackDays?: number } = {}) {
  const now = options.now ?? new Date();
  const sync = await runMetaAdsSync({ mode: options.mode ?? "scheduled", now, lookbackDays: options.lookbackDays });
  if (!sync.ok) {
    for (const failed of sync.accounts.filter((account) => account.status === "failed")) {
      const externalId = String(failed.accountId ?? "unknown");
      const account = await prisma.metaAdAccount.findUnique({ where: { externalId } });
      const brand = (failed.brand === "SPETER" ? "SPETER" : "IRISMOMENT") as MetaBrand;
      await upsertOperationalAlert({
        fingerprintParts: { externalId, anomalyType: "SYNC_FAILURE" },
        accountId: account?.id,
        brand,
        entityLevel: "account",
        entityExternalId: externalId,
        anomalyType: "SYNC_FAILURE",
        severity: "CRITICAL",
        title: "Sikertelen Meta Ads adatszinkronizáció",
        evidence: failed,
        possibleCause: "Lejárt token, jogosultsági hiba, rate limit vagy átmeneti Meta API-hiba.",
        recommendedAction: "Ellenőrizd a monitoring endpoint hibakódját és szükség esetén frissítsd a tokent.",
        confidence: 0.99,
        now
      });
    }
    return { ok: false, sync, evaluation: null };
  }
  for (const succeeded of sync.accounts.filter((account) => account.status === "success")) {
    const externalId = String(succeeded.accountId ?? "");
    const account = externalId ? await prisma.metaAdAccount.findUnique({ where: { externalId } }) : null;
    if (account) {
      await prisma.metaAlert.updateMany({
        where: { accountId: account.id, anomalyType: "SYNC_FAILURE", status: "active" },
        data: { status: "resolved", resolvedAt: now }
      });
    }
  }
  const evaluation = await evaluateStoredMetaAds(now);
  return { ok: true, sync, evaluation };
}

export type MetaReportKind = "daily" | "weekly" | "monthly";

export async function buildMetaAdsReport(kind: MetaReportKind, now = new Date()) {
  const days = kind === "daily" ? 1 : kind === "weekly" ? 7 : 30;
  const since = new Date(now);
  since.setUTCDate(since.getUTCDate() - days + 1);
  const [accounts, alerts, recommendations, insights] = await Promise.all([
    prisma.metaAdAccount.findMany({ select: { id: true, brand: true, name: true } }),
    prisma.metaAlert.findMany({ where: { status: "active", lastSeenAt: { gte: since } }, orderBy: [{ severity: "asc" }, { lastSeenAt: "desc" }] }),
    prisma.metaRecommendation.findMany({ where: { status: "active", updatedAt: { gte: since } }, orderBy: { updatedAt: "desc" } }),
    prisma.metaDailyInsight.findMany({ where: { entityLevel: "account", date: { gte: since } } })
  ]);
  const byAccount = accounts.map((account) => ({
    ...account,
    metrics: buildAnalytics(insights.filter((row) => row.accountId === account.id).map(insightPoint), now).comparisons.find((item) => item.days === days) ?? null
  }));
  return { kind, generatedAt: now, periodDays: days, accounts: byAccount, alerts, recommendations };
}
