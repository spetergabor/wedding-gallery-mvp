ALTER TABLE "Gallery"
  ADD COLUMN "downloadsEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "clientWatermarkEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "clientWatermarkText" TEXT NOT NULL DEFAULT '';
