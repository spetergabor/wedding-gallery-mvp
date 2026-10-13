ALTER TABLE "SentEmailLog"
ADD COLUMN "lastEventAt" TIMESTAMP(3);

UPDATE "SentEmailLog"
SET "lastEventAt" = COALESCE("sentAt", "createdAt")
WHERE "lastEventAt" IS NULL;

CREATE TABLE "ResendWebhookEvent" (
    "id" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "providerMessageId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResendWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ResendWebhookEvent_webhookId_key" ON "ResendWebhookEvent"("webhookId");
CREATE INDEX "ResendWebhookEvent_providerMessageId_occurredAt_idx" ON "ResendWebhookEvent"("providerMessageId", "occurredAt");
CREATE INDEX "ResendWebhookEvent_type_occurredAt_idx" ON "ResendWebhookEvent"("type", "occurredAt");
