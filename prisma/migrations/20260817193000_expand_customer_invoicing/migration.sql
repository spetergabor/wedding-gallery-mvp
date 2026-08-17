-- Extend the existing uploaded-invoice records in place. No legacy row or R2 key is removed.
ALTER TABLE "SiteSettings"
ADD COLUMN "invoiceName" TEXT,
ADD COLUMN "invoiceAddressLine1" TEXT,
ADD COLUMN "invoicePostalCode" TEXT,
ADD COLUMN "invoiceCity" TEXT,
ADD COLUMN "invoiceCountry" TEXT NOT NULL DEFAULT 'Österreich',
ADD COLUMN "invoiceIban" TEXT,
ADD COLUMN "invoiceBic" TEXT,
ADD COLUMN "invoiceTaxNumber" TEXT,
ADD COLUMN "invoiceUid" TEXT,
ADD COLUMN "invoicePrefix" TEXT NOT NULL DEFAULT 'RE',
ADD COLUMN "invoiceCancellationPrefix" TEXT NOT NULL DEFAULT 'ST',
ADD COLUMN "invoiceSequenceStart" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "invoiceDueDays" INTEGER NOT NULL DEFAULT 14,
ADD COLUMN "invoiceTaxMode" TEXT NOT NULL DEFAULT 'small_business',
ADD COLUMN "invoiceDefaultVatRate" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN "invoiceRemindersEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "invoiceReminderDaysBefore" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN "invoiceOverdueDays" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "invoiceFollowupDays" INTEGER NOT NULL DEFAULT 7;

ALTER TABLE "CustomerInvoice"
ADD COLUMN "adminId" TEXT,
ADD COLUMN "number" TEXT,
ADD COLUMN "issueDate" TIMESTAMP(3),
ADD COLUMN "serviceDateFrom" TIMESTAMP(3),
ADD COLUMN "serviceDateTo" TIMESTAMP(3),
ADD COLUMN "documentType" TEXT NOT NULL DEFAULT 'invoice',
ADD COLUMN "relatedInvoiceId" TEXT,
ADD COLUMN "taxMode" TEXT NOT NULL DEFAULT 'small_business',
ADD COLUMN "issuerSnapshot" JSONB,
ADD COLUMN "customerSnapshot" JSONB,
ADD COLUMN "taxNotice" TEXT,
ADD COLUMN "subtotalCents" INTEGER,
ADD COLUMN "taxCents" INTEGER,
ADD COLUMN "totalCents" INTEGER,
ADD COLUMN "paidCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "publicToken" TEXT,
ADD COLUMN "finalizedAt" TIMESTAMP(3),
ADD COLUMN "cancelledAt" TIMESTAMP(3),
ADD COLUMN "cancellationReason" TEXT,
ADD COLUMN "remindersEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "preDueReminderSentAt" TIMESTAMP(3),
ADD COLUMN "overdueReminderSentAt" TIMESTAMP(3),
ADD COLUMN "followupReminderSentAt" TIMESTAMP(3);

UPDATE "CustomerInvoice" invoice
SET "adminId" = customer."adminId",
    "issueDate" = invoice."createdAt",
    "totalCents" = invoice."amountCents",
    "subtotalCents" = invoice."amountCents",
    "taxCents" = CASE WHEN invoice."amountCents" IS NULL THEN NULL ELSE 0 END,
    "paidCents" = CASE WHEN invoice."status" = 'paid' THEN COALESCE(invoice."amountCents", 0) ELSE 0 END,
    "finalizedAt" = invoice."createdAt"
FROM "Customer" customer
WHERE invoice."customerId" = customer."id";

ALTER TABLE "CustomerInvoice"
ALTER COLUMN "adminId" SET NOT NULL,
ALTER COLUMN "customerId" DROP NOT NULL,
ALTER COLUMN "originalFilename" DROP NOT NULL,
ALTER COLUMN "r2Key" DROP NOT NULL,
ALTER COLUMN "fileUrl" DROP NOT NULL;

ALTER TABLE "CustomerInvoice" DROP CONSTRAINT "CustomerInvoice_customerId_fkey";
ALTER TABLE "CustomerInvoice" ADD CONSTRAINT "CustomerInvoice_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CustomerInvoice" ADD CONSTRAINT "CustomerInvoice_adminId_fkey"
FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerInvoice" ADD CONSTRAINT "CustomerInvoice_relatedInvoiceId_fkey"
FOREIGN KEY ("relatedInvoiceId") REFERENCES "CustomerInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "CustomerInvoice_publicToken_key" ON "CustomerInvoice"("publicToken");
CREATE UNIQUE INDEX "CustomerInvoice_adminId_number_key" ON "CustomerInvoice"("adminId", "number");
CREATE INDEX "CustomerInvoice_adminId_idx" ON "CustomerInvoice"("adminId");
CREATE INDEX "CustomerInvoice_relatedInvoiceId_idx" ON "CustomerInvoice"("relatedInvoiceId");
CREATE INDEX "CustomerInvoice_documentType_idx" ON "CustomerInvoice"("documentType");
CREATE INDEX "CustomerInvoice_issueDate_idx" ON "CustomerInvoice"("issueDate");

CREATE TABLE "CustomerInvoiceItem" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "description" TEXT NOT NULL,
  "quantity" DECIMAL(12,3) NOT NULL,
  "unit" TEXT NOT NULL,
  "unitPriceCents" INTEGER NOT NULL,
  "vatRate" INTEGER NOT NULL DEFAULT 0,
  "netAmountCents" INTEGER NOT NULL,
  "taxAmountCents" INTEGER NOT NULL DEFAULT 0,
  "amountCents" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerInvoiceItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CustomerInvoiceItem_invoiceId_position_idx" ON "CustomerInvoiceItem"("invoiceId", "position");
ALTER TABLE "CustomerInvoiceItem" ADD CONSTRAINT "CustomerInvoiceItem_invoiceId_fkey"
FOREIGN KEY ("invoiceId") REFERENCES "CustomerInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CustomerInvoicePayment" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "paidAt" TIMESTAMP(3) NOT NULL,
  "method" TEXT NOT NULL DEFAULT 'bank_transfer',
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerInvoicePayment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CustomerInvoicePayment_invoiceId_paidAt_idx" ON "CustomerInvoicePayment"("invoiceId", "paidAt");
ALTER TABLE "CustomerInvoicePayment" ADD CONSTRAINT "CustomerInvoicePayment_invoiceId_fkey"
FOREIGN KEY ("invoiceId") REFERENCES "CustomerInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "InvoiceNumberSequence" (
  "id" TEXT NOT NULL,
  "adminId" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "kind" TEXT NOT NULL,
  "nextValue" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InvoiceNumberSequence_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InvoiceNumberSequence_adminId_year_kind_key" ON "InvoiceNumberSequence"("adminId", "year", "kind");
CREATE INDEX "InvoiceNumberSequence_adminId_idx" ON "InvoiceNumberSequence"("adminId");
ALTER TABLE "InvoiceNumberSequence" ADD CONSTRAINT "InvoiceNumberSequence_adminId_fkey"
FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
