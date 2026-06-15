-- AlterTable
ALTER TABLE "Gallery" ADD COLUMN     "coverPhotoId" TEXT;

-- AlterTable
ALTER TABLE "Photo" ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Photo_galleryId_sortOrder_idx" ON "Photo"("galleryId", "sortOrder");
