import { APP_TIME_ZONE } from "@/lib/date-format";
import { dateLocaleForCustomer, type CustomerLanguage } from "@/lib/customer-language";

export const MINI_SESSION_BOOKING_STATUS_BOOKED = "booked";
export const MINI_SESSION_BOOKING_STATUS_CANCELLED = "cancelled";
export const MINI_SESSION_BOOKING_SOURCE_CLIENT = "client";
export const MINI_SESSION_BOOKING_SOURCE_MANUAL = "manual";
export const MINI_SESSION_BOOKING_SOURCE_BLOCKED = "blocked";
export const MINI_SESSION_LANGUAGES = [
  { value: "hu", label: "Magyar" },
  { value: "de", label: "Deutsch" }
] as const;

export type MiniSessionLanguage = CustomerLanguage;

export function normalizeMiniSessionLanguage(value: string | null | undefined): MiniSessionLanguage {
  return value === "de" ? "de" : "hu";
}

export function miniSessionLanguageLabel(value: string | null | undefined) {
  return normalizeMiniSessionLanguage(value) === "de" ? "Deutsch" : "Magyar";
}

type MiniSessionLike = {
  startsAt: Date;
  endsAt: Date;
  durationMinutes: number;
};

function slotToken(date: Date) {
  return date.toISOString();
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

export function formatMiniSessionDate(date: Date, language: MiniSessionLanguage = "hu") {
  return date.toLocaleDateString(dateLocaleForCustomer(language), {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: APP_TIME_ZONE
  });
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

export function createMiniSessionSlots(session: MiniSessionLike) {
  const slots: Array<{ startsAt: Date; endsAt: Date; token: string }> = [];
  const durationMs = session.durationMinutes * 60 * 1000;

  if (durationMs <= 0 || session.endsAt <= session.startsAt) {
    return slots;
  }

  let startsAt = new Date(session.startsAt);

  while (startsAt.getTime() + durationMs <= session.endsAt.getTime()) {
    const endsAt = new Date(startsAt.getTime() + durationMs);
    slots.push({ startsAt, endsAt, token: slotToken(startsAt) });
    startsAt = endsAt;
  }

  return slots;
}

export function miniSessionDateInput(session: { startsAt: Date }) {
  const parts = dateParts(session.startsAt);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function miniSessionTimeInput(date: Date) {
  const parts = dateParts(date);
  return `${parts.hour}:${parts.minute}`;
}
