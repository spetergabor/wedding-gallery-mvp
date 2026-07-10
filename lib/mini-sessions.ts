import { APP_TIME_ZONE } from "@/lib/date-format";
import { dateLocaleForCustomer, type CustomerLanguage } from "@/lib/customer-language";

export const MINI_SESSION_BOOKING_STATUS_BOOKED = "booked";
export const MINI_SESSION_BOOKING_STATUS_COMPLETED = "completed";
export const MINI_SESSION_BOOKING_STATUS_NO_SHOW = "no_show";
export const MINI_SESSION_BOOKING_STATUS_CANCELLED = "cancelled";
export const MINI_SESSION_BOOKING_SOURCE_CLIENT = "client";
export const MINI_SESSION_BOOKING_SOURCE_MANUAL = "manual";
export const MINI_SESSION_BOOKING_SOURCE_BLOCKED = "blocked";
export const MINI_SESSION_BOOKING_MODE_SINGLE_DAY = "single_day";
export const MINI_SESSION_BOOKING_MODE_RECURRING = "recurring";
export const MINI_SESSION_LANGUAGES = [
  { value: "hu", label: "Magyar" },
  { value: "de", label: "Deutsch" }
] as const;
export const MINI_SESSION_WEEKDAYS = [
  { value: 1, label: "Hétfő", shortLabel: "H" },
  { value: 2, label: "Kedd", shortLabel: "K" },
  { value: 3, label: "Szerda", shortLabel: "Sze" },
  { value: 4, label: "Csütörtök", shortLabel: "Cs" },
  { value: 5, label: "Péntek", shortLabel: "P" },
  { value: 6, label: "Szombat", shortLabel: "Szo" },
  { value: 0, label: "Vasárnap", shortLabel: "V" }
] as const;
export const MINI_SESSION_MIN_BOOKING_NOTICE_OPTIONS = [
  { value: 0, labelHu: "Nincs minimum", labelDe: "Kein Minimum" },
  { value: 60, labelHu: "1 órával előtte", labelDe: "1 Stunde vorher" },
  { value: 120, labelHu: "2 órával előtte", labelDe: "2 Stunden vorher" },
  { value: 240, labelHu: "4 órával előtte", labelDe: "4 Stunden vorher" },
  { value: 720, labelHu: "12 órával előtte", labelDe: "12 Stunden vorher" },
  { value: 1440, labelHu: "24 órával előtte", labelDe: "24 Stunden vorher" },
  { value: 2880, labelHu: "48 órával előtte", labelDe: "48 Stunden vorher" },
  { value: 4320, labelHu: "72 órával előtte", labelDe: "72 Stunden vorher" }
] as const;

export type MiniSessionLanguage = CustomerLanguage;
export type MiniSessionSlot = { startsAt: Date; endsAt: Date; token: string };
export type MiniSessionBusyTime = { startsAt: Date; endsAt: Date };

export function normalizeMiniSessionLanguage(value: string | null | undefined): MiniSessionLanguage {
  return value === "de" ? "de" : "hu";
}

export function miniSessionLanguageLabel(value: string | null | undefined) {
  return normalizeMiniSessionLanguage(value) === "de" ? "Deutsch" : "Magyar";
}

type MiniSessionLike = {
  bookingMode?: string | null;
  bookingWindowDays?: number | null;
  sessionDate?: Date;
  startsAt: Date;
  endsAt: Date;
  durationMinutes: number;
  minBookingNoticeMinutes?: number | null;
  availabilityRules?: Array<{
    weekday: number;
    startsAt: string;
    endsAt: string;
    isActive: boolean;
  }>;
};

function slotToken(date: Date) {
  return date.toISOString();
}

function timeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second)
  );

  return asUtc - date.getTime();
}

export function parseMiniSessionLocalDateTime(date: string, time: string) {
  if (!date || !time) {
    return null;
  }

  const [year, month, day] = date.split("-").map((part) => Number.parseInt(part, 10));
  const [hour, minute] = time.split(":").map((part) => Number.parseInt(part, 10));

  if (![year, month, day, hour, minute].every(Number.isFinite)) {
    return null;
  }

  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const offset = timeZoneOffsetMs(utcGuess, APP_TIME_ZONE);
  const value = new Date(utcGuess.getTime() - offset);
  const refinedOffset = timeZoneOffsetMs(value, APP_TIME_ZONE);

  return new Date(utcGuess.getTime() - refinedOffset);
}

function dateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(date);

  return {
    year: parts.find((part) => part.type === "year")?.value ?? "1970",
    month: parts.find((part) => part.type === "month")?.value ?? "01",
    day: parts.find((part) => part.type === "day")?.value ?? "01",
    hour: parts.find((part) => part.type === "hour")?.value ?? "00",
    minute: parts.find((part) => part.type === "minute")?.value ?? "00"
  };
}

export function miniSessionDateKey(date: Date) {
  const parts = dateParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function addDateKeyDays(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map((part) => Number.parseInt(part, 10));
  const date = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0));

  return date.toISOString().slice(0, 10);
}

function weekdayFromDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map((part) => Number.parseInt(part, 10));

  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).getUTCDay();
}

function isTimeValue(value: string) {
  return /^\d{2}:\d{2}$/.test(value);
}

export function formatMiniSessionDate(date: Date, language: MiniSessionLanguage = "hu") {
  return date.toLocaleDateString(dateLocaleForCustomer(language), {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: APP_TIME_ZONE
  });
}

export function formatMiniSessionDateRange(startsAt: Date, endsAt: Date, language: MiniSessionLanguage = "hu") {
  const startDate = formatMiniSessionDate(startsAt, language);
  const endDate = formatMiniSessionDate(endsAt, language);

  if (miniSessionDateKey(startsAt) === miniSessionDateKey(endsAt)) {
    return startDate;
  }

  return `${startDate} - ${endDate}`;
}

export function formatMiniSessionTime(date: Date, language: MiniSessionLanguage = "hu") {
  return date.toLocaleTimeString(dateLocaleForCustomer(language), {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIME_ZONE
  });
}

export function formatMiniSessionSlot(startsAt: Date, endsAt: Date, language: MiniSessionLanguage = "hu") {
  return `${formatMiniSessionTime(startsAt, language)}-${formatMiniSessionTime(endsAt, language)}`;
}

export function formatMiniSessionSlotWithDate(startsAt: Date, endsAt: Date, language: MiniSessionLanguage = "hu") {
  return `${formatMiniSessionDate(startsAt, language)} · ${formatMiniSessionSlot(startsAt, endsAt, language)}`;
}

function createSlotsFromWindow(startsAt: Date, endsAt: Date, durationMinutes: number) {
  const slots: MiniSessionSlot[] = [];
  const durationMs = durationMinutes * 60 * 1000;

  if (durationMs <= 0 || endsAt <= startsAt) {
    return slots;
  }

  let slotStartsAt = new Date(startsAt);

  while (slotStartsAt.getTime() + durationMs <= endsAt.getTime()) {
    const slotEndsAt = new Date(slotStartsAt.getTime() + durationMs);
    slots.push({ startsAt: slotStartsAt, endsAt: slotEndsAt, token: slotToken(slotStartsAt) });
    slotStartsAt = slotEndsAt;
  }

  return slots;
}

function createDailySlotsFromDateRange(startsAt: Date, endsAt: Date, durationMinutes: number) {
  const startDateKey = miniSessionDateKey(startsAt);
  const endDateKey = miniSessionDateKey(endsAt);

  if (startDateKey === endDateKey) {
    return createSlotsFromWindow(startsAt, endsAt, durationMinutes);
  }

  const slots: MiniSessionSlot[] = [];
  const startTime = miniSessionTimeInput(startsAt);
  const endTime = miniSessionTimeInput(endsAt);
  let dateKey = startDateKey;

  for (let dayIndex = 0; dayIndex < 180; dayIndex += 1) {
    const dayStartsAt = parseMiniSessionLocalDateTime(dateKey, startTime);
    const dayEndsAt = parseMiniSessionLocalDateTime(dateKey, endTime);

    if (dayStartsAt && dayEndsAt && dayEndsAt > dayStartsAt) {
      const windowStartsAt = dayStartsAt < startsAt ? startsAt : dayStartsAt;
      const windowEndsAt = dayEndsAt > endsAt ? endsAt : dayEndsAt;
      slots.push(...createSlotsFromWindow(windowStartsAt, windowEndsAt, durationMinutes));
    }

    if (dateKey === endDateKey) {
      break;
    }

    dateKey = addDateKeyDays(dateKey, 1);
  }

  return slots;
}

export function createMiniSessionSlots(
  session: MiniSessionLike,
  options: { rangeStart?: Date; rangeDays?: number } = {}
) {
  if (session.bookingMode === MINI_SESSION_BOOKING_MODE_RECURRING) {
    const rangeDays = Math.min(180, Math.max(1, options.rangeDays ?? session.bookingWindowDays ?? 60));
    const todayKey = miniSessionDateKey(options.rangeStart ?? new Date());
    const sessionStartKey = miniSessionDateKey(session.sessionDate ?? session.startsAt);
    const firstDateKey = sessionStartKey > todayKey ? sessionStartKey : todayKey;
    const rules = (session.availabilityRules ?? [])
      .filter((rule) => rule.isActive && isTimeValue(rule.startsAt) && isTimeValue(rule.endsAt));
    const fallbackWeekday = weekdayFromDateKey(sessionStartKey);
    const activeRules = rules.length > 0
      ? rules
      : [{ weekday: fallbackWeekday, startsAt: miniSessionTimeInput(session.startsAt), endsAt: miniSessionTimeInput(session.endsAt), isActive: true }];
    const slots: MiniSessionSlot[] = [];

    for (let dayOffset = 0; dayOffset < rangeDays; dayOffset += 1) {
      const dateKey = addDateKeyDays(firstDateKey, dayOffset);
      const weekday = weekdayFromDateKey(dateKey);
      const dayRules = activeRules.filter((rule) => rule.weekday === weekday);

      for (const rule of dayRules) {
        const startsAt = parseMiniSessionLocalDateTime(dateKey, rule.startsAt);
        const endsAt = parseMiniSessionLocalDateTime(dateKey, rule.endsAt);

        if (!startsAt || !endsAt) {
          continue;
        }

        slots.push(...createSlotsFromWindow(startsAt, endsAt, session.durationMinutes));
      }
    }

    return slots;
  }

  return createDailySlotsFromDateRange(session.startsAt, session.endsAt, session.durationMinutes);
}

