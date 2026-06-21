ALTER TABLE "Gallery"
  ADD COLUMN "galleryMode" TEXT NOT NULL DEFAULT 'full',
  ADD COLUMN "proofingStatus" TEXT NOT NULL DEFAULT 'not_opened',
  ADD COLUMN "proofingStatusUpdatedAt" TIMESTAMP(3);

CREATE INDEX "Gallery_galleryMode_idx" ON "Gallery"("galleryMode");
CREATE INDEX "Gallery_proofingStatus_idx" ON "Gallery"("proofingStatus");
