-- AlterTable
ALTER TABLE "Gallery"
  ADD COLUMN "salePriceCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "saleCurrency" TEXT NOT NULL DEFAULT 'eur';

-- CreateTable
CREATE TABLE "GalleryPurchase" (
    "id" TEXT NOT NULL,
    "galleryId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "stripeAccountId" TEXT NOT NULL,
    "stripeCheckoutSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "amountTotal" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "downloadScope" TEXT,
    "paidAt" TIMESTAMP(3),
    "fulfilledAt" TIMESTAMP(3),
    "fulfillmentEmailSentAt" TIMESTAMP(3),
    "fulfillmentError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GalleryPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GalleryPurchase_stripeCheckoutSessionId_key" ON "GalleryPurchase"("stripeCheckoutSessionId");

-- CreateIndex
CREATE INDEX "GalleryPurchase_galleryId_idx" ON "GalleryPurchase"("galleryId");

-- CreateIndex
CREATE INDEX "GalleryPurchase_adminId_idx" ON "GalleryPurchase"("adminId");

-- CreateIndex
CREATE INDEX "GalleryPurchase_email_idx" ON "GalleryPurchase"("email");

-- CreateIndex
CREATE INDEX "GalleryPurchase_status_idx" ON "GalleryPurchase"("status");

-- CreateIndex
CREATE INDEX "GalleryPurchase_createdAt_idx" ON "GalleryPurchase"("createdAt");

-- AddForeignKey
ALTER TABLE "GalleryPurchase" ADD CONSTRAINT "GalleryPurchase_galleryId_fkey" FOREIGN KEY ("galleryId") REFERENCES "Gallery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GalleryPurchase" ADD CONSTRAINT "GalleryPurchase_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
