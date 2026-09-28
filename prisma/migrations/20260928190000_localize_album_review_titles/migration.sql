ALTER TABLE "AlbumReview"
ALTER COLUMN "title" SET DEFAULT 'Fotobuch-Vorschau';

UPDATE "AlbumReview" AS review
SET "title" = CASE
  WHEN BTRIM(REGEXP_REPLACE(review."title", '\s+ellenőrző$', '', 'i')) IN ('', 'Album')
    THEN BTRIM(customer."coupleName") || ' – Fotobuch-Vorschau'
  ELSE BTRIM(REGEXP_REPLACE(review."title", '\s+ellenőrző$', '', 'i')) || ' – Fotobuch-Vorschau'
END
FROM "Customer" AS customer
WHERE review."customerId" = customer."id"
  AND review."title" ~* '\s+ellenőrző$';
