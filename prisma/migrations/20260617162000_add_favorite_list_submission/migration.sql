ALTER TABLE "GalleryFavoriteList" ADD COLUMN "submittedAt" TIMESTAMP(3);

CREATE INDEX "GalleryFavoriteList_submittedAt_idx" ON "GalleryFavoriteList"("submittedAt");
