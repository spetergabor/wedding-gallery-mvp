-- Add an optional customer relation for galleries.
ALTER TABLE "Gallery" ADD COLUMN "customerId" TEXT;

CREATE INDEX "Gallery_customerId_idx" ON "Gallery"("customerId");

ALTER TABLE "Gallery"
  ADD CONSTRAINT "Gallery_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
