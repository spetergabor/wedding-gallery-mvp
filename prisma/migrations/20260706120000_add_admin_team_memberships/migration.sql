CREATE TABLE "AdminTeamMembership" (
  "id" TEXT NOT NULL,
  "ownerAdminId" TEXT NOT NULL,
  "memberAdminId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AdminTeamMembership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminTeamMembership_memberAdminId_key" ON "AdminTeamMembership"("memberAdminId");
CREATE UNIQUE INDEX "AdminTeamMembership_ownerAdminId_memberAdminId_key" ON "AdminTeamMembership"("ownerAdminId", "memberAdminId");
CREATE INDEX "AdminTeamMembership_ownerAdminId_idx" ON "AdminTeamMembership"("ownerAdminId");
CREATE INDEX "AdminTeamMembership_memberAdminId_idx" ON "AdminTeamMembership"("memberAdminId");
CREATE INDEX "AdminTeamMembership_createdAt_idx" ON "AdminTeamMembership"("createdAt");

ALTER TABLE "AdminTeamMembership"
  ADD CONSTRAINT "AdminTeamMembership_ownerAdminId_fkey"
  FOREIGN KEY ("ownerAdminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AdminTeamMembership"
  ADD CONSTRAINT "AdminTeamMembership_memberAdminId_fkey"
  FOREIGN KEY ("memberAdminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
