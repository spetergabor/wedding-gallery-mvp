ALTER TABLE "GalleryDownloadPackage" ADD COLUMN "partIndex" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "GalleryDownloadPackage" ADD COLUMN "partCount" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "GalleryDownloadPackage" ADD COLUMN "photoOffset" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "GalleryDownloadPackage" ADD COLUMN "photoLimit" INTEGER;
ALTER TABLE "GalleryDownloadPackage" ADD COLUMN "groupId" TEXT;

CREATE INDEX "GalleryDownloadPackage_groupId_idx" ON "GalleryDownloadPackage"("groupId");
