ALTER TABLE "Gallery" ADD COLUMN "guestUploadsEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "GalleryGuestUpload" (
  "id" TEXT NOT NULL,
  "galleryId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "r2Key" TEXT NOT NULL,
  "imageUrl" TEXT NOT NULL,
  "thumbnailUrl" TEXT NOT NULL,
  "previewUrl" TEXT NOT NULL DEFAULT '',
  "mediaType" TEXT NOT NULL DEFAULT 'image',
  "fileSize" INTEGER NOT NULL DEFAULT 0,
  "imageWidth" INTEGER NOT NULL DEFAULT 0,
  "imageHeight" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'visible',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GalleryGuestUpload_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "GalleryGuestUpload" ADD CONSTRAINT "GalleryGuestUpload_galleryId_fkey" FOREIGN KEY ("galleryId") REFERENCES "Gallery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "GalleryGuestUpload_galleryId_idx" ON "GalleryGuestUpload"("galleryId");
CREATE INDEX "GalleryGuestUpload_galleryId_status_idx" ON "GalleryGuestUpload"("galleryId", "status");
CREATE INDEX "GalleryGuestUpload_email_idx" ON "GalleryGuestUpload"("email");
CREATE INDEX "GalleryGuestUpload_createdAt_idx" ON "GalleryGuestUpload"("createdAt");
CREATE INDEX "GalleryGuestUpload_r2Key_idx" ON "GalleryGuestUpload"("r2Key");
