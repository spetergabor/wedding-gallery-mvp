CREATE TABLE "Lead" (
  "id" TEXT NOT NULL,
  "adminId" TEXT,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "eventType" TEXT NOT NULL DEFAULT 'wedding',
  "eventDate" TIMESTAMP(3),
  "venue" TEXT,
  "status" TEXT NOT NULL DEFAULT 'requested',
  "notes" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Lead_adminId_idx" ON "Lead"("adminId");
CREATE INDEX "Lead_status_idx" ON "Lead"("status");
CREATE INDEX "Lead_sortOrder_idx" ON "Lead"("sortOrder");
CREATE INDEX "Lead_eventDate_idx" ON "Lead"("eventDate");
CREATE INDEX "Lead_email_idx" ON "Lead"("email");

ALTER TABLE "Lead" ADD CONSTRAINT "Lead_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
