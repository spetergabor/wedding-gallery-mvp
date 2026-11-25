export type Brand = "SPETER" | "IRISMOMENT";
export type ThemeMode = "system" | "dark" | "light";
export type ViewId = "overview" | "campaigns" | "ads" | "creatives" | "alerts" | "monitoring" | "settings";

export type Metrics = {
  spend: number;
  impressions: number;
  reach: number;
  linkClicks: number;
  outboundClicks: number;
  landingPageViews: number;
  leads: number;
  purchases: number;
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

export type Comparison = {
  label: string;
  days: number;
  current: Metrics;
  previous: Metrics;
  changes: Partial<Record<keyof Metrics, number | null>>;
  reliability: "high" | "medium" | "low";
  notes: string[];
};

export type BrandAnalytics = {
  brand: Brand;
  analytics: {
    comparisons: Comparison[];
    lifetime: Metrics;
    earliestDate: string | null;
    latestDate: string | null;
    lifetimeReliability: string;
  };
};

export type Account = {
  id: string;
  externalId: string;
  brand: Brand;
  name: string | null;
  currency: string | null;
  timezoneName: string | null;
  accountStatus: string | null;
  lastSyncedAt: string | null;
};

export type Campaign = {
  id: string;
  accountId: string;
  externalId: string;
  name: string;
  objective: string | null;
  status: string | null;
  effectiveStatus: string | null;
  dailyBudget: string | number | null;
  lifetimeBudget: string | number | null;
  startTime: string | null;
  stopTime: string | null;
  lastSyncedAt: string;
  account: { brand: Brand; currency: string | null };
  performance: Metrics;
  alertCount: number;
  days: number;
};

export type AdSet = {
  id: string;
  externalId: string;
  campaignExternalId: string | null;
  name: string;
  effectiveStatus: string | null;
  optimizationGoal: string | null;
  dailyBudget: string | number | null;
  lifetimeBudget: string | number | null;
  _count: { ads: number };
  performance: Metrics;
};

export type Creative = {
  id: string;
  externalId: string;
  name: string | null;
  title: string | null;
  body: string | null;
  callToActionType: string | null;
  imageUrl: string | null;
  videoId: string | null;
};

export type VideoMetrics = {
  videoPlayActions: number;
  videoThruplays: number;
  videoAverageTime: number | null;
  videoP25Views: number;
  videoP50Views: number;
  videoP75Views: number;
  videoP95Views: number;
  videoP100Views: number;
};

export type Ad = {
  id: string;
  externalId: string;
  name: string;
  effectiveStatus: string | null;
  campaignExternalId: string | null;
  campaign: { externalId: string; name: string } | null;
  adSet: { externalId: string; name: string } | null;
  creative: Creative | null;
  account: { brand: Brand; currency: string | null };
  performance: Metrics;
  video: VideoMetrics;
};

export type CreativePerformance = {
  creative: Creative | null;
  brand: Brand;
  currency: string | null;
  ads: Array<{ externalId: string; name: string; campaignExternalId: string | null; campaignName: string | null }>;
  performance: Metrics;
  video: VideoMetrics;
};

export type TrendRow = {
  id: string;
  date: string;
  dataStatus: "complete" | "provisional" | "missing";
  spend: number;
  impressions: number;
  reach: number;
  linkClicks: number;
  outboundClicks: number;
  landingPageViews: number;
  leads: number;
};

export type AlertItem = {
  id: string;
  brand: Brand;
  entityLevel: string | null;
  entityExternalId: string | null;
  anomalyType: string;
  severity: "CRITICAL" | "WARNING" | "OPPORTUNITY" | "INFO";
  title: string;
  evidence: Record<string, unknown>;
  possibleCause: string | null;
  recommendedAction: string | null;
  confidence: string | number | null;
  dataReliability: string;
  status: string;
  detectedAt: string;
  lastSeenAt: string;
};

export type Recommendation = {
  id: string;
  brand: Brand;
  entityExternalId: string | null;
  type: string;
  title: string;
  recommendation: string;
  rationale: string;
  evidence: Record<string, unknown>;
  potentialImpact: string;
  risk: string;
  confidence: string | number | null;
  status: string;
  updatedAt: string;
};

export type Placement = {
  publisherPlatform: string;
  platformPosition: string;
  impressionDevice: string;
  spend: number;
  impressions: number;
  linkClicks: number;
  outboundClicks: number;
  landingPageViews: number;
  leads: number;
  purchases: number;
  cpm: number | null;
  linkCtr: number | null;
  costPerLandingPageView: number | null;
  costPerLead: number | null;
  reach: null;
  frequency: null;
};

export type Monitoring = {
  state: string;
  healthy: boolean;
  checkedAt: string;
  database: { connected: boolean };
  metaConnection: { configured: boolean; tokenConfigured: boolean; apiVersion: string; connectedAccounts: number };
  accountMapping: { complete: boolean; stored: Array<{ externalId: string; brand: Brand; lastSyncedAt: string | null }> };
  latest: SyncRun | null;
  lastSuccessfulSync: SyncRun | null;
  lastFailedSync: SyncRun | null;
  dataFreshness: { latestSyncedAt: string | null; latestDataDate: string | null; earliestDataDate: string | null };
  activeAlerts: number;
  runs: SyncRun[];
  locks: Array<{ key: string; lockedAt: string; expiresAt: string }>;
  schedule: {
    deployedAndActive: boolean;
    timezone: string;
    next: { sync: string | null; dailyReport: string | null; weeklyReport: string | null; monthlyReport: string | null };
  };
};

export type SyncRun = {
  id: string;
  brand: Brand | null;
  mode: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  rangeStart: string | null;
  rangeEnd: string | null;
  recordsRead: number;
  recordsWritten: number;
  retryCount: number;
  errorCode: string | null;
  errorMessage: string | null;
};
