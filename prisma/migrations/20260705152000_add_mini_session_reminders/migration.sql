ALTER TABLE "MiniSessionBooking"
ADD COLUMN "reminderEmailSentAt" TIMESTAMP(3);

CREATE INDEX "MiniSessionBooking_status_startsAt_reminderEmailSentAt_idx"
ON "MiniSessionBooking"("status", "startsAt", "reminderEmailSentAt");
