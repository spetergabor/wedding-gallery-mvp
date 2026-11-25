-- Phase 1: read-only Meta Ads intelligence persistence.
CREATE TABLE "MetaAdAccount" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "accountNumber" TEXT,
    "brand" TEXT NOT NULL,
    "name" TEXT,
    "currency" TEXT,
    "timezoneName" TEXT,
    "accountStatus" TEXT,
    "disableReason" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MetaAdAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MetaCampaign" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "objective" TEXT,
    "status" TEXT,
    "effectiveStatus" TEXT,
    "buyingType" TEXT,
    "dailyBudget" DECIMAL(18,6),
    "lifetimeBudget" DECIMAL(18,6),
    "budgetRemaining" DECIMAL(18,6),
    "startTime" TIMESTAMP(3),
    "stopTime" TIMESTAMP(3),
    "configuredStatus" TEXT,
    "attributionSetting" TEXT,
    "rawPayload" JSONB,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MetaCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MetaAdSet" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "campaignId" TEXT,
    "externalId" TEXT NOT NULL,
    "campaignExternalId" TEXT,
    "name" TEXT NOT NULL,
    "status" TEXT,
    "effectiveStatus" TEXT,
    "optimizationGoal" TEXT,
    "billingEvent" TEXT,
    "bidStrategy" TEXT,
    "dailyBudget" DECIMAL(18,6),
    "lifetimeBudget" DECIMAL(18,6),
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "targeting" JSONB,
    "promotedObject" JSONB,
    "attributionSetting" TEXT,
    "rawPayload" JSONB,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MetaAdSet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MetaCreative" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT,
    "title" TEXT,
    "body" TEXT,
    "callToActionType" TEXT,
    "imageHash" TEXT,
    "imageUrl" TEXT,
    "videoId" TEXT,
    "objectStorySpec" JSONB,
    "assetFeedSpec" JSONB,
    "degreesOfFreedomSpec" JSONB,
    "rawPayload" JSONB,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MetaCreative_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MetaAd" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "campaignId" TEXT,
    "adSetId" TEXT,
    "creativeId" TEXT,
    "externalId" TEXT NOT NULL,
    "campaignExternalId" TEXT,
    "adSetExternalId" TEXT,
    "creativeExternalId" TEXT,
    "name" TEXT NOT NULL,
    "status" TEXT,
    "effectiveStatus" TEXT,
    "configuredStatus" TEXT,
    "trackingSpecs" JSONB,
    "conversionSpecs" JSONB,
    "rawPayload" JSONB,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MetaAd_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MetaDailyInsight" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "entityLevel" TEXT NOT NULL,
    "entityExternalId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "attributionSetting" TEXT NOT NULL DEFAULT 'unknown',
    "spend" DECIMAL(18,6),
    "impressions" BIGINT,
    "reach" BIGINT,
    "frequency" DECIMAL(18,6),
    "cpm" DECIMAL(18,6),
    "linkClicks" BIGINT,
    "outboundClicks" BIGINT,
    "ctr" DECIMAL(18,6),
    "outboundCtr" DECIMAL(18,6),
    "cpc" DECIMAL(18,6),
    "landingPageViews" BIGINT,
    "leads" BIGINT,
    "purchases" BIGINT,
    "costPerResult" DECIMAL(18,6),
    "videoThreeSecondViews" BIGINT,
    "videoThruplays" BIGINT,
    "videoAverageTime" DECIMAL(18,6),
    "videoP25Views" BIGINT,
    "videoP50Views" BIGINT,
    "videoP75Views" BIGINT,
    "videoP95Views" BIGINT,
    "videoP100Views" BIGINT,
    "actionValues" JSONB,
    "metricStatuses" JSONB NOT NULL,
    "dataStatus" TEXT NOT NULL DEFAULT 'complete',
    "sourceUpdatedAt" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MetaDailyInsight_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MetaEntitySnapshot" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "entityLevel" TEXT NOT NULL,
    "entityExternalId" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payloadHash" TEXT NOT NULL,
    "status" TEXT,
    "dailyBudget" DECIMAL(18,6),
    "lifetimeBudget" DECIMAL(18,6),
    "creativeId" TEXT,
    "payload" JSONB NOT NULL,
    CONSTRAINT "MetaEntitySnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MetaSyncRun" (
    "id" TEXT NOT NULL,
    "accountId" TEXT,
    "brand" TEXT,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "idempotencyKey" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "heartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rangeStart" TIMESTAMP(3),
    "rangeEnd" TIMESTAMP(3),
    "recordsRead" INTEGER NOT NULL DEFAULT 0,
    "recordsWritten" INTEGER NOT NULL DEFAULT 0,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "metadata" JSONB,
    CONSTRAINT "MetaSyncRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MetaJobLock" (
    "key" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MetaJobLock_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "MetaAlert" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "accountId" TEXT,
    "brand" TEXT NOT NULL,
    "entityLevel" TEXT,
    "entityExternalId" TEXT,
    "anomalyType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "possibleCause" TEXT,
    "recommendedAction" TEXT,
    "confidence" DECIMAL(5,4),
    "dataReliability" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "occurrenceCount" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "MetaAlert_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MetaRecommendation" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "accountId" TEXT,
    "brand" TEXT NOT NULL,
    "entityLevel" TEXT,
    "entityExternalId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "potentialImpact" TEXT NOT NULL,
    "risk" TEXT NOT NULL,
    "confidence" DECIMAL(5,4),
    "reevaluateAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MetaRecommendation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MetaBusinessConfig" (
    "id" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "qualifiedLeadDefinition" TEXT,
    "consultationDefinition" TEXT,
    "bookingDefinition" TEXT,
    "customerAcquisitionCost" DECIMAL(18,6),
    "contractValue" DECIMAL(18,6),
    "eventLocation" TEXT,
    "eventDate" TIMESTAMP(3),
    "availableAppointments" INTEGER,
    "bookedAppointments" INTEGER,
    "costPerBookingTarget" DECIMAL(18,6),
    "averageCustomerValue" DECIMAL(18,6),
    "capacityUtilizationTarget" DECIMAL(8,6),
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Vienna',
    "thresholds" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MetaBusinessConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MetaAdAccount_externalId_key" ON "MetaAdAccount"("externalId");
CREATE INDEX "MetaAdAccount_brand_idx" ON "MetaAdAccount"("brand");
CREATE INDEX "MetaAdAccount_lastSyncedAt_idx" ON "MetaAdAccount"("lastSyncedAt");
CREATE UNIQUE INDEX "MetaCampaign_accountId_externalId_key" ON "MetaCampaign"("accountId", "externalId");
CREATE INDEX "MetaCampaign_accountId_effectiveStatus_idx" ON "MetaCampaign"("accountId", "effectiveStatus");
CREATE INDEX "MetaCampaign_startTime_idx" ON "MetaCampaign"("startTime");
CREATE INDEX "MetaCampaign_stopTime_idx" ON "MetaCampaign"("stopTime");
CREATE UNIQUE INDEX "MetaAdSet_accountId_externalId_key" ON "MetaAdSet"("accountId", "externalId");
CREATE INDEX "MetaAdSet_campaignId_idx" ON "MetaAdSet"("campaignId");
CREATE INDEX "MetaAdSet_campaignExternalId_idx" ON "MetaAdSet"("campaignExternalId");
CREATE INDEX "MetaAdSet_accountId_effectiveStatus_idx" ON "MetaAdSet"("accountId", "effectiveStatus");
CREATE UNIQUE INDEX "MetaCreative_accountId_externalId_key" ON "MetaCreative"("accountId", "externalId");
CREATE INDEX "MetaCreative_accountId_videoId_idx" ON "MetaCreative"("accountId", "videoId");
CREATE INDEX "MetaCreative_accountId_imageHash_idx" ON "MetaCreative"("accountId", "imageHash");
CREATE UNIQUE INDEX "MetaAd_accountId_externalId_key" ON "MetaAd"("accountId", "externalId");
CREATE INDEX "MetaAd_campaignId_idx" ON "MetaAd"("campaignId");
CREATE INDEX "MetaAd_adSetId_idx" ON "MetaAd"("adSetId");
CREATE INDEX "MetaAd_creativeId_idx" ON "MetaAd"("creativeId");
CREATE INDEX "MetaAd_accountId_effectiveStatus_idx" ON "MetaAd"("accountId", "effectiveStatus");
CREATE UNIQUE INDEX "MetaDailyInsight_accountId_entityLevel_entityExternalId_date_attributionSetting_key" ON "MetaDailyInsight"("accountId", "entityLevel", "entityExternalId", "date", "attributionSetting");
CREATE INDEX "MetaDailyInsight_brand_date_idx" ON "MetaDailyInsight"("brand", "date");
CREATE INDEX "MetaDailyInsight_accountId_entityLevel_date_idx" ON "MetaDailyInsight"("accountId", "entityLevel", "date");
CREATE INDEX "MetaDailyInsight_entityExternalId_date_idx" ON "MetaDailyInsight"("entityExternalId", "date");
CREATE INDEX "MetaDailyInsight_dataStatus_idx" ON "MetaDailyInsight"("dataStatus");
CREATE UNIQUE INDEX "MetaEntitySnapshot_accountId_entityLevel_entityExternalId_payloadHash_key" ON "MetaEntitySnapshot"("accountId", "entityLevel", "entityExternalId", "payloadHash");
CREATE INDEX "MetaEntitySnapshot_accountId_entityLevel_entityExternalId_capturedAt_idx" ON "MetaEntitySnapshot"("accountId", "entityLevel", "entityExternalId", "capturedAt");
CREATE INDEX "MetaEntitySnapshot_brand_capturedAt_idx" ON "MetaEntitySnapshot"("brand", "capturedAt");
CREATE UNIQUE INDEX "MetaSyncRun_idempotencyKey_key" ON "MetaSyncRun"("idempotencyKey");
CREATE INDEX "MetaSyncRun_status_startedAt_idx" ON "MetaSyncRun"("status", "startedAt");
CREATE INDEX "MetaSyncRun_brand_startedAt_idx" ON "MetaSyncRun"("brand", "startedAt");
CREATE INDEX "MetaSyncRun_accountId_startedAt_idx" ON "MetaSyncRun"("accountId", "startedAt");
CREATE INDEX "MetaJobLock_expiresAt_idx" ON "MetaJobLock"("expiresAt");
CREATE UNIQUE INDEX "MetaAlert_fingerprint_key" ON "MetaAlert"("fingerprint");
CREATE INDEX "MetaAlert_brand_status_severity_idx" ON "MetaAlert"("brand", "status", "severity");
CREATE INDEX "MetaAlert_accountId_status_idx" ON "MetaAlert"("accountId", "status");
CREATE INDEX "MetaAlert_detectedAt_idx" ON "MetaAlert"("detectedAt");
CREATE INDEX "MetaAlert_lastSeenAt_idx" ON "MetaAlert"("lastSeenAt");
CREATE UNIQUE INDEX "MetaRecommendation_fingerprint_key" ON "MetaRecommendation"("fingerprint");
CREATE INDEX "MetaRecommendation_brand_status_type_idx" ON "MetaRecommendation"("brand", "status", "type");
CREATE INDEX "MetaRecommendation_accountId_status_idx" ON "MetaRecommendation"("accountId", "status");
CREATE INDEX "MetaRecommendation_reevaluateAt_idx" ON "MetaRecommendation"("reevaluateAt");
CREATE UNIQUE INDEX "MetaBusinessConfig_brand_key" ON "MetaBusinessConfig"("brand");
CREATE INDEX "MetaBusinessConfig_brand_idx" ON "MetaBusinessConfig"("brand");

ALTER TABLE "MetaCampaign" ADD CONSTRAINT "MetaCampaign_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "MetaAdAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MetaAdSet" ADD CONSTRAINT "MetaAdSet_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "MetaAdAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MetaAdSet" ADD CONSTRAINT "MetaAdSet_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MetaCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MetaCreative" ADD CONSTRAINT "MetaCreative_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "MetaAdAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MetaAd" ADD CONSTRAINT "MetaAd_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "MetaAdAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MetaAd" ADD CONSTRAINT "MetaAd_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MetaCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MetaAd" ADD CONSTRAINT "MetaAd_adSetId_fkey" FOREIGN KEY ("adSetId") REFERENCES "MetaAdSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MetaAd" ADD CONSTRAINT "MetaAd_creativeId_fkey" FOREIGN KEY ("creativeId") REFERENCES "MetaCreative"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MetaDailyInsight" ADD CONSTRAINT "MetaDailyInsight_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "MetaAdAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MetaEntitySnapshot" ADD CONSTRAINT "MetaEntitySnapshot_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "MetaAdAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MetaSyncRun" ADD CONSTRAINT "MetaSyncRun_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "MetaAdAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MetaAlert" ADD CONSTRAINT "MetaAlert_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "MetaAdAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MetaRecommendation" ADD CONSTRAINT "MetaRecommendation_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "MetaAdAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
