-- Add an optional project layer under customers.
CREATE TABLE "CustomerProject" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "projectType" TEXT NOT NULL DEFAULT 'general',
  "status" TEXT NOT NULL DEFAULT 'planned',
  "eventDate" TIMESTAMP(3),
  "venue" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CustomerProject_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Gallery" ADD COLUMN "projectId" TEXT;
ALTER TABLE "Contract" ADD COLUMN "projectId" TEXT;
ALTER TABLE "AlbumReview" ADD COLUMN "projectId" TEXT;
ALTER TABLE "AlbumDesign" ADD COLUMN "projectId" TEXT;

CREATE INDEX "CustomerProject_customerId_idx" ON "CustomerProject"("customerId");
CREATE INDEX "CustomerProject_projectType_idx" ON "CustomerProject"("projectType");
CREATE INDEX "CustomerProject_status_idx" ON "CustomerProject"("status");
CREATE INDEX "CustomerProject_eventDate_idx" ON "CustomerProject"("eventDate");
CREATE INDEX "Gallery_projectId_idx" ON "Gallery"("projectId");
CREATE INDEX "Contract_projectId_idx" ON "Contract"("projectId");
CREATE INDEX "AlbumReview_projectId_idx" ON "AlbumReview"("projectId");
CREATE INDEX "AlbumDesign_projectId_idx" ON "AlbumDesign"("projectId");

ALTER TABLE "CustomerProject"
  ADD CONSTRAINT "CustomerProject_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Gallery"
  ADD CONSTRAINT "Gallery_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "CustomerProject"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Contract"
  ADD CONSTRAINT "Contract_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "CustomerProject"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AlbumReview"
  ADD CONSTRAINT "AlbumReview_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "CustomerProject"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AlbumDesign"
  ADD CONSTRAINT "AlbumDesign_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "CustomerProject"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
