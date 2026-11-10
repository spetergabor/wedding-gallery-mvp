ALTER TABLE "IrisMomentSharedClient"
ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "IrisMomentSharedClient_miniSessionId_deletedAt_idx"
ON "IrisMomentSharedClient"("miniSessionId", "deletedAt");
