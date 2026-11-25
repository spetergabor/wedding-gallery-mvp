export const META_BRANDS = ["SPETER", "IRISMOMENT"] as const;
export type MetaBrand = (typeof META_BRANDS)[number];

export const META_ENTITY_LEVELS = ["account", "campaign", "adset", "ad", "creative"] as const;
export type MetaEntityLevel = (typeof META_ENTITY_LEVELS)[number];

export type MetricAvailability = "available" | "missing" | "not_applicable" | "provisional";

export type MetricStatuses = Record<string, MetricAvailability>;

export type MetaAccountMapping = {
  brand: MetaBrand;
  accountId: string;
  name?: string;
};

export type MetaAdsRuntimeConfig = {
  accessToken: string;
  apiVersion: string;
  accounts: MetaAccountMapping[];
  requestTimeoutMs: number;
  maxRetries: number;
  recentRefreshDays: number;
};

export type GraphPage<T> = {
  data: T[];
  paging?: {
    cursors?: { before?: string; after?: string };
    next?: string;
    previous?: string;
  };
};

export type MetaAction = {
  action_type?: string;
  value?: string;
  "1d_click"?: string;
  "7d_click"?: string;
  "1d_view"?: string;
};

export type MetaInsightPayload = {
  account_id?: string;
  account_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  adset_id?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
  date_start: string;
  date_stop: string;
  attribution_setting?: string;
  publisher_platform?: string;
  platform_position?: string;
  impression_device?: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  frequency?: string;
  cpm?: string;
  inline_link_clicks?: string;
  outbound_clicks?: MetaAction[];
  ctr?: string;
  outbound_clicks_ctr?: MetaAction[];
  cpc?: string;
  actions?: MetaAction[];
  cost_per_action_type?: MetaAction[];
  video_play_actions?: MetaAction[];
  video_thruplay_watched_actions?: MetaAction[];
  video_avg_time_watched_actions?: MetaAction[];
  video_p25_watched_actions?: MetaAction[];
  video_p50_watched_actions?: MetaAction[];
  video_p75_watched_actions?: MetaAction[];
  video_p95_watched_actions?: MetaAction[];
  video_p100_watched_actions?: MetaAction[];
  [key: string]: unknown;
};

export type NormalizedInsight = {
  entityLevel: MetaEntityLevel;
  entityExternalId: string;
  date: Date;
  attributionSetting: string;
  spend: number | null;
  impressions: bigint | null;
  reach: bigint | null;
  frequency: number | null;
  cpm: number | null;
  linkClicks: bigint | null;
  outboundClicks: bigint | null;
  ctr: number | null;
  outboundCtr: number | null;
  cpc: number | null;
  landingPageViews: bigint | null;
  leads: bigint | null;
  purchases: bigint | null;
  costPerResult: number | null;
  videoThreeSecondViews: bigint | null;
  videoThruplays: bigint | null;
  videoAverageTime: number | null;
  videoP25Views: bigint | null;
  videoP50Views: bigint | null;
  videoP75Views: bigint | null;
  videoP95Views: bigint | null;
  videoP100Views: bigint | null;
  actionValues: Record<string, number>;
  metricStatuses: MetricStatuses;
  dataStatus: "complete" | "provisional" | "missing";
};

export type NumericMetrics = {
  spend: number;
  impressions: number;
  reach: number;
  linkClicks: number;
  outboundClicks: number;
  landingPageViews: number;
  leads: number;
  purchases: number;
};

export type CalculatedMetrics = NumericMetrics & {
  frequency: number | null;
  cpm: number | null;
  ctr: number | null;
  outboundCtr: number | null;
  cpc: number | null;
  costPerLandingPageView: number | null;
  costPerLead: number | null;
  costPerPurchase: number | null;
  landingPageConversionRate: number | null;
};

export type AnalyticsPoint = NumericMetrics & {
  date: Date;
  dataStatus?: string;
};

export type PeriodComparison = {
  label: string;
  days: number;
  current: CalculatedMetrics;
  previous: CalculatedMetrics;
  changes: Record<keyof CalculatedMetrics, number | null>;
  reliability: "high" | "medium" | "low";
  notes: string[];
};

export type DetectedAnomaly = {
  anomalyType: string;
  severity: "CRITICAL" | "WARNING" | "OPPORTUNITY" | "INFO";
  title: string;
  evidence: Record<string, unknown>;
  possibleCause: string;
  recommendedAction: string;
  confidence: number;
  dataReliability: "high" | "medium" | "low";
};

export type RecommendationType =
  | "SCALE"
  | "REDUCE_BUDGET"
  | "PAUSE_CANDIDATE"
  | "CREATIVE_REFRESH"
  | "CREATIVE_TEST"
  | "AUDIENCE_TEST"
  | "TRACKING_FIX"
  | "LANDING_PAGE_REVIEW"
  | "KEEP_RUNNING"
  | "INSUFFICIENT_DATA";

export type GeneratedRecommendation = {
  type: RecommendationType;
  title: string;
  recommendation: string;
  rationale: string;
  evidence: Record<string, unknown>;
  potentialImpact: string;
  risk: "low" | "medium" | "high";
  confidence: number;
  reevaluateAfterHours: number;
};
