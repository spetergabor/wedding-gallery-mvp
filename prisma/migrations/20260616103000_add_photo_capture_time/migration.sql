-- AlterTable
ALTER TABLE "Photo" ADD COLUMN "capturedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Photo_capturedAt_idx" ON "Photo"("capturedAt");
