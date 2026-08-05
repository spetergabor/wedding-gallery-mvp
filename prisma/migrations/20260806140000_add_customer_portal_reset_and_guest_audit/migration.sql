CREATE TABLE "CustomerPortalPasswordResetToken" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "purpose" TEXT NOT NULL DEFAULT 'reset',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CustomerPortalPasswordResetToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GuestGalleryAuditLog" (
  "id" TEXT NOT NULL,
  "galleryId" TEXT NOT NULL,
  "accountId" TEXT,
  "actorType" TEXT NOT NULL,
  "actorLabel" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "photoCount" INTEGER NOT NULL DEFAULT 0,
  "photoIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "GuestGalleryAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerPortalPasswordResetToken_tokenHash_key"
ON "CustomerPortalPasswordResetToken"("tokenHash");

CREATE INDEX "CustomerPortalPasswordResetToken_accountId_idx"
ON "CustomerPortalPasswordResetToken"("accountId");

CREATE INDEX "CustomerPortalPasswordResetToken_expiresAt_idx"
ON "CustomerPortalPasswordResetToken"("expiresAt");

CREATE INDEX "CustomerPortalPasswordResetToken_usedAt_idx"
ON "CustomerPortalPasswordResetToken"("usedAt");

CREATE INDEX "GuestGalleryAuditLog_galleryId_createdAt_idx"
ON "GuestGalleryAuditLog"("galleryId", "createdAt");

CREATE INDEX "GuestGalleryAuditLog_accountId_createdAt_idx"
ON "GuestGalleryAuditLog"("accountId", "createdAt");

CREATE INDEX "GuestGalleryAuditLog_action_idx"
ON "GuestGalleryAuditLog"("action");

CREATE INDEX "GuestGalleryAuditLog_createdAt_idx"
ON "GuestGalleryAuditLog"("createdAt");

ALTER TABLE "CustomerPortalPasswordResetToken"
ADD CONSTRAINT "CustomerPortalPasswordResetToken_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "CustomerPortalAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GuestGalleryAuditLog"
ADD CONSTRAINT "GuestGalleryAuditLog_galleryId_fkey"
FOREIGN KEY ("galleryId") REFERENCES "Gallery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GuestGalleryAuditLog"
ADD CONSTRAINT "GuestGalleryAuditLog_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "CustomerPortalAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
