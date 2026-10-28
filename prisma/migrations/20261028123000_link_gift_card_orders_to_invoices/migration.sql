ALTER TABLE "GiftCardOrder"
ADD COLUMN "deliveryAddressLine1" TEXT,
ADD COLUMN "deliveryPostalCode" TEXT,
ADD COLUMN "deliveryCity" TEXT,
ADD COLUMN "deliveryCountry" TEXT,
ADD COLUMN "invoiceId" TEXT;

CREATE UNIQUE INDEX "GiftCardOrder_invoiceId_key" ON "GiftCardOrder"("invoiceId");

ALTER TABLE "GiftCardOrder"
ADD CONSTRAINT "GiftCardOrder_invoiceId_fkey"
FOREIGN KEY ("invoiceId") REFERENCES "CustomerInvoice"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
