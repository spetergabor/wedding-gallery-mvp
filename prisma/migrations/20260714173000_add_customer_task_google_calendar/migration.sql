ALTER TABLE "CustomerTask"
ADD COLUMN "googleCalendarEventId" TEXT,
ADD COLUMN "googleCalendarId" TEXT,
ADD COLUMN "googleCalendarSyncedAt" TIMESTAMP(3),
ADD COLUMN "googleCalendarSyncError" TEXT;

CREATE INDEX "CustomerTask_googleCalendarEventId_idx" ON "CustomerTask"("googleCalendarEventId");
