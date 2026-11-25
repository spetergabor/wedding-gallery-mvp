import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { stablePayloadHash } from "@/lib/meta-ads/hash";
import type { MetaBrand, MetaEntityLevel, NormalizedInsight } from "@/lib/meta-ads/types";

type JsonRecord = Record<string, unknown>;

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function decimal(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? new Prisma.Decimal(number) : null;
}

function date(value: unknown) {
  if (typeof value !== "string" || !value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export class MetaAdsRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  async hasInsights(accountId: string) {
    return (await this.db.metaDailyInsight.count({ where: { accountId }, take: 1 })) > 0;
  }

  async upsertAccount(brand: MetaBrand, externalId: string, payload: JsonRecord) {
    const now = new Date();
    return this.db.metaAdAccount.upsert({
      where: { externalId },
      create: {
        externalId,
        accountNumber: typeof payload.account_id === "string" ? payload.account_id : null,
        brand,
        name: typeof payload.name === "string" ? payload.name : null,
        currency: typeof payload.currency === "string" ? payload.currency : null,
        timezoneName: typeof payload.timezone_name === "string" ? payload.timezone_name : null,
        accountStatus: payload.account_status == null ? null : String(payload.account_status),
        disableReason: payload.disable_reason == null ? null : String(payload.disable_reason),
        lastSyncedAt: now
      },
      update: {
        brand,
        accountNumber: typeof payload.account_id === "string" ? payload.account_id : null,
        name: typeof payload.name === "string" ? payload.name : null,
        currency: typeof payload.currency === "string" ? payload.currency : null,
        timezoneName: typeof payload.timezone_name === "string" ? payload.timezone_name : null,
        accountStatus: payload.account_status == null ? null : String(payload.account_status),
        disableReason: payload.disable_reason == null ? null : String(payload.disable_reason),
        lastSyncedAt: now
      }
    });
  }

  async upsertCampaign(accountId: string, payload: JsonRecord) {
    const externalId = String(payload.id);
    const now = new Date();
    const data = {
      name: String(payload.name ?? externalId),
      objective: typeof payload.objective === "string" ? payload.objective : null,
      status: typeof payload.status === "string" ? payload.status : null,
      effectiveStatus: typeof payload.effective_status === "string" ? payload.effective_status : null,
      configuredStatus: typeof payload.configured_status === "string" ? payload.configured_status : null,
      buyingType: typeof payload.buying_type === "string" ? payload.buying_type : null,
      dailyBudget: decimal(payload.daily_budget),
      lifetimeBudget: decimal(payload.lifetime_budget),
      budgetRemaining: decimal(payload.budget_remaining),
      startTime: date(payload.start_time),
      stopTime: date(payload.stop_time),
      attributionSetting: typeof payload.attribution_setting === "string"
        ? payload.attribution_setting
        : payload.attribution_spec
          ? JSON.stringify(payload.attribution_spec)
          : null,
      rawPayload: json(payload),
      lastSyncedAt: now
    };
    const campaign = await this.db.metaCampaign.upsert({
      where: { accountId_externalId: { accountId, externalId } },
      create: { accountId, externalId, ...data },
      update: data
    });
    await this.recordSnapshot(accountId, "campaign", externalId, payload);
    return campaign;
  }

  async upsertAdSet(accountId: string, payload: JsonRecord) {
    const externalId = String(payload.id);
    const campaignExternalId = typeof payload.campaign_id === "string" ? payload.campaign_id : null;
    const campaign = campaignExternalId
      ? await this.db.metaCampaign.findUnique({ where: { accountId_externalId: { accountId, externalId: campaignExternalId } }, select: { id: true } })
      : null;
    const now = new Date();
    const data = {
      campaignId: campaign?.id ?? null,
      campaignExternalId,
      name: String(payload.name ?? externalId),
      status: typeof payload.status === "string" ? payload.status : null,
      effectiveStatus: typeof payload.effective_status === "string" ? payload.effective_status : null,
      optimizationGoal: typeof payload.optimization_goal === "string" ? payload.optimization_goal : null,
      billingEvent: typeof payload.billing_event === "string" ? payload.billing_event : null,
      bidStrategy: typeof payload.bid_strategy === "string" ? payload.bid_strategy : null,
      dailyBudget: decimal(payload.daily_budget),
      lifetimeBudget: decimal(payload.lifetime_budget),
      startTime: date(payload.start_time),
      endTime: date(payload.end_time),
      targeting: payload.targeting ? json(payload.targeting) : Prisma.JsonNull,
      promotedObject: payload.promoted_object ? json(payload.promoted_object) : Prisma.JsonNull,
      attributionSetting: typeof payload.attribution_setting === "string"
        ? payload.attribution_setting
        : payload.attribution_spec
          ? JSON.stringify(payload.attribution_spec)
          : null,
      rawPayload: json(payload),
      lastSyncedAt: now
    };
    const adSet = await this.db.metaAdSet.upsert({
      where: { accountId_externalId: { accountId, externalId } },
      create: { accountId, externalId, ...data },
      update: data
    });
    await this.recordSnapshot(accountId, "adset", externalId, payload);
    return adSet;
  }

  async upsertCreative(accountId: string, payload: JsonRecord) {
    const externalId = String(payload.id);
    const story = payload.object_story_spec as JsonRecord | undefined;
    const linkData = (story?.link_data ?? story?.video_data) as JsonRecord | undefined;
    const data = {
      name: typeof payload.name === "string" ? payload.name : null,
      title: typeof payload.title === "string" ? payload.title : typeof linkData?.name === "string" ? linkData.name : null,
      body: typeof payload.body === "string" ? payload.body : typeof linkData?.message === "string" ? linkData.message : null,
      callToActionType: typeof payload.call_to_action_type === "string"
        ? payload.call_to_action_type
        : typeof (linkData?.call_to_action as JsonRecord | undefined)?.type === "string"
          ? String((linkData?.call_to_action as JsonRecord).type)
          : null,
      imageHash: typeof payload.image_hash === "string" ? payload.image_hash : null,
      imageUrl: typeof payload.image_url === "string" ? payload.image_url : null,
      videoId: typeof payload.video_id === "string" ? payload.video_id : null,
      objectStorySpec: payload.object_story_spec ? json(payload.object_story_spec) : Prisma.JsonNull,
      assetFeedSpec: payload.asset_feed_spec ? json(payload.asset_feed_spec) : Prisma.JsonNull,
      degreesOfFreedomSpec: payload.degrees_of_freedom_spec ? json(payload.degrees_of_freedom_spec) : Prisma.JsonNull,
      rawPayload: json(payload),
      lastSyncedAt: new Date()
    };
    const creative = await this.db.metaCreative.upsert({
      where: { accountId_externalId: { accountId, externalId } },
      create: { accountId, externalId, ...data },
      update: data
    });
    await this.recordSnapshot(accountId, "creative", externalId, payload);
    return creative;
  }

  async upsertAd(accountId: string, payload: JsonRecord) {
    const externalId = String(payload.id);
    const campaignExternalId = typeof payload.campaign_id === "string" ? payload.campaign_id : null;
    const adSetExternalId = typeof payload.adset_id === "string" ? payload.adset_id : null;
    const creativePayload = payload.creative as JsonRecord | undefined;
    const creativeExternalId = creativePayload?.id ? String(creativePayload.id) : null;
    const [campaign, adSet, creative] = await Promise.all([
      campaignExternalId
        ? this.db.metaCampaign.findUnique({ where: { accountId_externalId: { accountId, externalId: campaignExternalId } }, select: { id: true } })
        : null,
      adSetExternalId
        ? this.db.metaAdSet.findUnique({ where: { accountId_externalId: { accountId, externalId: adSetExternalId } }, select: { id: true } })
        : null,
      creativeExternalId
        ? this.db.metaCreative.findUnique({ where: { accountId_externalId: { accountId, externalId: creativeExternalId } }, select: { id: true } })
        : null
    ]);
    const data = {
      campaignId: campaign?.id ?? null,
      adSetId: adSet?.id ?? null,
      creativeId: creative?.id ?? null,
      campaignExternalId,
      adSetExternalId,
      creativeExternalId,
      name: String(payload.name ?? externalId),
      status: typeof payload.status === "string" ? payload.status : null,
      effectiveStatus: typeof payload.effective_status === "string" ? payload.effective_status : null,
      configuredStatus: typeof payload.configured_status === "string" ? payload.configured_status : null,
      trackingSpecs: payload.tracking_specs ? json(payload.tracking_specs) : Prisma.JsonNull,
      conversionSpecs: payload.conversion_specs ? json(payload.conversion_specs) : Prisma.JsonNull,
      rawPayload: json(payload),
      lastSyncedAt: new Date()
    };
    const ad = await this.db.metaAd.upsert({
      where: { accountId_externalId: { accountId, externalId } },
      create: { accountId, externalId, ...data },
      update: data
    });
    await this.recordSnapshot(accountId, "ad", externalId, payload);
    return ad;
  }

  async upsertInsight(accountId: string, brand: MetaBrand, insight: NormalizedInsight) {
    const key = {
      accountId,
      entityLevel: insight.entityLevel,
      entityExternalId: insight.entityExternalId,
      date: insight.date,
      attributionSetting: insight.attributionSetting
    };
    const data = {
      brand,
      spend: decimal(insight.spend),
      impressions: insight.impressions,
      reach: insight.reach,
      frequency: decimal(insight.frequency),
      cpm: decimal(insight.cpm),
      linkClicks: insight.linkClicks,
      outboundClicks: insight.outboundClicks,
      ctr: decimal(insight.ctr),
      outboundCtr: decimal(insight.outboundCtr),
      cpc: decimal(insight.cpc),
      landingPageViews: insight.landingPageViews,
      leads: insight.leads,
      purchases: insight.purchases,
      costPerResult: decimal(insight.costPerResult),
      videoThreeSecondViews: insight.videoThreeSecondViews,
      videoThruplays: insight.videoThruplays,
      videoAverageTime: decimal(insight.videoAverageTime),
      videoP25Views: insight.videoP25Views,
      videoP50Views: insight.videoP50Views,
      videoP75Views: insight.videoP75Views,
      videoP95Views: insight.videoP95Views,
      videoP100Views: insight.videoP100Views,
      actionValues: json(insight.actionValues),
      metricStatuses: json(insight.metricStatuses),
      dataStatus: insight.dataStatus,
      syncedAt: new Date()
    };
    return this.db.metaDailyInsight.upsert({
      where: { accountId_entityLevel_entityExternalId_date_attributionSetting: key },
      create: { ...key, ...data },
      update: data
    });
  }

  async upsertPlacementInsight(accountId: string, brand: MetaBrand, source: Record<string, unknown>, insight: NormalizedInsight) {
    const campaignExternalId = typeof source.campaign_id === "string" ? source.campaign_id : "unknown";
    const adSetExternalId = typeof source.adset_id === "string" ? source.adset_id : "unknown";
    const adExternalId = typeof source.ad_id === "string" ? source.ad_id : insight.entityExternalId;
    const publisherPlatform = typeof source.publisher_platform === "string" ? source.publisher_platform : "unknown";
    const platformPosition = typeof source.platform_position === "string" ? source.platform_position : "unknown";
    const impressionDevice = typeof source.impression_device === "string" ? source.impression_device : "unknown";
    const key = {
      accountId,
      date: insight.date,
      adExternalId,
      publisherPlatform,
      platformPosition,
      impressionDevice,
      attributionSetting: insight.attributionSetting
    };
    const data = {
      brand,
      campaignExternalId,
      adSetExternalId,
      spend: decimal(insight.spend),
      impressions: insight.impressions,
      reach: insight.reach,
      linkClicks: insight.linkClicks,
      outboundClicks: insight.outboundClicks,
      landingPageViews: insight.landingPageViews,
      leads: insight.leads,
      purchases: insight.purchases,
      videoThreeSecondViews: insight.videoThreeSecondViews,
      videoThruplays: insight.videoThruplays,
      videoP25Views: insight.videoP25Views,
      videoP50Views: insight.videoP50Views,
      videoP75Views: insight.videoP75Views,
      videoP95Views: insight.videoP95Views,
      videoP100Views: insight.videoP100Views,
      actionValues: json(insight.actionValues),
      metricStatuses: json(insight.metricStatuses),
      dataStatus: insight.dataStatus,
      syncedAt: new Date()
    };
    return this.db.metaPlacementInsight.upsert({
      where: {
        accountId_date_adExternalId_publisherPlatform_platformPosition_impressionDevice_attributionSetting: key
      },
      create: { ...key, ...data },
      update: data
    });
  }

  async recordSnapshot(accountId: string, entityLevel: MetaEntityLevel, entityExternalId: string, payload: JsonRecord) {
    const account = await this.db.metaAdAccount.findUniqueOrThrow({ where: { id: accountId }, select: { brand: true } });
    const payloadHash = stablePayloadHash(payload);
    return this.db.metaEntitySnapshot.upsert({
      where: { accountId_entityLevel_entityExternalId_payloadHash: { accountId, entityLevel, entityExternalId, payloadHash } },
      create: {
        accountId,
        brand: account.brand,
        entityLevel,
        entityExternalId,
        payloadHash,
        status: typeof payload.effective_status === "string" ? payload.effective_status : typeof payload.status === "string" ? payload.status : null,
        dailyBudget: decimal(payload.daily_budget),
        lifetimeBudget: decimal(payload.lifetime_budget),
        creativeId: typeof (payload.creative as JsonRecord | undefined)?.id === "string" ? String((payload.creative as JsonRecord).id) : null,
        payload: json(payload)
      },
      update: {}
    });
  }

  async startSyncRun(input: { accountId?: string; brand?: MetaBrand; mode: string; idempotencyKey: string; rangeStart?: Date; rangeEnd?: Date }) {
    return this.db.metaSyncRun.upsert({
      where: { idempotencyKey: input.idempotencyKey },
      create: {
        accountId: input.accountId,
        brand: input.brand,
        mode: input.mode,
        idempotencyKey: input.idempotencyKey,
        rangeStart: input.rangeStart,
        rangeEnd: input.rangeEnd
      },
      update: {
        status: "running",
        startedAt: new Date(),
        completedAt: null,
        heartbeatAt: new Date(),
        errorCode: null,
        errorMessage: null,
        retryCount: { increment: 1 }
      }
    });
  }

  async finishSyncRun(id: string, input: { status: "success" | "failed" | "skipped"; recordsRead?: number; recordsWritten?: number; errorCode?: string; errorMessage?: string; metadata?: unknown }) {
    return this.db.metaSyncRun.update({
      where: { id },
      data: {
        status: input.status,
        completedAt: new Date(),
        heartbeatAt: new Date(),
        recordsRead: input.recordsRead ?? 0,
        recordsWritten: input.recordsWritten ?? 0,
        errorCode: input.errorCode,
        errorMessage: input.errorMessage?.slice(0, 1_000),
        metadata: input.metadata ? json(input.metadata) : undefined
      }
    });
  }

  async prepareSyncRun(id: string, input: { accountId: string; rangeStart: Date; rangeEnd: Date }) {
    return this.db.metaSyncRun.update({
      where: { id },
      data: { accountId: input.accountId, rangeStart: input.rangeStart, rangeEnd: input.rangeEnd, heartbeatAt: new Date() }
    });
  }

  async acquireLock(key: string, ttlMs: number) {
    const ownerId = randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMs);
    await this.db.metaJobLock.deleteMany({ where: { key, expiresAt: { lte: now } } });
    try {
      await this.db.metaJobLock.create({ data: { key, ownerId, expiresAt } });
      return ownerId;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return null;
      }
      throw error;
    }
  }

  async releaseLock(key: string, ownerId: string) {
    await this.db.metaJobLock.deleteMany({ where: { key, ownerId } });
  }
}
