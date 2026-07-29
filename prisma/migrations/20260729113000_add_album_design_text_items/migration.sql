CREATE TABLE "AlbumDesignSpreadTextItem" (
    "id" TEXT NOT NULL,
    "spreadId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "fontFamily" TEXT NOT NULL DEFAULT 'playfair',
    "fontSize" DOUBLE PRECISION NOT NULL DEFAULT 7,
    "color" TEXT NOT NULL DEFAULT '#191919',
    "textAlign" TEXT NOT NULL DEFAULT 'center',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlbumDesignSpreadTextItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AlbumDesignSpreadTextItem_spreadId_idx" ON "AlbumDesignSpreadTextItem"("spreadId");
CREATE INDEX "AlbumDesignSpreadTextItem_spreadId_sortOrder_idx" ON "AlbumDesignSpreadTextItem"("spreadId", "sortOrder");

ALTER TABLE "AlbumDesignSpreadTextItem" ADD CONSTRAINT "AlbumDesignSpreadTextItem_spreadId_fkey" FOREIGN KEY ("spreadId") REFERENCES "AlbumDesignSpread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
