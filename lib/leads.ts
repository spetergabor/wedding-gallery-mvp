import type { AdminLanguage } from "@/lib/admin-language";

export const LEAD_STATUSES = [
  { key: "requested", label: { hu: "Megkeresés", de: "Angefragt", en: "Inquiry" } },
  { key: "answered", label: { hu: "Megválaszolva", de: "Beantwortet", en: "Answered" } },
  { key: "meeting", label: { hu: "Egyeztetés", de: "Besprechung", en: "Consultation" } },
  { key: "booking", label: { hu: "Foglalási folyamat", de: "Buchungsprozess", en: "Booking process" } },
  { key: "booked", label: { hu: "Lefoglalva", de: "Gebucht", en: "Booked" } },
  { key: "follow_up", label: { hu: "Utókövetés", de: "Nachbearbeiten", en: "Follow-up" } }
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number]["key"];

export function normalizeLeadStatus(value: string | null | undefined): LeadStatus {
  return LEAD_STATUSES.some((status) => status.key === value) ? (value as LeadStatus) : "requested";
}

export const LEAD_EVENT_TYPES = [
  { key: "wedding", label: { hu: "Esküvő", de: "Hochzeit", en: "Wedding" } },
  { key: "mini_session", label: { hu: "Mini session", de: "Mini Session", en: "Mini session" } },
  { key: "family", label: { hu: "Család", de: "Familie", en: "Family" } },
  { key: "newborn", label: { hu: "Újszülött", de: "Neugeborene", en: "Newborn" } },
  { key: "engagement", label: { hu: "Jegyesfotózás", de: "Verlobung", en: "Engagement" } },
  { key: "business", label: { hu: "Business", de: "Business", en: "Business" } },
  { key: "other", label: { hu: "Egyéb", de: "Sonstiges", en: "Other" } }
] as const;

export type LeadEventType = (typeof LEAD_EVENT_TYPES)[number]["key"];

export function normalizeLeadEventType(value: string | null | undefined): LeadEventType {
  return LEAD_EVENT_TYPES.some((type) => type.key === value) ? (value as LeadEventType) : "wedding";
}

export function leadStatusLabel(value: string, language: AdminLanguage = "hu") {
  return LEAD_STATUSES.find((status) => status.key === value)?.label[language] ?? LEAD_STATUSES[0].label[language];
}

export function leadEventTypeLabel(value: string, language: AdminLanguage = "hu") {
  return LEAD_EVENT_TYPES.find((type) => type.key === value)?.label[language] ?? LEAD_EVENT_TYPES[LEAD_EVENT_TYPES.length - 1].label[language];
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
