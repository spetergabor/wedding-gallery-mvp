type GoogleCalendarAllDayEvent = {
  title: string;
  date: Date;
  location?: string | null;
  details?: string | null;
};

function googleCalendarDate(date: Date) {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

function addUtcDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
}

export function googleCalendarAllDayUrl({ title, date, location, details }: GoogleCalendarAllDayEvent) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${googleCalendarDate(date)}/${googleCalendarDate(addUtcDays(date, 1))}`
  });

  if (location?.trim()) {
    params.set("location", location.trim());
  }

  if (details?.trim()) {
    params.set("details", details.trim());
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
