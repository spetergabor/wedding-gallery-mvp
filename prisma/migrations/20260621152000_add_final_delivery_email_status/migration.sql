ALTER TABLE "Gallery"
  ADD COLUMN "finalDeliveryEmailSentAt" TIMESTAMP(3),
  ADD COLUMN "finalDeliveryEmailSentTo" TEXT,
  ADD COLUMN "finalDeliveryEmailError" TEXT;
