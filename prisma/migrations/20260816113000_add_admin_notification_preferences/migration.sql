CREATE TABLE "AdminNotificationPreference" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "topics" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminNotificationPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminNotificationPreference_adminId_key" ON "AdminNotificationPreference"("adminId");
CREATE INDEX "AdminNotificationPreference_adminId_idx" ON "AdminNotificationPreference"("adminId");

ALTER TABLE "AdminNotificationPreference"
ADD CONSTRAINT "AdminNotificationPreference_adminId_fkey"
FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
