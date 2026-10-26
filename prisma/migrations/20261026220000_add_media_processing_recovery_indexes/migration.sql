-- Keep the periodic recovery query bounded and index-backed as the job table grows.
CREATE INDEX "MediaProcessingJob_status_createdAt_idx" ON "MediaProcessingJob"("status", "createdAt");
CREATE INDEX "MediaProcessingJob_status_claimedAt_idx" ON "MediaProcessingJob"("status", "claimedAt");
