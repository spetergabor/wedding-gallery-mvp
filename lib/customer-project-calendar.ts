import { APP_TIME_ZONE } from "@/lib/date-format";

type CustomerProjectCalendarPayload = {
  uid: string;
  title: string;
  eventDate: Date;
  startTime?: string | null;
  endTime?: string | null;
  location?: string | null;
  description?: string | null;
  url?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
};

function formatIcsUtcDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function calendarDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";

  return `${year}${month}${day}`;
}

function addCalendarDays(date: string, days: number) {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(4, 6));
  const day = Number(date.slice(6, 8));
  const nextDate = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0));

  return calendarDate(nextDate);
}

function calendarTime(time: string | null | undefined) {
  const match = time?.trim().match(/^([01]\d|2[0-3]):([0-5]\d)$/);

  if (!match) {
    return null;
  }

  return `${match[1]}${match[2]}00`;
}

function isEndOnNextDay(startTime: string, endTime: string) {
  return endTime <= startTime;
}

function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function foldIcsLine(line: string) {
  const chunks: string[] = [];
  let remaining = line;

  while (remaining.length > 73) {
    chunks.push(remaining.slice(0, 73));
    remaining = ` ${remaining.slice(73)}`;
  }

  chunks.push(remaining);
  return chunks.join("\r\n");
}

function safeCalendarFilename(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "projekt";
}

export function customerProjectCalendarFilename(title: string) {
  return `${safeCalendarFilename(title)}.ics`;
}

export function customerProjectCalendarUid(projectId: string) {
  return `customer-project-${projectId}@spetly.app`;
}

export function buildCustomerProjectCalendarIcs(payload: CustomerProjectCalendarPayload) {
  const now = new Date();
  const date = calendarDate(payload.eventDate);
  const startTime = calendarTime(payload.startTime);
  const endTime = calendarTime(payload.endTime);
  const dateLines =
    startTime && endTime
      ? [
          `DTSTART;TZID=${APP_TIME_ZONE}:${date}T${startTime}`,
          `DTEND;TZID=${APP_TIME_ZONE}:${isEndOnNextDay(startTime, endTime) ? addCalendarDays(date, 1) : date}T${endTime}`
        ]
      : [`DTSTART;VALUE=DATE:${date}`, `DTEND;VALUE=DATE:${addCalendarDays(date, 1)}`];
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SPETER Gallery//Customer Project//HU",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-TIMEZONE:${APP_TIME_ZONE}`,
    "BEGIN:VEVENT",
    `UID:${payload.uid}`,
    `DTSTAMP:${formatIcsUtcDate(now)}`,
    `CREATED:${formatIcsUtcDate(payload.createdAt ?? now)}`,
    `LAST-MODIFIED:${formatIcsUtcDate(payload.updatedAt ?? now)}`,
    ...dateLines,
    `SUMMARY:${escapeIcsText(payload.title)}`,
    "STATUS:CONFIRMED",
    "SEQUENCE:0"
  ];

  if (payload.location?.trim()) {
    lines.push(`LOCATION:${escapeIcsText(payload.location.trim())}`);
  }

  if (payload.description?.trim()) {
    lines.push(`DESCRIPTION:${escapeIcsText(payload.description.trim())}`);
  }

  if (payload.url?.trim()) {
    lines.push(`URL:${payload.url.trim()}`);
  }

  lines.push("END:VEVENT", "END:VCALENDAR");

  return `${lines.map(foldIcsLine).join("\r\n")}\r\n`;
}
