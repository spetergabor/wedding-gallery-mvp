ALTER TABLE "AlbumDesign"
ADD COLUMN "reviewExportStatus" TEXT NOT NULL DEFAULT 'idle',
ADD COLUMN "reviewExportTotal" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "reviewExportCompleted" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "reviewExportStartedAt" TIMESTAMP(3);
