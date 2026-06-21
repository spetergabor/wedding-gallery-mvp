ALTER TABLE "Gallery"
  ADD COLUMN "clientEmail" TEXT,
  ADD COLUMN "proofingInviteSentAt" TIMESTAMP(3),
  ADD COLUMN "proofingInviteSentTo" TEXT,
  ADD COLUMN "proofingInviteEmailError" TEXT;
