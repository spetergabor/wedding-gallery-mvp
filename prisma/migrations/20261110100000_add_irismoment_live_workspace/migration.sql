CREATE TABLE "IrisMomentDevice" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT,
    "appVersion" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "IrisMomentDevice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IrisMomentDeviceAuthorization" (
    "id" TEXT NOT NULL,
    "adminId" TEXT,
    "tokenHash" TEXT NOT NULL,
    "deviceExternalId" TEXT NOT NULL,
    "deviceName" TEXT NOT NULL,
    "appVersion" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IrisMomentDeviceAuthorization_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IrisMomentSharedClient" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "miniSessionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "participantCount" INTEGER,
    "notes" TEXT,
    "participants" JSONB NOT NULL,
    "effectOrders" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedByDeviceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "IrisMomentSharedClient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IrisMomentActiveEvent" (
    "adminId" TEXT NOT NULL,
    "miniSessionId" TEXT NOT NULL,
    "updatedByDeviceId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "IrisMomentActiveEvent_pkey" PRIMARY KEY ("adminId")
);

CREATE UNIQUE INDEX "IrisMomentDevice_tokenHash_key" ON "IrisMomentDevice"("tokenHash");
CREATE UNIQUE INDEX "IrisMomentDevice_adminId_externalId_key" ON "IrisMomentDevice"("adminId", "externalId");
CREATE INDEX "IrisMomentDevice_adminId_lastSeenAt_idx" ON "IrisMomentDevice"("adminId", "lastSeenAt");
CREATE INDEX "IrisMomentDevice_revokedAt_idx" ON "IrisMomentDevice"("revokedAt");
CREATE UNIQUE INDEX "IrisMomentDeviceAuthorization_tokenHash_key" ON "IrisMomentDeviceAuthorization"("tokenHash");
CREATE INDEX "IrisMomentDeviceAuthorization_status_expiresAt_idx" ON "IrisMomentDeviceAuthorization"("status", "expiresAt");
CREATE INDEX "IrisMomentDeviceAuthorization_adminId_idx" ON "IrisMomentDeviceAuthorization"("adminId");
CREATE INDEX "IrisMomentSharedClient_adminId_miniSessionId_idx" ON "IrisMomentSharedClient"("adminId", "miniSessionId");
CREATE INDEX "IrisMomentSharedClient_miniSessionId_updatedAt_idx" ON "IrisMomentSharedClient"("miniSessionId", "updatedAt");
CREATE INDEX "IrisMomentActiveEvent_miniSessionId_idx" ON "IrisMomentActiveEvent"("miniSessionId");

ALTER TABLE "IrisMomentDevice" ADD CONSTRAINT "IrisMomentDevice_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IrisMomentDeviceAuthorization" ADD CONSTRAINT "IrisMomentDeviceAuthorization_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IrisMomentSharedClient" ADD CONSTRAINT "IrisMomentSharedClient_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IrisMomentSharedClient" ADD CONSTRAINT "IrisMomentSharedClient_miniSessionId_fkey" FOREIGN KEY ("miniSessionId") REFERENCES "MiniSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IrisMomentSharedClient" ADD CONSTRAINT "IrisMomentSharedClient_updatedByDeviceId_fkey" FOREIGN KEY ("updatedByDeviceId") REFERENCES "IrisMomentDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IrisMomentActiveEvent" ADD CONSTRAINT "IrisMomentActiveEvent_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IrisMomentActiveEvent" ADD CONSTRAINT "IrisMomentActiveEvent_miniSessionId_fkey" FOREIGN KEY ("miniSessionId") REFERENCES "MiniSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
