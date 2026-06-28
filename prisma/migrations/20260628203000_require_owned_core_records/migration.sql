WITH fallback_owner AS (
  SELECT "id"
  FROM "Admin"
  ORDER BY
    CASE
      WHEN "role" = 'super_admin' AND "status" = 'approved' THEN 0
      WHEN "status" = 'approved' THEN 1
      WHEN "role" = 'super_admin' THEN 2
      ELSE 3
    END,
    "createdAt" ASC
  LIMIT 1
)
UPDATE "Customer"
SET "adminId" = fallback_owner."id"
FROM fallback_owner
WHERE "Customer"."adminId" IS NULL;

WITH fallback_owner AS (
  SELECT "id"
  FROM "Admin"
  ORDER BY
    CASE
      WHEN "role" = 'super_admin' AND "status" = 'approved' THEN 0
      WHEN "status" = 'approved' THEN 1
      WHEN "role" = 'super_admin' THEN 2
      ELSE 3
    END,
    "createdAt" ASC
  LIMIT 1
)
UPDATE "Gallery"
SET "adminId" = fallback_owner."id"
FROM fallback_owner
WHERE "Gallery"."adminId" IS NULL;

WITH fallback_owner AS (
  SELECT "id"
  FROM "Admin"
  ORDER BY
    CASE
      WHEN "role" = 'super_admin' AND "status" = 'approved' THEN 0
      WHEN "status" = 'approved' THEN 1
      WHEN "role" = 'super_admin' THEN 2
      ELSE 3
    END,
    "createdAt" ASC
  LIMIT 1
)
UPDATE "Lead"
SET "adminId" = fallback_owner."id"
FROM fallback_owner
WHERE "Lead"."adminId" IS NULL;

WITH fallback_owner AS (
  SELECT "id"
  FROM "Admin"
  ORDER BY
    CASE
      WHEN "role" = 'super_admin' AND "status" = 'approved' THEN 0
      WHEN "status" = 'approved' THEN 1
      WHEN "role" = 'super_admin' THEN 2
      ELSE 3
    END,
    "createdAt" ASC
  LIMIT 1
)
UPDATE "AdminNotification"
SET "adminId" = fallback_owner."id"
FROM fallback_owner
WHERE "AdminNotification"."adminId" IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Customer" WHERE "adminId" IS NULL) THEN
    RAISE EXCEPTION 'Cannot require Customer.adminId while ownerless customers exist.';
  END IF;

  IF EXISTS (SELECT 1 FROM "Gallery" WHERE "adminId" IS NULL) THEN
    RAISE EXCEPTION 'Cannot require Gallery.adminId while ownerless galleries exist.';
  END IF;

  IF EXISTS (SELECT 1 FROM "Lead" WHERE "adminId" IS NULL) THEN
    RAISE EXCEPTION 'Cannot require Lead.adminId while ownerless leads exist.';
  END IF;

  IF EXISTS (SELECT 1 FROM "AdminNotification" WHERE "adminId" IS NULL) THEN
    RAISE EXCEPTION 'Cannot require AdminNotification.adminId while ownerless notifications exist.';
  END IF;
END $$;

ALTER TABLE "Gallery" DROP CONSTRAINT IF EXISTS "Gallery_adminId_fkey";

ALTER TABLE "Customer" ALTER COLUMN "adminId" SET NOT NULL;
ALTER TABLE "Gallery" ALTER COLUMN "adminId" SET NOT NULL;
ALTER TABLE "Lead" ALTER COLUMN "adminId" SET NOT NULL;
ALTER TABLE "AdminNotification" ALTER COLUMN "adminId" SET NOT NULL;

ALTER TABLE "Gallery"
ADD CONSTRAINT "Gallery_adminId_fkey"
FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
