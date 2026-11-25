import type {
  MetaAction,
  MetaEntityLevel,
  MetaInsightPayload,
  MetricAvailability,
  MetricStatuses,
  NormalizedInsight
} from "@/lib/meta-ads/types";

function finiteNumber(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function bigintValue(value: unknown): bigint | null {
  const number = finiteNumber(value);
  return number === null ? null : BigInt(Math.round(number));
}

export function actionValue(actions: MetaAction[] | undefined, names: string[]): number | null {
  if (!actions) {
    return null;
  }
  const accepted = new Set(names);
  let found = false;
  let sum = 0;
  for (const action of actions) {
    if (action.action_type && accepted.has(action.action_type)) {
      const value = finiteNumber(action.value);
      if (value !== null) {
        found = true;
        sum += value;
      }
    }
  }
  return found ? sum : null;
}

function availability(value: unknown, applicable = true): MetricAvailability {
  if (!applicable) {
    return "not_applicable";
  }
  return value === null || value === undefined ? "missing" : "available";
}

function entityId(payload: MetaInsightPayload, level: MetaEntityLevel) {
  const id = level === "account"
    ? payload.account_id
    : level === "campaign"
      ? payload.campaign_id
      : level === "adset"
        ? payload.adset_id
        : payload.ad_id;
  if (!id) {
    throw new Error(`Meta insight row is missing the ${level} identifier.`);
  }
  return id;
}

export function normalizeInsight(
  payload: MetaInsightPayload,
  level: Exclude<MetaEntityLevel, "creative">,
  attributionSetting = "unknown",
  now = new Date()
): NormalizedInsight {
  const landingPageViews = actionValue(payload.actions, ["landing_page_view"]);
  const leads = actionValue(payload.actions, ["lead", "offsite_conversion.fb_pixel_lead", "onsite_conversion.lead_grouped"]);
  const purchases = actionValue(payload.actions, ["purchase", "offsite_conversion.fb_pixel_purchase", "omni_purchase"]);
  const outboundClicks = actionValue(payload.outbound_clicks, ["outbound_click"]);
  const outboundCtr = actionValue(payload.outbound_clicks_ctr, ["outbound_click"]);
  const costPerLead = actionValue(payload.cost_per_action_type, ["lead", "offsite_conversion.fb_pixel_lead", "onsite_conversion.lead_grouped"]);
  const costPerPurchase = actionValue(payload.cost_per_action_type, ["purchase", "offsite_conversion.fb_pixel_purchase", "omni_purchase"]);
  const date = new Date(`${payload.date_start}T00:00:00.000Z`);
  const provisional = now.getTime() - date.getTime() < 72 * 60 * 60 * 1_000;
  const actionValues: Record<string, number> = {};
  for (const action of payload.actions ?? []) {
    const value = finiteNumber(action.value);
    if (action.action_type && value !== null) {
      actionValues[action.action_type] = value;
    }
  }

  const values = {
    spend: finiteNumber(payload.spend),
    impressions: bigintValue(payload.impressions),
    reach: bigintValue(payload.reach),
    frequency: finiteNumber(payload.frequency),
    cpm: finiteNumber(payload.cpm),
    linkClicks: bigintValue(payload.inline_link_clicks),
    outboundClicks: outboundClicks === null ? null : BigInt(Math.round(outboundClicks)),
    ctr: finiteNumber(payload.ctr),
    outboundCtr,
    cpc: finiteNumber(payload.cpc),
    landingPageViews: landingPageViews === null ? null : BigInt(Math.round(landingPageViews)),
    leads: leads === null ? null : BigInt(Math.round(leads)),
    purchases: purchases === null ? null : BigInt(Math.round(purchases)),
    costPerResult: costPerLead ?? costPerPurchase,
    videoThreeSecondViews: bigintValue(actionValue(payload.video_3_sec_watched_actions, ["video_view"])),
    videoThruplays: bigintValue(actionValue(payload.video_thruplay_watched_actions, ["video_view"])),
    videoAverageTime: actionValue(payload.video_avg_time_watched_actions, ["video_view"]),
    videoP25Views: bigintValue(actionValue(payload.video_p25_watched_actions, ["video_view"])),
    videoP50Views: bigintValue(actionValue(payload.video_p50_watched_actions, ["video_view"])),
    videoP75Views: bigintValue(actionValue(payload.video_p75_watched_actions, ["video_view"])),
    videoP95Views: bigintValue(actionValue(payload.video_p95_watched_actions, ["video_view"])),
    videoP100Views: bigintValue(actionValue(payload.video_p100_watched_actions, ["video_view"]))
  };

  const metricStatuses: MetricStatuses = {};
  for (const [key, value] of Object.entries(values)) {
    metricStatuses[key] = provisional && value !== null ? "provisional" : availability(value);
  }

  const availableMetricCount = Object.values(values).filter((value) => value !== null).length;
  const dataStatus = availableMetricCount === 0 ? "missing" : provisional ? "provisional" : "complete";

  return {
    entityLevel: level,
    entityExternalId: entityId(payload, level),
    date,
    attributionSetting,
    ...values,
    actionValues,
    metricStatuses,
    dataStatus
  };
}
