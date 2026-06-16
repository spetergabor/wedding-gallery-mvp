ALTER TABLE "Gallery" ADD COLUMN "clientAccessToken" TEXT;
ALTER TABLE "Photo" ADD COLUMN "isClientHidden" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Photo" ADD COLUMN "clientHiddenAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Gallery_clientAccessToken_key" ON "Gallery"("clientAccessToken");
