-- CreateTable
CREATE TABLE "GalleryDownload" (
    "id" TEXT NOT NULL,
    "galleryId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GalleryDownload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GalleryDownload_galleryId_idx" ON "GalleryDownload"("galleryId");

-- CreateIndex
CREATE INDEX "GalleryDownload_email_idx" ON "GalleryDownload"("email");

-- AddForeignKey
ALTER TABLE "GalleryDownload" ADD CONSTRAINT "GalleryDownload_galleryId_fkey" FOREIGN KEY ("galleryId") REFERENCES "Gallery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
