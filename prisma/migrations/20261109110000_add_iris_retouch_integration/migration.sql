ALTER TABLE "MiniSession"
ADD COLUMN "fulfillmentMode" TEXT NOT NULL DEFAULT 'gallery';

UPDATE "MiniSession"
SET "fulfillmentMode" = 'iris_direct'
WHERE "postProductionWorkflowEnabled" = false;

ALTER TABLE "MiniSessionBooking"
ADD COLUMN "irisStatus" TEXT,
ADD COLUMN "irisCheckedInAt" TIMESTAMP(3),
ADD COLUMN "irisDeliveredAt" TIMESTAMP(3),
ADD COLUMN "irisExternalClientId" TEXT,
ADD COLUMN "irisFolderName" TEXT;

CREATE TABLE "IrisRetouchIntegration" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    CONSTRAINT "IrisRetouchIntegration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IrisRetouchIntegration_adminId_key" ON "IrisRetouchIntegration"("adminId");
CREATE UNIQUE INDEX "IrisRetouchIntegration_tokenHash_key" ON "IrisRetouchIntegration"("tokenHash");
CREATE INDEX "IrisRetouchIntegration_lastUsedAt_idx" ON "IrisRetouchIntegration"("lastUsedAt");
CREATE INDEX "MiniSession_fulfillmentMode_idx" ON "MiniSession"("fulfillmentMode");
CREATE INDEX "MiniSessionBooking_irisStatus_idx" ON "MiniSessionBooking"("irisStatus");

ALTER TABLE "IrisRetouchIntegration"
ADD CONSTRAINT "IrisRetouchIntegration_adminId_fkey"
FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
