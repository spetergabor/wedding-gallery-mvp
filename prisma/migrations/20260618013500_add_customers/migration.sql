CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "coupleName" TEXT NOT NULL,
    "primaryEmail" TEXT NOT NULL,
    "secondaryEmail" TEXT,
    "phone" TEXT,
    "weddingDate" TIMESTAMP(3),
    "venue" TEXT,
    "status" TEXT NOT NULL DEFAULT 'lead',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Customer_status_idx" ON "Customer"("status");
CREATE INDEX "Customer_weddingDate_idx" ON "Customer"("weddingDate");
CREATE INDEX "Customer_primaryEmail_idx" ON "Customer"("primaryEmail");
