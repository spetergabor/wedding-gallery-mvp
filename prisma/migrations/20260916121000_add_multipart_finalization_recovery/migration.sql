ALTER TABLE "GalleryUploadItem"
ADD COLUMN "finalizationRunId" TEXT,
ADD COLUMN "finalizationStartedAt" TIMESTAMP(3),
ADD COLUMN "finalizationLastDispatchedAt" TIMESTAMP(3),
ADD COLUMN "finalizationAttempts" INTEGER NOT NULL DEFAULT 0;
