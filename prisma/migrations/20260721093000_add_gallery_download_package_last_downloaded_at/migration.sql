ALTER TABLE "GalleryDownloadPackage" ADD COLUMN "lastDownloadedAt" TIMESTAMP(3);

CREATE INDEX "GalleryDownloadPackage_lastDownloadedAt_idx" ON "GalleryDownloadPackage"("lastDownloadedAt");
