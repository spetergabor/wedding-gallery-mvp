ALTER TABLE "Contract" ADD COLUMN "sourceType" TEXT NOT NULL DEFAULT 'pdf';
ALTER TABLE "Contract" ADD COLUMN "bodyText" TEXT;
ALTER TABLE "Contract" ADD COLUMN "clientFields" JSONB;
ALTER TABLE "Contract" ADD COLUMN "completedFields" JSONB;

CREATE INDEX "Contract_sourceType_idx" ON "Contract"("sourceType");
