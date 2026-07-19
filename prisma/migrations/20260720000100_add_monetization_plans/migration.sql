CREATE TABLE "SubscriptionPlan" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "monthlyPriceCents" INTEGER NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'EUR',
  "storageLimitGb" INTEGER,
  "featureGallery" BOOLEAN NOT NULL DEFAULT true,
  "featureAlbum" BOOLEAN NOT NULL DEFAULT false,
  "featureContracts" BOOLEAN NOT NULL DEFAULT false,
  "featureBooking" BOOLEAN NOT NULL DEFAULT false,
  "featureStripe" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdminPlanOverride" (
  "id" TEXT NOT NULL,
  "adminId" TEXT NOT NULL,
  "planId" TEXT,
  "freeAccess" BOOLEAN NOT NULL DEFAULT false,
  "storageLimitGbOverride" INTEGER,
  "featureGalleryOverride" BOOLEAN,
  "featureAlbumOverride" BOOLEAN,
  "featureContractsOverride" BOOLEAN,
  "featureBookingOverride" BOOLEAN,
  "featureStripeOverride" BOOLEAN,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AdminPlanOverride_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SubscriptionPlan_slug_key" ON "SubscriptionPlan"("slug");
CREATE INDEX "SubscriptionPlan_isActive_idx" ON "SubscriptionPlan"("isActive");
CREATE INDEX "SubscriptionPlan_sortOrder_idx" ON "SubscriptionPlan"("sortOrder");

CREATE UNIQUE INDEX "AdminPlanOverride_adminId_key" ON "AdminPlanOverride"("adminId");
CREATE INDEX "AdminPlanOverride_planId_idx" ON "AdminPlanOverride"("planId");
CREATE INDEX "AdminPlanOverride_freeAccess_idx" ON "AdminPlanOverride"("freeAccess");

ALTER TABLE "AdminPlanOverride"
  ADD CONSTRAINT "AdminPlanOverride_adminId_fkey"
  FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AdminPlanOverride"
  ADD CONSTRAINT "AdminPlanOverride_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
