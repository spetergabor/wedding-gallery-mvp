ALTER TABLE "Customer" ADD COLUMN "adminId" TEXT;
ALTER TABLE "AdminNotification" ADD COLUMN "adminId" TEXT;
ALTER TABLE "SiteSettings" ADD COLUMN "adminId" TEXT;

WITH owner AS (
  SELECT "id"
  FROM "Admin"
  WHERE "role" = 'super_admin'
  ORDER BY "createdAt" ASC
  LIMIT 1
)
UPDATE "Customer"
SET "adminId" = owner."id"
FROM owner
WHERE "Customer"."adminId" IS NULL;

WITH owner AS (
  SELECT "id"
  FROM "Admin"
  WHERE "role" = 'super_admin'
  ORDER BY "createdAt" ASC
  LIMIT 1
)
UPDATE "AdminNotification"
SET "adminId" = owner."id"
FROM owner
WHERE "AdminNotification"."adminId" IS NULL;

WITH owner AS (
  SELECT "id"
  FROM "Admin"
  WHERE "role" = 'super_admin'
  ORDER BY "createdAt" ASC
  LIMIT 1
)
UPDATE "SiteSettings"
SET "adminId" = owner."id"
FROM owner
WHERE "SiteSettings"."adminId" IS NULL;

WITH owner AS (
  SELECT "id"
  FROM "Admin"
  WHERE "role" = 'super_admin'
  ORDER BY "createdAt" ASC
  LIMIT 1
)
UPDATE "Gallery"
SET "adminId" = owner."id"
FROM owner
WHERE "Gallery"."adminId" IS NULL;

CREATE UNIQUE INDEX "SiteSettings_adminId_key" ON "SiteSettings"("adminId");
CREATE INDEX "Customer_adminId_idx" ON "Customer"("adminId");
CREATE INDEX "AdminNotification_adminId_idx" ON "AdminNotification"("adminId");
CREATE INDEX "SiteSettings_adminId_idx" ON "SiteSettings"("adminId");

ALTER TABLE "Customer" ADD CONSTRAINT "Customer_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdminNotification" ADD CONSTRAINT "AdminNotification_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SiteSettings" ADD CONSTRAINT "SiteSettings_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
