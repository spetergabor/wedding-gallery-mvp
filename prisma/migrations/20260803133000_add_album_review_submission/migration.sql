ALTER TABLE "AlbumReview"
ADD COLUMN "submittedAt" TIMESTAMP(3);

CREATE INDEX "AlbumReview_submittedAt_idx" ON "AlbumReview"("submittedAt");
