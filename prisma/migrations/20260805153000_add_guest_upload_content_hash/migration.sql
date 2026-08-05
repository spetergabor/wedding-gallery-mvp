ALTER TABLE "GalleryGuestUpload"
ADD COLUMN "contentHash" TEXT;

CREATE UNIQUE INDEX "GalleryGuestUpload_galleryId_contentHash_key"
ON "GalleryGuestUpload"("galleryId", "contentHash");
