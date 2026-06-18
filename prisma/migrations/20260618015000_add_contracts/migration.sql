CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "originalFilename" TEXT NOT NULL,
    "r2Key" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "signedR2Key" TEXT,
    "signedFileUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Contract_customerId_idx" ON "Contract"("customerId");
CREATE INDEX "Contract_status_idx" ON "Contract"("status");
CREATE INDEX "Contract_createdAt_idx" ON "Contract"("createdAt");

ALTER TABLE "Contract" ADD CONSTRAINT "Contract_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
