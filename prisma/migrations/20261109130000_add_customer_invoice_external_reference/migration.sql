ALTER TABLE "CustomerInvoice"
ADD COLUMN "externalReference" TEXT;

CREATE UNIQUE INDEX "CustomerInvoice_adminId_externalReference_key"
ON "CustomerInvoice"("adminId", "externalReference");
