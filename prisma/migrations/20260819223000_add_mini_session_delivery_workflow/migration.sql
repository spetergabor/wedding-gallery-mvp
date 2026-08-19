ALTER TABLE "MiniSessionBooking"
ADD COLUMN "workflowStatus" TEXT NOT NULL DEFAULT 'shoot_scheduled',
ADD COLUMN "shootCompletedAt" TIMESTAMP(3),
ADD COLUMN "selectionSentAt" TIMESTAMP(3),
ADD COLUMN "selectionSubmittedAt" TIMESTAMP(3),
ADD COLUMN "finalDeliveredAt" TIMESTAMP(3),
ADD COLUMN "proofingGalleryId" TEXT,
ADD COLUMN "finalGalleryId" TEXT;

CREATE UNIQUE INDEX "MiniSessionBooking_proofingGalleryId_key"
ON "MiniSessionBooking"("proofingGalleryId");

CREATE UNIQUE INDEX "MiniSessionBooking_finalGalleryId_key"
ON "MiniSessionBooking"("finalGalleryId");

CREATE INDEX "MiniSessionBooking_workflowStatus_idx"
ON "MiniSessionBooking"("workflowStatus");

ALTER TABLE "MiniSessionBooking"
ADD CONSTRAINT "MiniSessionBooking_proofingGalleryId_fkey"
FOREIGN KEY ("proofingGalleryId") REFERENCES "Gallery"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MiniSessionBooking"
ADD CONSTRAINT "MiniSessionBooking_finalGalleryId_fkey"
FOREIGN KEY ("finalGalleryId") REFERENCES "Gallery"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
