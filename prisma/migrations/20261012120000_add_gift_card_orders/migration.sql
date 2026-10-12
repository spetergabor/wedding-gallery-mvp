CREATE TABLE "GiftCardOrder" (
  "id" TEXT NOT NULL,
  "adminId" TEXT NOT NULL,
  "customerName" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "recipientName" TEXT NOT NULL,
  "personCount" INTEGER NOT NULL,
  "deliveryMethod" TEXT NOT NULL,
  "deliveryAddress" TEXT,
  "message" TEXT,
  "source" TEXT NOT NULL DEFAULT 'Irismoment.at',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GiftCardOrder_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GiftCardOrder_adminId_createdAt_idx"
ON "GiftCardOrder"("adminId", "createdAt");

CREATE INDEX "GiftCardOrder_email_idx"
ON "GiftCardOrder"("email");

ALTER TABLE "GiftCardOrder"
ADD CONSTRAINT "GiftCardOrder_adminId_fkey"
FOREIGN KEY ("adminId") REFERENCES "Admin"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
