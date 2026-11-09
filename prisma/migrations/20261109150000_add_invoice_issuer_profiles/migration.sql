CREATE TABLE "InvoiceIssuerProfile" (
  "id" TEXT NOT NULL,
  "adminId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "addressLine1" TEXT NOT NULL,
  "postalCode" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "country" TEXT NOT NULL DEFAULT 'Österreich',
  "iban" TEXT NOT NULL,
  "bic" TEXT,
  "taxNumber" TEXT NOT NULL,
  "uid" TEXT,
  "invoicePrefix" TEXT NOT NULL DEFAULT 'RE',
  "invoiceCancellationPrefix" TEXT NOT NULL DEFAULT 'ST',
  "invoiceSequenceStart" INTEGER NOT NULL DEFAULT 1,
  "invoiceDueDays" INTEGER NOT NULL DEFAULT 14,
  "invoiceTaxMode" TEXT NOT NULL DEFAULT 'small_business',
  "invoiceDefaultVatRate" INTEGER NOT NULL DEFAULT 20,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InvoiceIssuerProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InvoiceIssuerProfile_adminId_label_key"
ON "InvoiceIssuerProfile"("adminId", "label");

CREATE INDEX "InvoiceIssuerProfile_adminId_isActive_idx"
ON "InvoiceIssuerProfile"("adminId", "isActive");

ALTER TABLE "InvoiceIssuerProfile"
ADD CONSTRAINT "InvoiceIssuerProfile_adminId_fkey"
FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomerInvoice"
ADD COLUMN "issuerKey" TEXT NOT NULL DEFAULT 'default';

DROP INDEX "CustomerInvoice_adminId_number_key";

CREATE UNIQUE INDEX "CustomerInvoice_adminId_issuerKey_number_key"
ON "CustomerInvoice"("adminId", "issuerKey", "number");
