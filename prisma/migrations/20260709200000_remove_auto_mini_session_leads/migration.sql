DELETE FROM "Lead"
WHERE "eventType" = 'mini_session'
  AND "notes" LIKE 'Mini session foglalás (%';
