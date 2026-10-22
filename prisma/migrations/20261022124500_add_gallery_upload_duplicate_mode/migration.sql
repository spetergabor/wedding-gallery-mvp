ALTER TABLE "GalleryUploadItem"
ADD COLUMN "duplicateMode" TEXT NOT NULL DEFAULT 'skip',
ADD COLUMN "replacePhotoId" TEXT;
