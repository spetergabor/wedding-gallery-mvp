-- CreateTable
CREATE TABLE "DeliveryLog" (
  "id" TEXT NOT NULL,
  "adminId" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "recipient" TEXT,
  "subject" TEXT,
  "provider" TEXT,
  "providerMessageId" TEXT,
  "entityType" TEXT,
  "entityId" TEXT,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "lastError" TEXT,
  "nextAttemptAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DeliveryLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeliveryLog_adminId_createdAt_idx" ON "DeliveryLog"("adminId", "createdAt");

-- CreateIndex
CREATE INDEX "DeliveryLog_adminId_status_idx" ON "DeliveryLog"("adminId", "status");

-- CreateIndex
CREATE INDEX "DeliveryLog_channel_status_idx" ON "DeliveryLog"("channel", "status");

-- CreateIndex
CREATE INDEX "DeliveryLog_entityType_entityId_idx" ON "DeliveryLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "DeliveryLog_type_idx" ON "DeliveryLog"("type");

-- CreateIndex
CREATE INDEX "DeliveryLog_nextAttemptAt_idx" ON "DeliveryLog"("nextAttemptAt");

-- AddForeignKey
ALTER TABLE "DeliveryLog" ADD CONSTRAINT "DeliveryLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
