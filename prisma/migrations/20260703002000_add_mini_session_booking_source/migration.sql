ALTER TABLE "MiniSessionBooking"
ADD COLUMN "source" TEXT NOT NULL DEFAULT 'client',
ADD COLUMN "adminNote" TEXT;

CREATE INDEX "MiniSessionBooking_source_idx" ON "MiniSessionBooking"("source");
