ALTER TABLE "Gallery" ADD COLUMN "galleryDesign" TEXT NOT NULL DEFAULT 'classic';

CREATE INDEX "Gallery_galleryDesign_idx" ON "Gallery"("galleryDesign");
