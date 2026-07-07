import { APP_TIME_ZONE } from "@/lib/date-format";

type GoogleCalendarEvent = {
  title: string;
  date: Date;
  startTime?: string | null;
  endTime?: string | null;
  location?: string | null;
  details?: string | null;
};

function googleCalendarDate(date: Date) {
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

function addCalendarDays(calendarDate: string, days: number) {
  const year = Number(calendarDate.slice(0, 4));
  const month = Number(calendarDate.slice(4, 6));
  const day = Number(calendarDate.slice(6, 8));
  const nextDate = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0));

  return googleCalendarDate(nextDate);
}

function googleCalendarTime(time: string | null | undefined) {
  const match = time?.trim().match(/^([01]\d|2[0-3]):([0-5]\d)$/);

  if (!match) {
    return null;
  }

  return `${match[1]}${match[2]}00`;
}

function isEndOnNextDay(startTime: string, endTime: string) {
  return endTime <= startTime;
}

export function googleCalendarUrl({ title, date, startTime, endTime, location, details }: GoogleCalendarEvent) {
  const calendarDate = googleCalendarDate(date);
  const calendarStartTime = googleCalendarTime(startTime);
  const calendarEndTime = googleCalendarTime(endTime);
  const dates =
    calendarStartTime && calendarEndTime
      ? `${calendarDate}T${calendarStartTime}/${isEndOnNextDay(calendarStartTime, calendarEndTime) ? addCalendarDays(calendarDate, 1) : calendarDate}T${calendarEndTime}`
      : `${calendarDate}/${addCalendarDays(calendarDate, 1)}`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates,
    ctz: APP_TIME_ZONE
  });

  if (location?.trim()) {
    params.set("location", location.trim());
  }

  if (details?.trim()) {
    params.set("details", details.trim());
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export const googleCalendarAllDayUrl = googleCalendarUrl;
