CREATE TABLE "CustomerInvoice" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "originalFilename" TEXT NOT NULL,
    "r2Key" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL DEFAULT 0,
    "amountCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "dueDate" TIMESTAMP(3),
    "notes" TEXT,
    "sentAt" TIMESTAMP(3),
    "sentTo" TEXT,
    "emailError" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerInvoice_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CustomerInvoice_customerId_idx" ON "CustomerInvoice"("customerId");
CREATE INDEX "CustomerInvoice_projectId_idx" ON "CustomerInvoice"("projectId");
CREATE INDEX "CustomerInvoice_status_idx" ON "CustomerInvoice"("status");
CREATE INDEX "CustomerInvoice_dueDate_idx" ON "CustomerInvoice"("dueDate");
CREATE INDEX "CustomerInvoice_sentAt_idx" ON "CustomerInvoice"("sentAt");
CREATE INDEX "CustomerInvoice_paidAt_idx" ON "CustomerInvoice"("paidAt");
CREATE INDEX "CustomerInvoice_createdAt_idx" ON "CustomerInvoice"("createdAt");

ALTER TABLE "CustomerInvoice"
  ADD CONSTRAINT "CustomerInvoice_customerId_fkey"
  FOREIGN KEY ("customerId")
  REFERENCES "Customer"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "CustomerInvoice"
  ADD CONSTRAINT "CustomerInvoice_projectId_fkey"
  FOREIGN KEY ("projectId")
  REFERENCES "CustomerProject"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
