CREATE TABLE "CustomerMeeting" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "meetingType" TEXT NOT NULL DEFAULT 'consultation',
  "status" TEXT NOT NULL DEFAULT 'planned',
  "eventDate" TIMESTAMP(3) NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "location" TEXT,
  "notes" TEXT,
  "googleCalendarEventId" TEXT,
  "googleCalendarId" TEXT,
  "googleCalendarSyncedAt" TIMESTAMP(3),
  "googleCalendarSyncError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomerMeeting_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CustomerMeeting_customerId_idx" ON "CustomerMeeting"("customerId");
CREATE INDEX "CustomerMeeting_meetingType_idx" ON "CustomerMeeting"("meetingType");
CREATE INDEX "CustomerMeeting_status_idx" ON "CustomerMeeting"("status");
CREATE INDEX "CustomerMeeting_eventDate_idx" ON "CustomerMeeting"("eventDate");
CREATE INDEX "CustomerMeeting_googleCalendarEventId_idx" ON "CustomerMeeting"("googleCalendarEventId");

ALTER TABLE "CustomerMeeting"
  ADD CONSTRAINT "CustomerMeeting_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
