ALTER TABLE "Gallery" ADD COLUMN "lightroomUploadsEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Gallery" ADD COLUMN "lightroomUploadTokenHash" TEXT;
ALTER TABLE "Gallery" ADD COLUMN "lightroomUploadTokenCreatedAt" TIMESTAMP(3);
ALTER TABLE "Gallery" ADD COLUMN "lightroomUploadTokenLastUsedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Gallery_lightroomUploadTokenHash_key" ON "Gallery"("lightroomUploadTokenHash");
CREATE INDEX "Gallery_lightroomUploadsEnabled_idx" ON "Gallery"("lightroomUploadsEnabled");
