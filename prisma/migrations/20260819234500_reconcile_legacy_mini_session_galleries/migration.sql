WITH "replacementProofingGalleries" AS (
  SELECT
    booking."id" AS "bookingId",
    MIN(candidate."id") AS "galleryId"
  FROM "MiniSessionBooking" booking
  INNER JOIN "MiniSession" mini_session
    ON mini_session."id" = booking."miniSessionId"
  INNER JOIN "Gallery" current_gallery
    ON current_gallery."id" = booking."proofingGalleryId"
  INNER JOIN "Gallery" candidate
    ON candidate."adminId" = mini_session."adminId"
    AND candidate."galleryMode" = 'proofing'
    AND candidate."id" <> current_gallery."id"
    AND (
      (
        booking."customerId" IS NOT NULL
        AND candidate."customerId" = booking."customerId"
      )
      OR (
        candidate."clientEmail" IS NOT NULL
        AND LOWER(TRIM(candidate."clientEmail")) = LOWER(TRIM(booking."email"))
      )
    )
  LEFT JOIN "MiniSessionBooking" linked_booking
    ON linked_booking."proofingGalleryId" = candidate."id"
  WHERE booking."status" NOT IN ('cancelled', 'no_show')
    AND linked_booking."id" IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM "Photo" current_photo
      WHERE current_photo."galleryId" = current_gallery."id"
    )
    AND NOT EXISTS (
      SELECT 1
      FROM "GalleryFavoriteList" current_list
      WHERE current_list."galleryId" = current_gallery."id"
    )
    AND (
      EXISTS (
        SELECT 1
        FROM "Photo" candidate_photo
        WHERE candidate_photo."galleryId" = candidate."id"
      )
      OR EXISTS (
        SELECT 1
        FROM "GalleryFavoriteList" candidate_list
        WHERE candidate_list."galleryId" = candidate."id"
      )
    )
  GROUP BY booking."id"
  HAVING COUNT(candidate."id") = 1
)
UPDATE "MiniSessionBooking" booking
SET
  "proofingGalleryId" = replacement."galleryId",
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
FROM "replacementProofingGalleries" replacement
INNER JOIN "Gallery" gallery ON gallery."id" = replacement."galleryId"
WHERE booking."id" = replacement."bookingId";

WITH "unambiguousFinalGalleries" AS (
  SELECT
    booking."id" AS "bookingId",
    MIN(gallery."id") AS "galleryId"
  FROM "MiniSessionBooking" booking
  INNER JOIN "MiniSession" mini_session
    ON mini_session."id" = booking."miniSessionId"
  INNER JOIN "Gallery" gallery
    ON gallery."adminId" = mini_session."adminId"
    AND gallery."galleryMode" <> 'proofing'
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
    ON linked_booking."finalGalleryId" = gallery."id"
  WHERE booking."status" NOT IN ('cancelled', 'no_show')
    AND booking."finalGalleryId" IS NULL
    AND linked_booking."id" IS NULL
    AND EXISTS (
      SELECT 1
      FROM "Photo" photo
      WHERE photo."galleryId" = gallery."id"
    )
  GROUP BY booking."id"
  HAVING COUNT(gallery."id") = 1
)
UPDATE "MiniSessionBooking" booking
SET
  "finalGalleryId" = candidate."galleryId",
  "workflowStatus" = 'delivered',
  "shootCompletedAt" = COALESCE(booking."shootCompletedAt", booking."endsAt"),
  "finalDeliveredAt" = COALESCE(booking."finalDeliveredAt", gallery."updatedAt")
FROM "unambiguousFinalGalleries" candidate
INNER JOIN "Gallery" gallery ON gallery."id" = candidate."galleryId"
WHERE booking."id" = candidate."bookingId";