export function miniSessionSlotOverlaps(slot: MiniSessionBusyTime, busyTime: MiniSessionBusyTime) {
  return slot.startsAt < busyTime.endsAt && slot.endsAt > busyTime.startsAt;
}

export function filterMiniSessionSlotsByBusyTimes(slots: MiniSessionSlot[], busyTimes: MiniSessionBusyTime[]) {
  if (busyTimes.length === 0) {
    return slots;
  }

  return slots.filter((slot) => !busyTimes.some((busyTime) => miniSessionSlotOverlaps(slot, busyTime)));
}

export function normalizeMiniSessionMinBookingNoticeMinutes(value: number | null | undefined) {
  if (!value || !Number.isFinite(value)) {
    return 0;
  }

  return Math.min(30 * 24 * 60, Math.max(0, Math.trunc(value)));
}

export function miniSessionMinBookingNoticeLabel(value: number | null | undefined, language: MiniSessionLanguage = "hu") {
  const minutes = normalizeMiniSessionMinBookingNoticeMinutes(value);
  const option = MINI_SESSION_MIN_BOOKING_NOTICE_OPTIONS.find((candidate) => candidate.value === minutes);

  if (option) {
    return language === "de" ? option.labelDe : option.labelHu;
  }

  if (minutes < 60) {
    return language === "de" ? `${minutes} Minuten vorher` : `${minutes} perccel előtte`;
  }

  if (minutes % 1440 === 0) {
    const days = minutes / 1440;
    return language === "de" ? `${days} Tage vorher` : `${days} nappal előtte`;
  }

  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return language === "de" ? `${hours} Stunden vorher` : `${hours} órával előtte`;
  }

  return language === "de" ? `${minutes} Minuten vorher` : `${minutes} perccel előtte`;
}

export function miniSessionBookingDeadline(value: number | null | undefined, now = new Date()) {
  return new Date(now.getTime() + normalizeMiniSessionMinBookingNoticeMinutes(value) * 60 * 1000);
}

export function isMiniSessionSlotBookable(
  slot: Pick<MiniSessionSlot, "startsAt">,
  minBookingNoticeMinutes: number | null | undefined,
  now = new Date()
) {
  return slot.startsAt.getTime() >= miniSessionBookingDeadline(minBookingNoticeMinutes, now).getTime();
}

export function filterMiniSessionSlotsByBookingNotice(
  slots: MiniSessionSlot[],
  minBookingNoticeMinutes: number | null | undefined,
  now = new Date()
) {
  return slots.filter((slot) => isMiniSessionSlotBookable(slot, minBookingNoticeMinutes, now));
}

export function groupMiniSessionSlotsByDate(slots: MiniSessionSlot[], language: MiniSessionLanguage = "hu") {
  const groups: Array<{ key: string; label: string; slots: MiniSessionSlot[] }> = [];
  const groupByKey = new Map<string, { key: string; label: string; slots: MiniSessionSlot[] }>();

  for (const slot of slots) {
    const key = miniSessionDateKey(slot.startsAt);
    const existing = groupByKey.get(key);

    if (existing) {
      existing.slots.push(slot);
      continue;
    }

    const group = {
      key,
      label: formatMiniSessionDate(slot.startsAt, language),
      slots: [slot]
    };

    groupByKey.set(key, group);
    groups.push(group);
  }

  return groups;
}

export function miniSessionModeLabel(value: string | null | undefined) {
  return value === MINI_SESSION_BOOKING_MODE_RECURRING ? "Állandó szolgáltatás" : "Mini session nap";
}

export function miniSessionDateInput(session: { startsAt: Date }) {
  const parts = dateParts(session.startsAt);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function miniSessionEndDateInput(session: { endsAt: Date }) {
  const parts = dateParts(session.endsAt);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function miniSessionTimeInput(date: Date) {
  const parts = dateParts(date);
  return `${parts.hour}:${parts.minute}`;
}

export function normalizeMiniSessionWeekday(value: string | null | undefined) {
  const weekday = Number.parseInt(value ?? "", 10);

  return MINI_SESSION_WEEKDAYS.some((candidate) => candidate.value === weekday) ? weekday : null;
}

export function normalizeBookingWindowDays(value: number | null | undefined) {
  if (!value || !Number.isFinite(value)) {
    return 60;
  }

  return Math.min(180, Math.max(7, Math.trunc(value)));
}
