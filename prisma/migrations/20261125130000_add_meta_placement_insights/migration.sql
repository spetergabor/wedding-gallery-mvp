-- Phase 1.1: additive placement-level intelligence storage.
CREATE TABLE "MetaPlacementInsight" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "campaignExternalId" TEXT NOT NULL,
    "adSetExternalId" TEXT NOT NULL,
    "adExternalId" TEXT NOT NULL,
    "publisherPlatform" TEXT NOT NULL,
    "platformPosition" TEXT NOT NULL,
    "impressionDevice" TEXT NOT NULL DEFAULT 'unknown',
    "attributionSetting" TEXT NOT NULL DEFAULT 'unknown',
    "spend" DECIMAL(18,6),
    "impressions" BIGINT,
    "reach" BIGINT,
    "linkClicks" BIGINT,
    "outboundClicks" BIGINT,
    "landingPageViews" BIGINT,
    "leads" BIGINT,
    "purchases" BIGINT,
    "videoThreeSecondViews" BIGINT,
    "videoThruplays" BIGINT,
    "videoP25Views" BIGINT,
    "videoP50Views" BIGINT,
    "videoP75Views" BIGINT,
    "videoP95Views" BIGINT,
    "videoP100Views" BIGINT,
    "actionValues" JSONB,
    "metricStatuses" JSONB NOT NULL,
    "dataStatus" TEXT NOT NULL DEFAULT 'complete',
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MetaPlacementInsight_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MetaPlacementInsight_accountId_date_adExternalId_publisherPlatform_platformPosition_impressionDevice_attributionSetting_key"
ON "MetaPlacementInsight"("accountId", "date", "adExternalId", "publisherPlatform", "platformPosition", "impressionDevice", "attributionSetting");
CREATE INDEX "MetaPlacementInsight_brand_date_idx" ON "MetaPlacementInsight"("brand", "date");
CREATE INDEX "MetaPlacementInsight_accountId_campaignExternalId_date_idx" ON "MetaPlacementInsight"("accountId", "campaignExternalId", "date");
CREATE INDEX "MetaPlacementInsight_accountId_adExternalId_date_idx" ON "MetaPlacementInsight"("accountId", "adExternalId", "date");
CREATE INDEX "MetaPlacementInsight_publisherPlatform_platformPosition_date_idx" ON "MetaPlacementInsight"("publisherPlatform", "platformPosition", "date");

ALTER TABLE "MetaPlacementInsight" ADD CONSTRAINT "MetaPlacementInsight_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "MetaAdAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
