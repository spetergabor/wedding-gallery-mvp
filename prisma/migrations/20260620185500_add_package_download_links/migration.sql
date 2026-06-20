ALTER TABLE "GalleryDownload"
  ADD COLUMN "packageId" TEXT,
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'recorded',
  ADD COLUMN "downloadLinkSentAt" TIMESTAMP(3),
  ADD COLUMN "downloadLinkEmailError" TEXT;

ALTER TABLE "GalleryDownloadPackage"
  ADD COLUMN "scope" TEXT NOT NULL DEFAULT 'public',
  ADD COLUMN "accessToken" TEXT,
  ADD COLUMN "accessTokenExpiresAt" TIMESTAMP(3),
  ADD COLUMN "linkCreatedAt" TIMESTAMP(3);

CREATE INDEX "GalleryDownload_packageId_idx" ON "GalleryDownload"("packageId");
CREATE INDEX "GalleryDownload_status_idx" ON "GalleryDownload"("status");
CREATE INDEX "GalleryDownloadPackage_galleryId_scope_idx" ON "GalleryDownloadPackage"("galleryId", "scope");
CREATE UNIQUE INDEX "GalleryDownloadPackage_accessToken_key" ON "GalleryDownloadPackage"("accessToken");

ALTER TABLE "GalleryDownload"
  ADD CONSTRAINT "GalleryDownload_packageId_fkey"
  FOREIGN KEY ("packageId") REFERENCES "GalleryDownloadPackage"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
