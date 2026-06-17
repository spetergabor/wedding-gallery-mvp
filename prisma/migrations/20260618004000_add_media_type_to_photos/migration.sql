ALTER TABLE "Photo" ADD COLUMN "mediaType" TEXT NOT NULL DEFAULT 'image';
ALTER TABLE "GalleryUploadItem" ADD COLUMN "mediaType" TEXT NOT NULL DEFAULT 'image';

CREATE INDEX "Photo_mediaType_idx" ON "Photo"("mediaType");
