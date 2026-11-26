-- Preserve the most complete record from every duplicated irismoment walk-in
-- and archive the technical retries without deleting any booking data.
WITH "rankedWalkIns" AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "miniSessionId", "irisExternalClientId"
      ORDER BY
        ("finalGalleryId" IS NOT NULL) DESC,
        ("proofingGalleryId" IS NOT NULL) DESC,
        ("projectId" IS NOT NULL) DESC,
        ("customerId" IS NOT NULL) DESC,
        ("irisDeliveredAt" IS NOT NULL) DESC,
        ("finalDeliveredAt" IS NOT NULL) DESC,
        ("irisFolderName" IS NOT NULL) DESC,
        ("workflowStatus" <> 'shoot_scheduled') DESC,
        "createdAt" ASC,
        "updatedAt" DESC,
        "id" ASC
    ) AS "duplicateRank"
  FROM "MiniSessionBooking"
  WHERE
    "source" = 'walk_in'
    AND "irisExternalClientId" IS NOT NULL
)
UPDATE "MiniSessionBooking" AS "booking"
SET
  "status" = 'cancelled',
  "cancelledAt" = COALESCE("booking"."cancelledAt", CURRENT_TIMESTAMP),
  "adminNote" = CASE
    WHEN COALESCE("booking"."adminNote", '') = ''
      THEN 'Automatikusan archivált irismoment duplikáció (2026-11-26).'
    ELSE "booking"."adminNote" || E'\nAutomatikusan archivált irismoment duplikáció (2026-11-26).'
  END,
  "irisExternalClientId" = NULL,
  "updatedAt" = CURRENT_TIMESTAMP
FROM "rankedWalkIns"
WHERE
  "booking"."id" = "rankedWalkIns"."id"
  AND "rankedWalkIns"."duplicateRank" > 1;

-- PostgreSQL permits multiple NULL values in a unique index. Archived retries
-- therefore remain available in history, while every live external client is
-- guaranteed to have at most one booking per event.
CREATE UNIQUE INDEX "MiniSessionBooking_miniSessionId_irisExternalClientId_key"
ON "MiniSessionBooking"("miniSessionId", "irisExternalClientId");
