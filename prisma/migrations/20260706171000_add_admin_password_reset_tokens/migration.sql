CREATE TABLE "AdminPasswordResetToken" (
  "id" TEXT NOT NULL,
  "adminId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AdminPasswordResetToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminPasswordResetToken_tokenHash_key" ON "AdminPasswordResetToken"("tokenHash");
CREATE INDEX "AdminPasswordResetToken_adminId_idx" ON "AdminPasswordResetToken"("adminId");
CREATE INDEX "AdminPasswordResetToken_expiresAt_idx" ON "AdminPasswordResetToken"("expiresAt");
CREATE INDEX "AdminPasswordResetToken_usedAt_idx" ON "AdminPasswordResetToken"("usedAt");
CREATE INDEX "AdminPasswordResetToken_createdAt_idx" ON "AdminPasswordResetToken"("createdAt");

ALTER TABLE "AdminPasswordResetToken"
  ADD CONSTRAINT "AdminPasswordResetToken_adminId_fkey"
  FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
