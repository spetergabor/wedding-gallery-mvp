ALTER TABLE "MiniSession"
ADD COLUMN "postProductionWorkflowEnabled" BOOLEAN NOT NULL DEFAULT true;

UPDATE "MiniSession"
SET "postProductionWorkflowEnabled" = false
WHERE "createCustomerOnBooking" = false;
