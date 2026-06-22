-- Customer type keeps non-wedding projects first-class without changing existing customer data.
ALTER TABLE "Customer" ADD COLUMN "customerType" TEXT NOT NULL DEFAULT 'wedding_couple';

CREATE INDEX "Customer_customerType_idx" ON "Customer"("customerType");
