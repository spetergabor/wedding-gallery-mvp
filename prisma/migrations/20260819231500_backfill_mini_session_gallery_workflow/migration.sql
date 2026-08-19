WITH "unambiguousProjectGalleries" AS (
  SELECT
    booking."id" AS "bookingId",
    MIN(gallery."id") AS "galleryId"
  FROM "MiniSessionBooking" booking
  INNER JOIN "Gallery" gallery
    ON gallery."projectId" = booking."projectId"
    AND gallery."galleryMode" = 'proofing'
  LEFT JOIN "MiniSessionBooking" linked_booking
    ON linked_booking."proofingGalleryId" = gallery."id"
  WHERE booking."proofingGalleryId" IS NULL
    AND booking."projectId" IS NOT NULL
    AND linked_booking."id" IS NULL
  GROUP BY booking."id"
  HAVING COUNT(gallery."id") = 1
)
UPDATE "MiniSessionBooking" booking
SET
  "proofingGalleryId" = candidate."galleryId",
  "workflowStatus" = CASE
    WHEN gallery."proofingStatus" IN ('submitted', 'processing', 'delivered')
      OR EXISTS (
        SELECT 1
        FROM "GalleryFavoriteList" favorite_list
        WHERE favorite_list."galleryId" = gallery."id"
          AND favorite_list."submittedAt" IS NOT NULL
      )
      THEN 'final_upload'
    WHEN gallery."proofingInviteSentAt" IS NOT NULL
      OR gallery."proofingStatus" = 'in_progress'
      THEN 'client_selection'
    ELSE 'raw_upload'
  END,
  "shootCompletedAt" = COALESCE(booking."shootCompletedAt", booking."endsAt"),
  "selectionSentAt" = COALESCE(
    booking."selectionSentAt",
    gallery."proofingInviteSentAt",
    CASE
      WHEN gallery."proofingStatus" <> 'not_opened' THEN gallery."proofingStatusUpdatedAt"
      ELSE NULL
    END
  ),
  "selectionSubmittedAt" = COALESCE(
    booking."selectionSubmittedAt",
    (
      SELECT MAX(favorite_list."submittedAt")
      FROM "GalleryFavoriteList" favorite_list
      WHERE favorite_list."galleryId" = gallery."id"
        AND favorite_list."submittedAt" IS NOT NULL
    ),
    CASE
      WHEN gallery."proofingStatus" IN ('submitted', 'processing', 'delivered')
        THEN gallery."proofingStatusUpdatedAt"
      ELSE NULL
    END
  )
FROM "unambiguousProjectGalleries" candidate
INNER JOIN "Gallery" gallery ON gallery."id" = candidate."galleryId"
WHERE booking."id" = candidate."bookingId";
