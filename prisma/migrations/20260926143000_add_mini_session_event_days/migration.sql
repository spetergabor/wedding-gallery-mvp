CREATE TABLE "MiniSessionEventDay" (
  "id" TEXT NOT NULL,
  "miniSessionId" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MiniSessionEventDay_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MiniSessionEventDay_miniSessionId_date_key"
ON "MiniSessionEventDay"("miniSessionId", "date");

CREATE INDEX "MiniSessionEventDay_miniSessionId_idx"
ON "MiniSessionEventDay"("miniSessionId");

CREATE INDEX "MiniSessionEventDay_date_idx"
ON "MiniSessionEventDay"("date");

ALTER TABLE "MiniSessionEventDay"
ADD CONSTRAINT "MiniSessionEventDay_miniSessionId_fkey"
FOREIGN KEY ("miniSessionId") REFERENCES "MiniSession"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "MiniSessionEventDay" (
  "id",
  "miniSessionId",
  "date",
  "createdAt",
  "updatedAt"
)
SELECT
  CONCAT('msd_', md5(ms."id" || ':' || day_value::text)),
  ms."id",
  day_value::date + TIME '12:00',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "MiniSession" ms
CROSS JOIN LATERAL generate_series(
  (ms."startsAt" AT TIME ZONE 'Europe/Berlin')::date,
  (ms."endsAt" AT TIME ZONE 'Europe/Berlin')::date,
  INTERVAL '1 day'
) AS day_value
WHERE ms."bookingMode" <> 'recurring';
