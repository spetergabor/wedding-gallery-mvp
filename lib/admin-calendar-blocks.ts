import { MINI_SESSION_BOOKING_MODE_RECURRING } from "@/lib/mini-sessions";

export const ADMIN_CALENDAR_BLOCK_SCOPE_ALL = "all";
export const ADMIN_CALENDAR_BLOCK_SCOPE_RECURRING = "recurring";
export const ADMIN_CALENDAR_BLOCK_SCOPE_SELECTED = "selected";

export type AdminCalendarBlockScope =
  | typeof ADMIN_CALENDAR_BLOCK_SCOPE_ALL
  | typeof ADMIN_CALENDAR_BLOCK_SCOPE_RECURRING
  | typeof ADMIN_CALENDAR_BLOCK_SCOPE_SELECTED;

type CalendarBlockAudience = {
  scope?: string | null;
  targets?: Array<{ miniSessionId: string }>;
};

type CalendarBlockSession = {
  id: string;
  bookingMode?: string | null;
};

export function normalizeAdminCalendarBlockScope(value: string | null | undefined): AdminCalendarBlockScope {
  if (value === ADMIN_CALENDAR_BLOCK_SCOPE_RECURRING || value === ADMIN_CALENDAR_BLOCK_SCOPE_SELECTED) {
    return value;
  }

  return ADMIN_CALENDAR_BLOCK_SCOPE_ALL;
}

export function adminCalendarBlockAppliesToSession(
  block: CalendarBlockAudience,
  session: CalendarBlockSession
) {
  const scope = normalizeAdminCalendarBlockScope(block.scope);

  if (scope === ADMIN_CALENDAR_BLOCK_SCOPE_ALL) {
    return true;
  }

  if (scope === ADMIN_CALENDAR_BLOCK_SCOPE_RECURRING) {
    return session.bookingMode === MINI_SESSION_BOOKING_MODE_RECURRING;
  }

  return block.targets?.some((target) => target.miniSessionId === session.id) ?? false;
}

export function adminCalendarBlockScopeLabel(
  block: CalendarBlockAudience,
  targetTitles: string[] = []
) {
  const scope = normalizeAdminCalendarBlockScope(block.scope);

  if (scope === ADMIN_CALENDAR_BLOCK_SCOPE_RECURRING) {
    return "Csak állandó szolgáltatások";
  }

  if (scope === ADMIN_CALENDAR_BLOCK_SCOPE_SELECTED) {
    return targetTitles.length > 0 ? targetTitles.join(", ") : "Kiválasztott foglalók";
  }

  return "Minden foglaló";
}
