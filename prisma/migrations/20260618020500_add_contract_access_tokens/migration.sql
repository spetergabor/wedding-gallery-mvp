ALTER TABLE "Contract" ADD COLUMN "accessToken" TEXT;
ALTER TABLE "Contract" ADD COLUMN "accessTokenExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Contract_accessToken_key" ON "Contract"("accessToken");
CREATE INDEX "Contract_accessToken_idx" ON "Contract"("accessToken");
