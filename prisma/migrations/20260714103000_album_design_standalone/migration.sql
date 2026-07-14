ALTER TABLE "AlbumDesign" ADD COLUMN "adminId" TEXT;

UPDATE "AlbumDesign"
SET "adminId" = "Customer"."adminId"
FROM "Customer"
WHERE "AlbumDesign"."customerId" = "Customer"."id"
  AND "AlbumDesign"."adminId" IS NULL;

ALTER TABLE "AlbumDesign" ALTER COLUMN "customerId" DROP NOT NULL;

CREATE INDEX "AlbumDesign_adminId_idx" ON "AlbumDesign"("adminId");

ALTER TABLE "AlbumDesign"
  ADD CONSTRAINT "AlbumDesign_adminId_fkey"
  FOREIGN KEY ("adminId") REFERENCES "Admin"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
