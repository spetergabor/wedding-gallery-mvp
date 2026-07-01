-- CreateTable
CREATE TABLE "MiniSession" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "sessionDate" TIMESTAMP(3) NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MiniSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MiniSessionBooking" (
    "id" TEXT NOT NULL,
    "miniSessionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "attendeeCount" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'booked',
    "cancelToken" TEXT NOT NULL,
    "customerEmailSentAt" TIMESTAMP(3),
    "adminEmailSentAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationEmailSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MiniSessionBooking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MiniSession_slug_key" ON "MiniSession"("slug");

-- CreateIndex
CREATE INDEX "MiniSession_adminId_idx" ON "MiniSession"("adminId");

-- CreateIndex
CREATE INDEX "MiniSession_slug_idx" ON "MiniSession"("slug");

-- CreateIndex
CREATE INDEX "MiniSession_sessionDate_idx" ON "MiniSession"("sessionDate");

-- CreateIndex
CREATE INDEX "MiniSession_startsAt_idx" ON "MiniSession"("startsAt");

-- CreateIndex
CREATE INDEX "MiniSession_isActive_idx" ON "MiniSession"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "MiniSessionBooking_cancelToken_key" ON "MiniSessionBooking"("cancelToken");

-- CreateIndex
CREATE INDEX "MiniSessionBooking_miniSessionId_idx" ON "MiniSessionBooking"("miniSessionId");

-- CreateIndex
CREATE INDEX "MiniSessionBooking_miniSessionId_startsAt_idx" ON "MiniSessionBooking"("miniSessionId", "startsAt");

-- CreateIndex
CREATE INDEX "MiniSessionBooking_status_idx" ON "MiniSessionBooking"("status");

-- CreateIndex
CREATE INDEX "MiniSessionBooking_email_idx" ON "MiniSessionBooking"("email");

-- CreateIndex
CREATE INDEX "MiniSessionBooking_cancelToken_idx" ON "MiniSessionBooking"("cancelToken");

-- AddForeignKey
ALTER TABLE "MiniSession" ADD CONSTRAINT "MiniSession_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MiniSessionBooking" ADD CONSTRAINT "MiniSessionBooking_miniSessionId_fkey" FOREIGN KEY ("miniSessionId") REFERENCES "MiniSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
