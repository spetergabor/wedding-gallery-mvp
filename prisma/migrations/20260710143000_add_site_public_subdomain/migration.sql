ALTER TABLE "SiteSettings" ADD COLUMN "publicSubdomain" TEXT;

CREATE UNIQUE INDEX "SiteSettings_publicSubdomain_key" ON "SiteSettings"("publicSubdomain");
