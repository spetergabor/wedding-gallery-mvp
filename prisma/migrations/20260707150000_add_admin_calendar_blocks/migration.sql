CREATE TABLE "AdminCalendarBlock" (
  "id" TEXT NOT NULL,
  "adminId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AdminCalendarBlock_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminCalendarBlock_adminId_idx" ON "AdminCalendarBlock"("adminId");
CREATE INDEX "AdminCalendarBlock_startsAt_idx" ON "AdminCalendarBlock"("startsAt");
CREATE INDEX "AdminCalendarBlock_endsAt_idx" ON "AdminCalendarBlock"("endsAt");
CREATE INDEX "AdminCalendarBlock_adminId_startsAt_idx" ON "AdminCalendarBlock"("adminId", "startsAt");

ALTER TABLE "AdminCalendarBlock"
  ADD CONSTRAINT "AdminCalendarBlock_adminId_fkey"
  FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
