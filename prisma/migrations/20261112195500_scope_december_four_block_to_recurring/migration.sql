-- Keep the 4–5 December Ried mini session bookable while the photographer's
-- recurring services remain unavailable on 4 December. The admin is resolved
-- through the known mini-session record so no other workspace is affected.
UPDATE "AdminCalendarBlock"
SET
  "scope" = 'recurring',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "adminId" = (
  SELECT "adminId"
  FROM "MiniSession"
  WHERE "id" = 'cmumqsrgv0001ii04gbi8k7cu'
)
  AND "scope" = 'all'
  AND "startsAt" < TIMESTAMPTZ '2026-12-05 00:00:00+00'
  AND "endsAt" > TIMESTAMPTZ '2026-12-03 22:00:00+00'
  AND ("endsAt" - "startsAt") >= INTERVAL '23 hours';
