-- CreateTable
CREATE TABLE "GalleryView" (
    "id" TEXT NOT NULL,
    "galleryId" TEXT NOT NULL,
    "country" TEXT,
    "region" TEXT,
    "city" TEXT,
    "referrer" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GalleryView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GalleryView_galleryId_idx" ON "GalleryView"("galleryId");

-- CreateIndex
CREATE INDEX "GalleryView_createdAt_idx" ON "GalleryView"("createdAt");

-- CreateIndex
CREATE INDEX "GalleryView_country_idx" ON "GalleryView"("country");

-- AddForeignKey
ALTER TABLE "GalleryView" ADD CONSTRAINT "GalleryView_galleryId_fkey" FOREIGN KEY ("galleryId") REFERENCES "Gallery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
