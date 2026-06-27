export const LEAD_STATUSES = [
  { key: "requested", label: "Angefragt" },
  { key: "answered", label: "Beantwortet" },
  { key: "meeting", label: "Besprechung" },
  { key: "booking", label: "Buchungsprozess" },
  { key: "booked", label: "Gebucht" },
  { key: "follow_up", label: "Nachbearbeiten" }
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number]["key"];

export function normalizeLeadStatus(value: string | null | undefined): LeadStatus {
  return LEAD_STATUSES.some((status) => status.key === value) ? (value as LeadStatus) : "requested";
}

export const LEAD_EVENT_TYPES = [
  { key: "wedding", label: "Hochzeit" },
  { key: "family", label: "Familie" },
  { key: "newborn", label: "Neugeborenen" },
  { key: "engagement", label: "Verlobung" },
  { key: "business", label: "Business" },
  { key: "other", label: "Egyéb" }
] as const;

export type LeadEventType = (typeof LEAD_EVENT_TYPES)[number]["key"];

export function normalizeLeadEventType(value: string | null | undefined): LeadEventType {
  return LEAD_EVENT_TYPES.some((type) => type.key === value) ? (value as LeadEventType) : "wedding";
}

export function leadEventTypeLabel(value: string) {
  return LEAD_EVENT_TYPES.find((type) => type.key === value)?.label ?? "Egyéb";
}

export async function ensureLeadPipelineSchema(prismaClient: {
  $executeRawUnsafe: (query: string) => Promise<unknown>;
}) {
  await prismaClient.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Lead" (
      "id" TEXT NOT NULL,
      "adminId" TEXT,
      "name" TEXT NOT NULL,
      "email" TEXT,
      "phone" TEXT,
      "eventType" TEXT NOT NULL DEFAULT 'wedding',
      "eventDate" TIMESTAMP(3),
      "venue" TEXT,
      "status" TEXT NOT NULL DEFAULT 'requested',
      "notes" TEXT,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
    )
  `);
  await prismaClient.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Lead_adminId_idx" ON "Lead"("adminId")`);
  await prismaClient.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Lead_status_idx" ON "Lead"("status")`);
  await prismaClient.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Lead_sortOrder_idx" ON "Lead"("sortOrder")`);
  await prismaClient.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Lead_eventDate_idx" ON "Lead"("eventDate")`);
  await prismaClient.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Lead_email_idx" ON "Lead"("email")`);
  await prismaClient.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'Lead_adminId_fkey'
      ) THEN
        ALTER TABLE "Lead"
        ADD CONSTRAINT "Lead_adminId_fkey"
        FOREIGN KEY ("adminId") REFERENCES "Admin"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
    END $$;
  `);
}
