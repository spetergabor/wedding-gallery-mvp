type MiniSessionCalendarStatus = "CONFIRMED" | "CANCELLED";
type MiniSessionCalendarMethod = "PUBLISH" | "CANCEL";

type MiniSessionCalendarPayload = {
  uid: string;
  sessionTitle: string;
  location: string;
  startsAt: Date;
  endsAt: Date;
  description?: string;
  url?: string;
  createdAt?: Date;
  updatedAt?: Date;
  method?: MiniSessionCalendarMethod;
  status?: MiniSessionCalendarStatus;
  sequence?: number;
};

function formatIcsDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
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

  return normalized || "mini-session";
}

export function miniSessionCalendarFilename(sessionTitle: string, status: MiniSessionCalendarStatus = "CONFIRMED") {
  const suffix = status === "CANCELLED" ? "-cancelled" : "";
  return `${safeCalendarFilename(sessionTitle)}${suffix}.ics`;
}

export function buildMiniSessionCalendarIcs(payload: MiniSessionCalendarPayload) {
  const now = new Date();
  const method = payload.method ?? (payload.status === "CANCELLED" ? "CANCEL" : "PUBLISH");
  const status = payload.status ?? "CONFIRMED";
  const sequence = payload.sequence ?? (status === "CANCELLED" ? 1 : 0);
  const summaryPrefix = status === "CANCELLED" ? "Törölve: " : "";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SPETER Gallery//Mini Session//HU",
    "CALSCALE:GREGORIAN",
    `METHOD:${method}`,
    "BEGIN:VEVENT",
    `UID:${payload.uid}`,
    `DTSTAMP:${formatIcsDate(now)}`,
    `CREATED:${formatIcsDate(payload.createdAt ?? now)}`,
    `LAST-MODIFIED:${formatIcsDate(payload.updatedAt ?? now)}`,
    `DTSTART:${formatIcsDate(payload.startsAt)}`,
    `DTEND:${formatIcsDate(payload.endsAt)}`,
    `SUMMARY:${escapeIcsText(`${summaryPrefix}${payload.sessionTitle}`)}`,
    `LOCATION:${escapeIcsText(payload.location)}`,
    `STATUS:${status}`,
    `SEQUENCE:${sequence}`
  ];

  if (payload.description) {
    lines.push(`DESCRIPTION:${escapeIcsText(payload.description)}`);
  }

  if (payload.url) {
    lines.push(`URL:${payload.url}`);
  }

  lines.push("END:VEVENT", "END:VCALENDAR");

  return `${lines.map(foldIcsLine).join("\r\n")}\r\n`;
}
