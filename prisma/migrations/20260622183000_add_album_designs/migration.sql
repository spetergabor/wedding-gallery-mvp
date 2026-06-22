-- CreateTable
CREATE TABLE "AlbumDesign" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "favoriteListId" TEXT,
    "title" TEXT NOT NULL DEFAULT 'Albumterv',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlbumDesign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlbumDesignSpread" (
    "id" TEXT NOT NULL,
    "designId" TEXT NOT NULL,
    "title" TEXT,
    "layoutKey" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlbumDesignSpread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlbumDesignSpreadItem" (
    "id" TEXT NOT NULL,
    "spreadId" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "slotIndex" INTEGER NOT NULL DEFAULT 0,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlbumDesignSpreadItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AlbumDesign_customerId_idx" ON "AlbumDesign"("customerId");

-- CreateIndex
CREATE INDEX "AlbumDesign_favoriteListId_idx" ON "AlbumDesign"("favoriteListId");

-- CreateIndex
CREATE INDEX "AlbumDesign_status_idx" ON "AlbumDesign"("status");

-- CreateIndex
CREATE INDEX "AlbumDesign_createdAt_idx" ON "AlbumDesign"("createdAt");

-- CreateIndex
CREATE INDEX "AlbumDesignSpread_designId_idx" ON "AlbumDesignSpread"("designId");

-- CreateIndex
CREATE INDEX "AlbumDesignSpread_designId_sortOrder_idx" ON "AlbumDesignSpread"("designId", "sortOrder");

-- CreateIndex
CREATE INDEX "AlbumDesignSpreadItem_spreadId_idx" ON "AlbumDesignSpreadItem"("spreadId");

-- CreateIndex
CREATE INDEX "AlbumDesignSpreadItem_photoId_idx" ON "AlbumDesignSpreadItem"("photoId");

-- CreateIndex
CREATE INDEX "AlbumDesignSpreadItem_spreadId_slotIndex_idx" ON "AlbumDesignSpreadItem"("spreadId", "slotIndex");

-- AddForeignKey
ALTER TABLE "AlbumDesign" ADD CONSTRAINT "AlbumDesign_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlbumDesign" ADD CONSTRAINT "AlbumDesign_favoriteListId_fkey" FOREIGN KEY ("favoriteListId") REFERENCES "GalleryFavoriteList"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlbumDesignSpread" ADD CONSTRAINT "AlbumDesignSpread_designId_fkey" FOREIGN KEY ("designId") REFERENCES "AlbumDesign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlbumDesignSpreadItem" ADD CONSTRAINT "AlbumDesignSpreadItem_spreadId_fkey" FOREIGN KEY ("spreadId") REFERENCES "AlbumDesignSpread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlbumDesignSpreadItem" ADD CONSTRAINT "AlbumDesignSpreadItem_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
