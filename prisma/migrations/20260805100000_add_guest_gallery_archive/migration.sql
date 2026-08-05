ALTER TABLE "Gallery"
ADD COLUMN "guestGalleryExpiresAt" TIMESTAMP(3),
ADD COLUMN "guestGalleryArchivedAt" TIMESTAMP(3),
ADD COLUMN "guestGalleryRevision" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "Gallery_guestGalleryExpiresAt_idx" ON "Gallery"("guestGalleryExpiresAt");
