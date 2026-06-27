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
