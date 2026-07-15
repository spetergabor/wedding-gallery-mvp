ALTER TABLE "Gallery"
  ADD COLUMN "saleUnitPriceCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "salePricingTiers" JSONB;

ALTER TABLE "GalleryPurchase"
  ADD COLUMN "purchaseKind" TEXT NOT NULL DEFAULT 'gallery',
  ADD COLUMN "purchasedPhotoIds" JSONB,
  ADD COLUMN "itemCount" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "GalleryPurchase_purchaseKind_idx" ON "GalleryPurchase"("purchaseKind");
