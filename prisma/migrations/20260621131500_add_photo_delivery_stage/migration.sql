ALTER TABLE "Photo"
  ADD COLUMN "deliveryStage" TEXT NOT NULL DEFAULT 'final';

ALTER TABLE "GalleryUploadSession"
  ADD COLUMN "deliveryStage" TEXT NOT NULL DEFAULT 'final';

ALTER TABLE "GalleryUploadItem"
  ADD COLUMN "deliveryStage" TEXT NOT NULL DEFAULT 'final';

UPDATE "Photo"
SET "deliveryStage" = 'raw'
FROM "Gallery"
WHERE "Photo"."galleryId" = "Gallery"."id"
  AND "Gallery"."galleryMode" = 'proofing';

CREATE INDEX "Photo_galleryId_deliveryStage_idx" ON "Photo"("galleryId", "deliveryStage");
