-- AlterTable
ALTER TABLE "Photo" ADD COLUMN     "r2Key" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX "Photo_r2Key_idx" ON "Photo"("r2Key");
