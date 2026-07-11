-- AlterTable
ALTER TABLE "Gallery"
  ADD COLUMN "deliveryMode" TEXT NOT NULL DEFAULT 'free_download';

-- AlterTable
ALTER TABLE "SiteSettings"
  ADD COLUMN "galleryWatermarkEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "galleryWatermarkText" TEXT,
  ADD COLUMN "galleryWatermarkPosition" TEXT NOT NULL DEFAULT 'center',
  ADD COLUMN "galleryWatermarkOpacity" INTEGER NOT NULL DEFAULT 32;

-- CreateTable
CREATE TABLE "StripeConnectIntegration" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "stripeAccountId" TEXT NOT NULL,
    "stripeAccountEmail" TEXT,
    "country" TEXT,
    "defaultCurrency" TEXT,
    "chargesEnabled" BOOLEAN NOT NULL DEFAULT false,
    "payoutsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "detailsSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "onboardingCompletedAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StripeConnectIntegration_pkey" PRIMARY KEY ("id")
);

-- Backfill
UPDATE "Gallery"
SET "deliveryMode" = CASE
  WHEN "downloadsEnabled" = true THEN 'free_download'
  ELSE 'view_only'
END;

-- CreateIndex
CREATE UNIQUE INDEX "StripeConnectIntegration_adminId_key" ON "StripeConnectIntegration"("adminId");

-- CreateIndex
CREATE UNIQUE INDEX "StripeConnectIntegration_stripeAccountId_key" ON "StripeConnectIntegration"("stripeAccountId");

-- CreateIndex
CREATE INDEX "StripeConnectIntegration_adminId_idx" ON "StripeConnectIntegration"("adminId");

-- CreateIndex
CREATE INDEX "StripeConnectIntegration_stripeAccountId_idx" ON "StripeConnectIntegration"("stripeAccountId");

-- CreateIndex
CREATE INDEX "StripeConnectIntegration_chargesEnabled_idx" ON "StripeConnectIntegration"("chargesEnabled");

-- CreateIndex
CREATE INDEX "Gallery_deliveryMode_idx" ON "Gallery"("deliveryMode");

-- AddForeignKey
ALTER TABLE "StripeConnectIntegration" ADD CONSTRAINT "StripeConnectIntegration_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
