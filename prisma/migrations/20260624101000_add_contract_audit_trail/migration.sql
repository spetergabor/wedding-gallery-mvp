ALTER TABLE "Contract" ADD COLUMN "documentHash" TEXT;
ALTER TABLE "Contract" ADD COLUMN "signedPdfHash" TEXT;
ALTER TABLE "Contract" ADD COLUMN "signatureIpAddress" TEXT;
ALTER TABLE "Contract" ADD COLUMN "signatureUserAgent" TEXT;
ALTER TABLE "Contract" ADD COLUMN "acceptedTermsAt" TIMESTAMP(3);
ALTER TABLE "Contract" ADD COLUMN "acceptedPrivacyAt" TIMESTAMP(3);
ALTER TABLE "Contract" ADD COLUMN "auditTrail" JSONB;
