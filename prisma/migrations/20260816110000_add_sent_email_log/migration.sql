CREATE TABLE "SentEmailLog" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'resend',
    "providerMessageId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "from" TEXT NOT NULL,
    "to" JSONB NOT NULL,
    "cc" JSONB,
    "bcc" JSONB,
    "replyTo" JSONB,
    "subject" TEXT NOT NULL,
    "html" TEXT,
    "text" TEXT,
    "lastEvent" TEXT NOT NULL DEFAULT 'sent',
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SentEmailLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SentEmailLog_providerMessageId_key" ON "SentEmailLog"("providerMessageId");
CREATE INDEX "SentEmailLog_createdAt_idx" ON "SentEmailLog"("createdAt");
CREATE INDEX "SentEmailLog_status_createdAt_idx" ON "SentEmailLog"("status", "createdAt");
CREATE INDEX "SentEmailLog_provider_createdAt_idx" ON "SentEmailLog"("provider", "createdAt");
