ALTER TABLE "Gallery"
ADD COLUMN "guestUploadModerationMode" TEXT NOT NULL DEFAULT 'automatic',
ADD COLUMN "guestUploadLimit" INTEGER NOT NULL DEFAULT 1000;

ALTER TABLE "GalleryGuestUpload"
ALTER COLUMN "email" DROP NOT NULL,
ADD COLUMN "guestName" TEXT,
ADD COLUMN "guestKey" TEXT,
ADD COLUMN "processingStatus" TEXT NOT NULL DEFAULT 'ready',
ADD COLUMN "processingError" TEXT,
ADD COLUMN "processingRequestedAt" TIMESTAMP(3),
ADD COLUMN "processingCompletedAt" TIMESTAMP(3);

ALTER TABLE "MediaProcessingJob"
ALTER COLUMN "photoId" DROP NOT NULL,
ADD COLUMN "guestUploadId" TEXT;

ALTER TABLE "MediaProcessingJob"
ADD CONSTRAINT "MediaProcessingJob_guestUploadId_fkey"
FOREIGN KEY ("guestUploadId") REFERENCES "GalleryGuestUpload"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "GalleryGuestUpload_guestKey_idx" ON "GalleryGuestUpload"("guestKey");
CREATE INDEX "GalleryGuestUpload_processingStatus_idx" ON "GalleryGuestUpload"("processingStatus");
CREATE INDEX "MediaProcessingJob_guestUploadId_idx" ON "MediaProcessingJob"("guestUploadId");
