export const CUSTOMER_MEETING_TYPES = [
  { value: "consultation", label: "Konzultáció" },
  { value: "timeline", label: "Esküvői timeline egyeztetés" },
  { value: "location_walkthrough", label: "Helyszínbejárás" },
  { value: "handover", label: "Átadás / záró meeting" },
  { value: "other", label: "Egyéb meeting" }
] as const;

export const CUSTOMER_MEETING_STATUSES = [
  { value: "planned", label: "Tervezve" },
  { value: "completed", label: "Megtartva" },
  { value: "cancelled", label: "Lemondva" }
] as const;

const meetingTypeValues = new Set(CUSTOMER_MEETING_TYPES.map((type) => type.value));
const meetingStatusValues = new Set(CUSTOMER_MEETING_STATUSES.map((status) => status.value));

export function normalizeCustomerMeetingType(value: string | null | undefined) {
  return value && meetingTypeValues.has(value as (typeof CUSTOMER_MEETING_TYPES)[number]["value"]) ? value : "consultation";
}

export function normalizeCustomerMeetingStatus(value: string | null | undefined) {
  return value && meetingStatusValues.has(value as (typeof CUSTOMER_MEETING_STATUSES)[number]["value"]) ? value : "planned";
}

export function customerMeetingTypeLabel(value: string | null | undefined) {
  const normalizedValue = normalizeCustomerMeetingType(value);
  return CUSTOMER_MEETING_TYPES.find((type) => type.value === normalizedValue)?.label ?? normalizedValue;
}

export function customerMeetingStatusLabel(value: string | null | undefined) {
  const normalizedValue = normalizeCustomerMeetingStatus(value);
  return CUSTOMER_MEETING_STATUSES.find((status) => status.value === normalizedValue)?.label ?? normalizedValue;
}
