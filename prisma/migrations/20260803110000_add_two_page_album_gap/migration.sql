UPDATE "AlbumDesignSpreadItem" AS item
SET
  "width" = 49.5,
  "updatedAt" = CURRENT_TIMESTAMP
FROM "AlbumDesignSpread" AS spread
WHERE item."spreadId" = spread."id"
  AND spread."layoutKey" = 'two-pages'
  AND item."slotIndex" = 0
  AND ABS(item."x") < 0.0001
  AND ABS(item."y") < 0.0001
  AND ABS(item."width" - 50) < 0.0001
  AND ABS(item."height" - 100) < 0.0001;

UPDATE "AlbumDesignSpreadItem" AS item
SET
  "x" = 50.5,
  "width" = 49.5,
  "updatedAt" = CURRENT_TIMESTAMP
FROM "AlbumDesignSpread" AS spread
WHERE item."spreadId" = spread."id"
  AND spread."layoutKey" = 'two-pages'
  AND item."slotIndex" = 1
  AND ABS(item."x" - 50) < 0.0001
  AND ABS(item."y") < 0.0001
  AND ABS(item."width" - 50) < 0.0001
  AND ABS(item."height" - 100) < 0.0001;
