WITH "unambiguousCustomerGalleries" AS (
  SELECT
    booking."id" AS "bookingId",
    MIN(gallery."id") AS "galleryId"
  FROM "MiniSessionBooking" booking
  INNER JOIN "MiniSession" mini_session
    ON mini_session."id" = booking."miniSessionId"
  INNER JOIN "Gallery" gallery
    ON gallery."adminId" = mini_session."adminId"
    AND gallery."galleryMode" = 'proofing'
    AND (
      (
        booking."customerId" IS NOT NULL
        AND gallery."customerId" = booking."customerId"
      )
      OR (
        gallery."clientEmail" IS NOT NULL
        AND LOWER(TRIM(gallery."clientEmail")) = LOWER(TRIM(booking."email"))
      )
    )
  LEFT JOIN "MiniSessionBooking" linked_booking
    ON linked_booking."proofingGalleryId" = gallery."id"
  WHERE booking."proofingGalleryId" IS NULL
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
FROM "unambiguousCustomerGalleries" candidate
INNER JOIN "Gallery" gallery ON gallery."id" = candidate."galleryId"
WHERE booking."id" = candidate."bookingId";
