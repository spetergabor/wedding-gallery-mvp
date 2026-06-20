ALTER TABLE "GalleryDownloadPackage"
ALTER COLUMN "fileSize" TYPE BIGINT;

ALTER TABLE "GalleryDownloadPackage"
ADD COLUMN "processedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "processedBytes" BIGINT NOT NULL DEFAULT 0;
