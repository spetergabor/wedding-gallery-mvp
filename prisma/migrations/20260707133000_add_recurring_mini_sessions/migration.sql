ALTER TABLE "MiniSession"
  ADD COLUMN "bookingMode" TEXT NOT NULL DEFAULT 'single_day',
  ADD COLUMN "bookingWindowDays" INTEGER NOT NULL DEFAULT 60;

CREATE TABLE "MiniSessionAvailability" (
  "id" TEXT NOT NULL,
  "miniSessionId" TEXT NOT NULL,
  "weekday" INTEGER NOT NULL,
  "startsAt" TEXT NOT NULL,
  "endsAt" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MiniSessionAvailability_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MiniSession_bookingMode_idx" ON "MiniSession"("bookingMode");
CREATE INDEX "MiniSessionAvailability_miniSessionId_idx" ON "MiniSessionAvailability"("miniSessionId");
CREATE INDEX "MiniSessionAvailability_miniSessionId_weekday_idx" ON "MiniSessionAvailability"("miniSessionId", "weekday");
CREATE INDEX "MiniSessionAvailability_isActive_idx" ON "MiniSessionAvailability"("isActive");

ALTER TABLE "MiniSessionAvailability"
  ADD CONSTRAINT "MiniSessionAvailability_miniSessionId_fkey"
  FOREIGN KEY ("miniSessionId") REFERENCES "MiniSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
