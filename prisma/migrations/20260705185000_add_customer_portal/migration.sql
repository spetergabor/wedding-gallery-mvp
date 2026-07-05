ALTER TABLE "Customer"
  ADD COLUMN "portalToken" TEXT,
  ADD COLUMN "partnerName" TEXT,
  ADD COLUMN "partnerEmail" TEXT,
  ADD COLUMN "partnerPhone" TEXT,
  ADD COLUMN "weddingLocation" TEXT,
  ADD COLUMN "weddingAddress" TEXT,
  ADD COLUMN "gettingReadyLocation" TEXT,
  ADD COLUMN "ceremonyLocation" TEXT,
  ADD COLUMN "receptionLocation" TEXT,
  ADD COLUMN "weddingSchedule" TEXT,
  ADD COLUMN "weddingStyleNotes" TEXT,
  ADD COLUMN "importantPeopleNotes" TEXT,
  ADD COLUMN "portalNotes" TEXT;

CREATE TABLE "CustomerPortalImage" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "title" TEXT,
  "notes" TEXT,
  "originalFilename" TEXT NOT NULL,
  "imageUrl" TEXT NOT NULL,
  "r2Key" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL DEFAULT 0,
  "contentType" TEXT,
  "uploadedBy" TEXT NOT NULL DEFAULT 'client',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CustomerPortalImage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerVendor" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "contactName" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "website" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CustomerVendor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Customer_portalToken_key" ON "Customer"("portalToken");
CREATE INDEX "CustomerPortalImage_customerId_idx" ON "CustomerPortalImage"("customerId");
CREATE INDEX "CustomerPortalImage_createdAt_idx" ON "CustomerPortalImage"("createdAt");
CREATE INDEX "CustomerVendor_customerId_idx" ON "CustomerVendor"("customerId");
CREATE INDEX "CustomerVendor_role_idx" ON "CustomerVendor"("role");

ALTER TABLE "CustomerPortalImage"
  ADD CONSTRAINT "CustomerPortalImage_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomerVendor"
  ADD CONSTRAINT "CustomerVendor_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
