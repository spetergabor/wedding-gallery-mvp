-- CreateTable
CREATE TABLE "GalleryFavoriteList" (
    "id" TEXT NOT NULL,
    "galleryId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GalleryFavoriteList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GalleryFavoriteItem" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GalleryFavoriteItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GalleryFavoriteList_galleryId_email_key" ON "GalleryFavoriteList"("galleryId", "email");

-- CreateIndex
CREATE INDEX "GalleryFavoriteList_galleryId_idx" ON "GalleryFavoriteList"("galleryId");

-- CreateIndex
CREATE INDEX "GalleryFavoriteList_email_idx" ON "GalleryFavoriteList"("email");

-- CreateIndex
CREATE UNIQUE INDEX "GalleryFavoriteItem_listId_photoId_key" ON "GalleryFavoriteItem"("listId", "photoId");

-- CreateIndex
CREATE INDEX "GalleryFavoriteItem_photoId_idx" ON "GalleryFavoriteItem"("photoId");

-- AddForeignKey
ALTER TABLE "GalleryFavoriteList" ADD CONSTRAINT "GalleryFavoriteList_galleryId_fkey" FOREIGN KEY ("galleryId") REFERENCES "Gallery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GalleryFavoriteItem" ADD CONSTRAINT "GalleryFavoriteItem_listId_fkey" FOREIGN KEY ("listId") REFERENCES "GalleryFavoriteList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GalleryFavoriteItem" ADD CONSTRAINT "GalleryFavoriteItem_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
