ALTER TABLE "Photo" ADD COLUMN "processingStatus" TEXT NOT NULL DEFAULT 'ready';
ALTER TABLE "Photo" ADD COLUMN "processingError" TEXT;
ALTER TABLE "Photo" ADD COLUMN "processingRequestedAt" TIMESTAMP(3);
ALTER TABLE "Photo" ADD COLUMN "processingCompletedAt" TIMESTAMP(3);

CREATE TABLE "MediaProcessingJob" (
    "id" TEXT NOT NULL,
    "galleryId" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sourceR2Key" TEXT NOT NULL,
    "thumbnailR2Key" TEXT,
    "previewR2Key" TEXT,
    "posterR2Key" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "claimedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaProcessingJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Photo_processingStatus_idx" ON "Photo"("processingStatus");
CREATE INDEX "MediaProcessingJob_galleryId_idx" ON "MediaProcessingJob"("galleryId");
CREATE INDEX "MediaProcessingJob_photoId_idx" ON "MediaProcessingJob"("photoId");
CREATE INDEX "MediaProcessingJob_status_idx" ON "MediaProcessingJob"("status");
CREATE INDEX "MediaProcessingJob_createdAt_idx" ON "MediaProcessingJob"("createdAt");
CREATE INDEX "MediaProcessingJob_claimedAt_idx" ON "MediaProcessingJob"("claimedAt");

ALTER TABLE "MediaProcessingJob" ADD CONSTRAINT "MediaProcessingJob_galleryId_fkey" FOREIGN KEY ("galleryId") REFERENCES "Gallery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MediaProcessingJob" ADD CONSTRAINT "MediaProcessingJob_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
