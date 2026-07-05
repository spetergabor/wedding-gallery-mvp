ALTER TABLE "Customer"
  ADD COLUMN "wifeName" TEXT,
  ADD COLUMN "wifeEmail" TEXT,
  ADD COLUMN "wifePhone" TEXT,
  ADD COLUMN "husbandName" TEXT,
  ADD COLUMN "husbandEmail" TEXT,
  ADD COLUMN "husbandPhone" TEXT,
  ADD COLUMN "churchCeremonyLocation" TEXT,
  ADD COLUMN "civilCeremonyLocation" TEXT,
  ADD COLUMN "mainLocation" TEXT;

UPDATE "Customer"
SET
  "wifeEmail" = COALESCE("wifeEmail", "primaryEmail"),
  "wifePhone" = COALESCE("wifePhone", "phone"),
  "husbandName" = COALESCE("husbandName", "partnerName"),
  "husbandEmail" = COALESCE("husbandEmail", "partnerEmail", "secondaryEmail"),
  "husbandPhone" = COALESCE("husbandPhone", "partnerPhone"),
  "churchCeremonyLocation" = COALESCE("churchCeremonyLocation", "ceremonyLocation"),
  "mainLocation" = COALESCE("mainLocation", "weddingLocation", "venue")
WHERE "customerType" = 'wedding_couple';
