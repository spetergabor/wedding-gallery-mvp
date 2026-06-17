CREATE TABLE "GalleryDownloadPackage" (
    "id" TEXT NOT NULL,
    "galleryId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "photoCount" INTEGER NOT NULL DEFAULT 0,
    "fileSize" INTEGER NOT NULL DEFAULT 0,
    "r2Key" TEXT,
    "downloadUrl" TEXT,
    "errorMessage" TEXT,
    "generatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GalleryDownloadPackage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GalleryDownloadPackage_galleryId_idx" ON "GalleryDownloadPackage"("galleryId");
CREATE INDEX "GalleryDownloadPackage_status_idx" ON "GalleryDownloadPackage"("status");
CREATE INDEX "GalleryDownloadPackage_generatedAt_idx" ON "GalleryDownloadPackage"("generatedAt");

ALTER TABLE "GalleryDownloadPackage" ADD CONSTRAINT "GalleryDownloadPackage_galleryId_fkey" FOREIGN KEY ("galleryId") REFERENCES "Gallery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
