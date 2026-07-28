ALTER TABLE "CustomerTask" ADD COLUMN "adminId" TEXT;

UPDATE "CustomerTask" AS task
SET "adminId" = customer."adminId"
FROM "Customer" AS customer
WHERE task."customerId" = customer."id";

ALTER TABLE "CustomerTask" ALTER COLUMN "adminId" SET NOT NULL;
ALTER TABLE "CustomerTask" ALTER COLUMN "customerId" DROP NOT NULL;
ALTER TABLE "CustomerTask" ALTER COLUMN "status" SET DEFAULT 'planned';

UPDATE "CustomerTask"
SET "status" = CASE
  WHEN "status" IN ('open', 'postponed') THEN 'planned'
  WHEN "status" IN ('done', 'cancelled') THEN 'closed'
  ELSE "status"
END;

CREATE INDEX "CustomerTask_adminId_idx" ON "CustomerTask"("adminId");

ALTER TABLE "CustomerTask"
ADD CONSTRAINT "CustomerTask_adminId_fkey"
FOREIGN KEY ("adminId") REFERENCES "Admin"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
