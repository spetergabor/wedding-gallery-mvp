ALTER TABLE "AlbumDesign" ADD COLUMN "sourceGalleryId" TEXT;

CREATE INDEX "AlbumDesign_sourceGalleryId_idx" ON "AlbumDesign"("sourceGalleryId");

ALTER TABLE "AlbumDesign"
  ADD CONSTRAINT "AlbumDesign_sourceGalleryId_fkey"
  FOREIGN KEY ("sourceGalleryId") REFERENCES "Gallery"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
