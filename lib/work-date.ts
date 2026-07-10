import { APP_TIME_ZONE } from "@/lib/date-format";

type DateParts = {
  year: number;
  month: number;
  day: number;
};

function datePartsInAppTimeZone(date: Date): DateParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);

  return {
    year: value("year"),
    month: value("month"),
    day: value("day")
  };
}

function timeZoneOffsetMs(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    hourCycle: "h23"
  }).formatToParts(date);

  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(value("year"), value("month") - 1, value("day"), value("hour"), value("minute"), value("second"));

  return asUtc - date.getTime();
}

export function workDateTimeInAppTimeZone(
  date: Date,
  time: string | null | undefined,
  fallback: "start" | "end" = "start"
) {
  const parts = datePartsInAppTimeZone(date);
  const fallbackTime = fallback === "end" ? "23:59" : "00:00";
  const [hour = 0, minute = 0] = (time || fallbackTime).split(":").map((part) => Number.parseInt(part, 10));
  const second = fallback === "end" && !time ? 59 : 0;
  const millisecond = fallback === "end" && !time ? 999 : 0;
  const utcGuess = Date.UTC(parts.year, parts.month - 1, parts.day, hour, minute, second, millisecond);
  const offset = timeZoneOffsetMs(new Date(utcGuess));

  return new Date(utcGuess - offset);
}

export function workEndsAfterNow(date: Date | null | undefined, endTime: string | null | undefined, now = new Date()) {
  if (!date) {
    return false;
  }

  return workDateTimeInAppTimeZone(date, endTime, "end").getTime() > now.getTime();
}

export function workEndDate(date: Date, endTime: string | null | undefined) {
  return workDateTimeInAppTimeZone(date, endTime, "end");
}
