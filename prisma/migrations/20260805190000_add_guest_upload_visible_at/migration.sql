ALTER TABLE "GalleryGuestUpload"
ADD COLUMN "visibleAt" TIMESTAMP(3);

UPDATE "GalleryGuestUpload"
SET "visibleAt" = "createdAt"
WHERE "status" = 'visible';

CREATE INDEX "GalleryGuestUpload_galleryId_status_visibleAt_id_idx"
ON "GalleryGuestUpload"("galleryId", "status", "visibleAt", "id");
