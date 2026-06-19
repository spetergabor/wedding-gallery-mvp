ALTER TABLE "Admin" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'photographer';
ALTER TABLE "Admin" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "Admin" ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "Admin" ADD COLUMN "approvedById" TEXT;

UPDATE "Admin"
SET "role" = 'super_admin',
    "status" = 'approved',
    "approvedAt" = COALESCE("approvedAt", NOW())
WHERE "createdAt" = (SELECT MIN("createdAt") FROM "Admin");

UPDATE "Admin"
SET "status" = 'approved',
    "approvedAt" = COALESCE("approvedAt", NOW())
WHERE "status" = 'pending';

ALTER TABLE "Gallery" ADD COLUMN "adminId" TEXT;

CREATE INDEX "Gallery_adminId_idx" ON "Gallery"("adminId");

ALTER TABLE "Gallery" ADD CONSTRAINT "Gallery_adminId_fkey"
  FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
