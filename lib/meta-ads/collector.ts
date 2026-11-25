import { MetaGraphClient } from "@/lib/meta-ads/client";
import type { MetaEntityLevel, MetaInsightPayload } from "@/lib/meta-ads/types";

export const ACCOUNT_FIELDS = [
  "id",
  "account_id",
  "name",
  "currency",
  "timezone_name",
  "account_status",
  "disable_reason"
].join(",");

export const CAMPAIGN_FIELDS = [
  "id",
  "name",
  "objective",
  "status",
  "configured_status",
  "effective_status",
  "buying_type",
  "daily_budget",
  "lifetime_budget",
  "budget_remaining",
  "start_time",
  "stop_time"
].join(",");

export const ADSET_FIELDS = [
  "id",
  "campaign_id",
  "name",
  "status",
  "effective_status",
  "optimization_goal",
  "billing_event",
  "bid_strategy",
  "daily_budget",
  "lifetime_budget",
  "start_time",
  "end_time",
  "targeting",
  "promoted_object",
  "attribution_spec"
].join(",");

export const CREATIVE_FIELDS = [
  "id",
  "name",
  "title",
  "body",
  "call_to_action_type",
  "image_hash",
  "image_url",
  "video_id",
  "object_story_spec",
  "asset_feed_spec",
  "degrees_of_freedom_spec"
].join(",");

export const AD_FIELDS = [
  "id",
  "campaign_id",
  "adset_id",
  "name",
  "status",
  "configured_status",
  "effective_status",
  "creative{id}",
  "tracking_specs",
  "conversion_specs"
].join(",");

export const INSIGHT_FIELDS = [
  "account_id",
  "account_name",
  "campaign_id",
  "campaign_name",
  "adset_id",
  "adset_name",
  "ad_id",
  "ad_name",
  "date_start",
  "date_stop",
  "attribution_setting",
  "spend",
  "impressions",
  "reach",
  "frequency",
  "cpm",
  "inline_link_clicks",
  "outbound_clicks",
  "ctr",
  "outbound_clicks_ctr",
  "cpc",
  "actions",
  "cost_per_action_type",
  // Meta Graph API v27 exposes 3-second video plays via video_play_actions.
  // video_3_sec_watched_actions is rejected as an invalid insights field.
  "video_play_actions",
  "video_thruplay_watched_actions",
  "video_avg_time_watched_actions",
  "video_p25_watched_actions",
  "video_p50_watched_actions",
  "video_p75_watched_actions",
  "video_p95_watched_actions",
  "video_p100_watched_actions"
].join(",");

export class MetaAdsCollector {
  constructor(private readonly client: MetaGraphClient) {}

  getAccount(accountId: string) {
    return this.client.get<Record<string, unknown>>(accountId, { fields: ACCOUNT_FIELDS });
  }

  collectCampaigns(accountId: string) {
    return this.client.paginate<Record<string, unknown>>(`${accountId}/campaigns`, { fields: CAMPAIGN_FIELDS, limit: 100 });
  }

  collectAdSets(accountId: string) {
    return this.client.paginate<Record<string, unknown>>(`${accountId}/adsets`, { fields: ADSET_FIELDS, limit: 100 });
  }

  collectCreatives(accountId: string) {
    return this.client.paginate<Record<string, unknown>>(`${accountId}/adcreatives`, { fields: CREATIVE_FIELDS, limit: 100 });
  }

  collectAds(accountId: string) {
    return this.client.paginate<Record<string, unknown>>(`${accountId}/ads`, { fields: AD_FIELDS, limit: 100 });
  }

  collectInsights(accountId: string, level: Exclude<MetaEntityLevel, "creative">, since: Date, until: Date) {
    return this.client.paginate<MetaInsightPayload>(`${accountId}/insights`, {
      fields: INSIGHT_FIELDS,
      level,
      time_increment: 1,
      time_range: JSON.stringify({
        since: since.toISOString().slice(0, 10),
        until: until.toISOString().slice(0, 10)
      }),
      limit: 100
    });
  }

  collectPlacementInsights(accountId: string, since: Date, until: Date) {
    return this.client.paginate<MetaInsightPayload>(`${accountId}/insights`, {
      fields: INSIGHT_FIELDS,
      level: "ad",
      breakdowns: "publisher_platform,platform_position,impression_device",
      time_increment: 1,
      time_range: JSON.stringify({
        since: since.toISOString().slice(0, 10),
        until: until.toISOString().slice(0, 10)
      }),
      limit: 100
    });
  }
}
