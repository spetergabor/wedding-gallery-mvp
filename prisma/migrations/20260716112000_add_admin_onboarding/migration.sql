ALTER TABLE "Admin" ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3);

UPDATE "Admin"
SET "onboardingCompletedAt" = COALESCE("approvedAt", "createdAt", NOW())
WHERE "onboardingCompletedAt" IS NULL;
