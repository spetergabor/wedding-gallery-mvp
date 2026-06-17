ALTER TABLE "GalleryFavoriteList" ADD COLUMN "name" TEXT NOT NULL DEFAULT 'Favoriten';

DROP INDEX "GalleryFavoriteList_galleryId_email_key";

CREATE UNIQUE INDEX "GalleryFavoriteList_galleryId_email_name_key" ON "GalleryFavoriteList"("galleryId", "email", "name");
