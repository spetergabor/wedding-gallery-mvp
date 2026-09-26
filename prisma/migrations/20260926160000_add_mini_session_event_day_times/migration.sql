ALTER TABLE "MiniSessionEventDay"
ADD COLUMN "startsAt" TEXT,
ADD COLUMN "endsAt" TEXT;

UPDATE "MiniSessionEventDay" event_day
SET
  "startsAt" = TO_CHAR(mini_session."startsAt" AT TIME ZONE 'Europe/Berlin', 'HH24:MI'),
  "endsAt" = TO_CHAR(mini_session."endsAt" AT TIME ZONE 'Europe/Berlin', 'HH24:MI')
FROM "MiniSession" mini_session
WHERE mini_session."id" = event_day."miniSessionId";

ALTER TABLE "MiniSessionEventDay"
ALTER COLUMN "startsAt" SET NOT NULL,
ALTER COLUMN "endsAt" SET NOT NULL;
