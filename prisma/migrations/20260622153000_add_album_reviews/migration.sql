-- CreateTable
CREATE TABLE "AlbumReview" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Album ellenőrző',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "accessToken" TEXT NOT NULL,
    "clientEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlbumReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlbumReviewSpread" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "title" TEXT,
    "filename" TEXT NOT NULL,
    "r2Key" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL DEFAULT 0,
    "imageWidth" INTEGER NOT NULL DEFAULT 0,
    "imageHeight" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlbumReviewSpread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlbumReviewComment" (
    "id" TEXT NOT NULL,
    "spreadId" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "text" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlbumReviewComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AlbumReview_accessToken_key" ON "AlbumReview"("accessToken");

-- CreateIndex
CREATE INDEX "AlbumReview_customerId_idx" ON "AlbumReview"("customerId");

-- CreateIndex
CREATE INDEX "AlbumReview_status_idx" ON "AlbumReview"("status");

-- CreateIndex
CREATE INDEX "AlbumReview_createdAt_idx" ON "AlbumReview"("createdAt");

-- CreateIndex
CREATE INDEX "AlbumReview_accessToken_idx" ON "AlbumReview"("accessToken");

-- CreateIndex
CREATE INDEX "AlbumReviewSpread_reviewId_idx" ON "AlbumReviewSpread"("reviewId");

-- CreateIndex
CREATE INDEX "AlbumReviewSpread_reviewId_sortOrder_idx" ON "AlbumReviewSpread"("reviewId", "sortOrder");

-- CreateIndex
CREATE INDEX "AlbumReviewSpread_r2Key_idx" ON "AlbumReviewSpread"("r2Key");

-- CreateIndex
CREATE INDEX "AlbumReviewComment_spreadId_idx" ON "AlbumReviewComment"("spreadId");

-- CreateIndex
CREATE INDEX "AlbumReviewComment_status_idx" ON "AlbumReviewComment"("status");

-- CreateIndex
CREATE INDEX "AlbumReviewComment_createdAt_idx" ON "AlbumReviewComment"("createdAt");

-- AddForeignKey
ALTER TABLE "AlbumReview" ADD CONSTRAINT "AlbumReview_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlbumReviewSpread" ADD CONSTRAINT "AlbumReviewSpread_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "AlbumReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlbumReviewComment" ADD CONSTRAINT "AlbumReviewComment_spreadId_fkey" FOREIGN KEY ("spreadId") REFERENCES "AlbumReviewSpread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
