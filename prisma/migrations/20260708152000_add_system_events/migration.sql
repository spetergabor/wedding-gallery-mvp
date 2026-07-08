CREATE TABLE "SystemEvent" (
    "id" TEXT NOT NULL,
    "actorAdminId" TEXT,
    "targetAdminId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "status" TEXT NOT NULL DEFAULT 'success',
    "source" TEXT,
    "href" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SystemEvent_actorAdminId_createdAt_idx" ON "SystemEvent"("actorAdminId", "createdAt");
CREATE INDEX "SystemEvent_targetAdminId_createdAt_idx" ON "SystemEvent"("targetAdminId", "createdAt");
CREATE INDEX "SystemEvent_type_idx" ON "SystemEvent"("type");
CREATE INDEX "SystemEvent_severity_idx" ON "SystemEvent"("severity");
CREATE INDEX "SystemEvent_status_idx" ON "SystemEvent"("status");
CREATE INDEX "SystemEvent_createdAt_idx" ON "SystemEvent"("createdAt");

ALTER TABLE "SystemEvent" ADD CONSTRAINT "SystemEvent_actorAdminId_fkey" FOREIGN KEY ("actorAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SystemEvent" ADD CONSTRAINT "SystemEvent_targetAdminId_fkey" FOREIGN KEY ("targetAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
