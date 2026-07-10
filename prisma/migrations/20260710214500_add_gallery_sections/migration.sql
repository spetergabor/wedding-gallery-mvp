-- CreateTable
CREATE TABLE "GallerySection" (
    "id" TEXT NOT NULL,
    "galleryId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GallerySection_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Photo" ADD COLUMN "sectionId" TEXT;

-- AlterTable
ALTER TABLE "GalleryUploadSession" ADD COLUMN "sectionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "GallerySection_galleryId_slug_key" ON "GallerySection"("galleryId", "slug");

-- CreateIndex
CREATE INDEX "GallerySection_galleryId_idx" ON "GallerySection"("galleryId");

-- CreateIndex
CREATE INDEX "GallerySection_galleryId_sortOrder_idx" ON "GallerySection"("galleryId", "sortOrder");

-- CreateIndex
CREATE INDEX "Photo_sectionId_idx" ON "Photo"("sectionId");

-- CreateIndex
CREATE INDEX "Photo_galleryId_sectionId_idx" ON "Photo"("galleryId", "sectionId");

-- CreateIndex
CREATE INDEX "GalleryUploadSession_sectionId_idx" ON "GalleryUploadSession"("sectionId");

-- AddForeignKey
ALTER TABLE "GallerySection" ADD CONSTRAINT "GallerySection_galleryId_fkey" FOREIGN KEY ("galleryId") REFERENCES "Gallery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "GallerySection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GalleryUploadSession" ADD CONSTRAINT "GalleryUploadSession_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "GallerySection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
