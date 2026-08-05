CREATE TABLE "CustomerPortalAccount" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "loginIdentifier" TEXT NOT NULL,
  "email" TEXT,
  "displayName" TEXT,
  "passwordHash" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
  "passwordChangedAt" TIMESTAMP(3),
  "lastLoginAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CustomerPortalAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerPortalSession" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CustomerPortalSession_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "GalleryGuestUpload"
ADD COLUMN "customerDeletedAt" TIMESTAMP(3),
ADD COLUMN "customerDeletedByAccountId" TEXT,
ADD COLUMN "statusBeforeCustomerDelete" TEXT;

CREATE UNIQUE INDEX "CustomerPortalAccount_loginIdentifier_key"
ON "CustomerPortalAccount"("loginIdentifier");

CREATE INDEX "CustomerPortalAccount_customerId_idx"
ON "CustomerPortalAccount"("customerId");

CREATE INDEX "CustomerPortalAccount_customerId_status_idx"
ON "CustomerPortalAccount"("customerId", "status");

CREATE INDEX "CustomerPortalAccount_email_idx"
ON "CustomerPortalAccount"("email");

CREATE UNIQUE INDEX "CustomerPortalSession_tokenHash_key"
ON "CustomerPortalSession"("tokenHash");

CREATE INDEX "CustomerPortalSession_accountId_idx"
ON "CustomerPortalSession"("accountId");

CREATE INDEX "CustomerPortalSession_expiresAt_idx"
ON "CustomerPortalSession"("expiresAt");

CREATE INDEX "GalleryGuestUpload_galleryId_customerDeletedAt_createdAt_id_idx"
ON "GalleryGuestUpload"("galleryId", "customerDeletedAt", "createdAt", "id");

CREATE INDEX "GalleryGuestUpload_customerDeletedByAccountId_idx"
ON "GalleryGuestUpload"("customerDeletedByAccountId");

ALTER TABLE "CustomerPortalAccount"
ADD CONSTRAINT "CustomerPortalAccount_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomerPortalSession"
ADD CONSTRAINT "CustomerPortalSession_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "CustomerPortalAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GalleryGuestUpload"
ADD CONSTRAINT "GalleryGuestUpload_customerDeletedByAccountId_fkey"
FOREIGN KEY ("customerDeletedByAccountId") REFERENCES "CustomerPortalAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
