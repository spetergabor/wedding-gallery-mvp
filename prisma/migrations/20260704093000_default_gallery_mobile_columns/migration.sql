-- AlterTable
UPDATE "Gallery"
SET "publicColumnCount" = 1
WHERE "publicColumnCount" = 3;

ALTER TABLE "Gallery"
ALTER COLUMN "publicColumnCount" SET DEFAULT 1;
