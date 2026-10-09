CREATE TABLE "GalleryDownloadSession" (
    "id" TEXT NOT NULL,
    "galleryId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GalleryDownloadSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GalleryPhotoDownload" (
    "id" TEXT NOT NULL,
    "galleryId" TEXT NOT NULL,
    "photoId" TEXT,
    "sessionId" TEXT,
    "purchaseId" TEXT,
    "email" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'lightbox',
    "country" TEXT,
    "region" TEXT,
    "city" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GalleryPhotoDownload_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GalleryDownloadSession_tokenHash_key" ON "GalleryDownloadSession"("tokenHash");
CREATE INDEX "GalleryDownloadSession_galleryId_email_idx" ON "GalleryDownloadSession"("galleryId", "email");
CREATE INDEX "GalleryDownloadSession_expiresAt_idx" ON "GalleryDownloadSession"("expiresAt");
CREATE INDEX "GalleryPhotoDownload_galleryId_createdAt_idx" ON "GalleryPhotoDownload"("galleryId", "createdAt");
CREATE INDEX "GalleryPhotoDownload_photoId_createdAt_idx" ON "GalleryPhotoDownload"("photoId", "createdAt");
CREATE INDEX "GalleryPhotoDownload_sessionId_createdAt_idx" ON "GalleryPhotoDownload"("sessionId", "createdAt");
CREATE INDEX "GalleryPhotoDownload_purchaseId_idx" ON "GalleryPhotoDownload"("purchaseId");
CREATE INDEX "GalleryPhotoDownload_email_idx" ON "GalleryPhotoDownload"("email");

ALTER TABLE "GalleryDownloadSession"
ADD CONSTRAINT "GalleryDownloadSession_galleryId_fkey"
FOREIGN KEY ("galleryId") REFERENCES "Gallery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GalleryPhotoDownload"
ADD CONSTRAINT "GalleryPhotoDownload_galleryId_fkey"
FOREIGN KEY ("galleryId") REFERENCES "Gallery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GalleryPhotoDownload"
ADD CONSTRAINT "GalleryPhotoDownload_photoId_fkey"
FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GalleryPhotoDownload"
ADD CONSTRAINT "GalleryPhotoDownload_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "GalleryDownloadSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GalleryPhotoDownload"
ADD CONSTRAINT "GalleryPhotoDownload_purchaseId_fkey"
FOREIGN KEY ("purchaseId") REFERENCES "GalleryPurchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
