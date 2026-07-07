CREATE TABLE "GoogleCalendarIntegration" (
  "id" TEXT NOT NULL,
  "adminId" TEXT NOT NULL,
  "googleAccountEmail" TEXT,
  "googleAccountId" TEXT,
  "calendarId" TEXT NOT NULL DEFAULT 'primary',
  "calendarSummary" TEXT,
  "accessTokenEncrypted" TEXT,
  "refreshTokenEncrypted" TEXT,
  "accessTokenExpiresAt" TIMESTAMP(3),
  "scope" TEXT,
  "syncMiniSessionBookings" BOOLEAN NOT NULL DEFAULT true,
  "syncCustomerProjects" BOOLEAN NOT NULL DEFAULT true,
  "deleteCancelledEvents" BOOLEAN NOT NULL DEFAULT true,
  "lastSyncError" TEXT,
  "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "GoogleCalendarIntegration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GoogleCalendarIntegration_adminId_key" ON "GoogleCalendarIntegration"("adminId");
CREATE INDEX "GoogleCalendarIntegration_adminId_idx" ON "GoogleCalendarIntegration"("adminId");
CREATE INDEX "GoogleCalendarIntegration_googleAccountEmail_idx" ON "GoogleCalendarIntegration"("googleAccountEmail");

ALTER TABLE "GoogleCalendarIntegration"
  ADD CONSTRAINT "GoogleCalendarIntegration_adminId_fkey"
  FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MiniSessionBooking"
  ADD COLUMN "googleCalendarEventId" TEXT,
  ADD COLUMN "googleCalendarId" TEXT,
  ADD COLUMN "googleCalendarSyncedAt" TIMESTAMP(3),
  ADD COLUMN "googleCalendarSyncError" TEXT;

CREATE INDEX "MiniSessionBooking_googleCalendarEventId_idx" ON "MiniSessionBooking"("googleCalendarEventId");

ALTER TABLE "CustomerProject"
  ADD COLUMN "googleCalendarEventId" TEXT,
  ADD COLUMN "googleCalendarId" TEXT,
  ADD COLUMN "googleCalendarSyncedAt" TIMESTAMP(3),
  ADD COLUMN "googleCalendarSyncError" TEXT;

CREATE INDEX "CustomerProject_googleCalendarEventId_idx" ON "CustomerProject"("googleCalendarEventId");
