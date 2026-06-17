CREATE TABLE "GalleryUploadSession" (
    "id" TEXT NOT NULL,
    "galleryId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "uploadedCount" INTEGER NOT NULL DEFAULT 0,
    "completedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "baseSortOrder" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GalleryUploadSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GalleryUploadItem" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "r2Key" TEXT,
    "imageUrl" TEXT,
    "thumbnailUrl" TEXT,
    "fileSize" INTEGER NOT NULL DEFAULT 0,
    "imageWidth" INTEGER NOT NULL DEFAULT 0,
    "imageHeight" INTEGER NOT NULL DEFAULT 0,
    "capturedAt" TIMESTAMP(3),
    "originalIndex" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "uploadedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GalleryUploadItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GalleryUploadSession_galleryId_idx" ON "GalleryUploadSession"("galleryId");
CREATE INDEX "GalleryUploadSession_status_idx" ON "GalleryUploadSession"("status");
CREATE INDEX "GalleryUploadSession_createdAt_idx" ON "GalleryUploadSession"("createdAt");

CREATE UNIQUE INDEX "GalleryUploadItem_sessionId_clientId_key" ON "GalleryUploadItem"("sessionId", "clientId");
CREATE INDEX "GalleryUploadItem_sessionId_idx" ON "GalleryUploadItem"("sessionId");
CREATE INDEX "GalleryUploadItem_status_idx" ON "GalleryUploadItem"("status");
CREATE INDEX "GalleryUploadItem_filename_idx" ON "GalleryUploadItem"("filename");

ALTER TABLE "GalleryUploadSession" ADD CONSTRAINT "GalleryUploadSession_galleryId_fkey" FOREIGN KEY ("galleryId") REFERENCES "Gallery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GalleryUploadItem" ADD CONSTRAINT "GalleryUploadItem_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GalleryUploadSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
