ALTER TABLE "AdminCalendarBlock"
  ADD COLUMN "scope" TEXT NOT NULL DEFAULT 'all';

CREATE INDEX "AdminCalendarBlock_adminId_scope_startsAt_idx"
  ON "AdminCalendarBlock"("adminId", "scope", "startsAt");

CREATE TABLE "AdminCalendarBlockTarget" (
  "blockId" TEXT NOT NULL,
  "miniSessionId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AdminCalendarBlockTarget_pkey" PRIMARY KEY ("blockId", "miniSessionId")
);

CREATE INDEX "AdminCalendarBlockTarget_miniSessionId_idx"
  ON "AdminCalendarBlockTarget"("miniSessionId");

ALTER TABLE "AdminCalendarBlockTarget"
  ADD CONSTRAINT "AdminCalendarBlockTarget_blockId_fkey"
  FOREIGN KEY ("blockId") REFERENCES "AdminCalendarBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AdminCalendarBlockTarget"
  ADD CONSTRAINT "AdminCalendarBlockTarget_miniSessionId_fkey"
  FOREIGN KEY ("miniSessionId") REFERENCES "MiniSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
