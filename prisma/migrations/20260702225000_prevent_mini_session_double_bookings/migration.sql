CREATE UNIQUE INDEX "MiniSessionBooking_active_slot_unique"
ON "MiniSessionBooking"("miniSessionId", "startsAt")
WHERE "status" = 'booked';
