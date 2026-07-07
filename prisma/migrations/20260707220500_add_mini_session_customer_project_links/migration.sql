ALTER TABLE "Customer"
ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "MiniSessionBooking"
ADD COLUMN "customerId" TEXT,
ADD COLUMN "projectId" TEXT;

CREATE INDEX "Customer_tags_idx" ON "Customer" USING GIN ("tags");
CREATE INDEX "MiniSessionBooking_customerId_idx" ON "MiniSessionBooking"("customerId");
CREATE INDEX "MiniSessionBooking_projectId_idx" ON "MiniSessionBooking"("projectId");

ALTER TABLE "MiniSessionBooking"
ADD CONSTRAINT "MiniSessionBooking_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MiniSessionBooking"
ADD CONSTRAINT "MiniSessionBooking_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "CustomerProject"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
