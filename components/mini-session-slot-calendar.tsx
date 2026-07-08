"use client";

import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";

type MiniSessionSlotCalendarLanguage = "hu" | "de";

export type MiniSessionSlotCalendarDay = {
  key: string;
  label: string;
  slots: Array<{
    token: string;
    label: string;
  }>;
};

type CalendarDayCell = {
  key: string;
  dayNumber: number;
  inMonth: boolean;
  availableDay: MiniSessionSlotCalendarDay | null;
};

const WEEKDAYS = {
  hu: ["H", "K", "Sze", "Cs", "P", "Szo", "V"],
  de: ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]
} as const;

const COPY = {
  hu: {
    availableDays: "Foglalható napok",
    availableSlots: "Elérhető idősávok",
    noDay: "Válassz egy foglalható napot",
    backToCalendar: "Teljes naptár"
  },
  de: {
    availableDays: "Verfügbare Tage",
    availableSlots: "Verfügbare Zeiten",
    noDay: "Wähle einen verfügbaren Tag",
    backToCalendar: "Alle Tage"
  }
} as const;

function addUtcDays(date: Date, days: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days, 12, 0, 0));
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatMonthLabel(monthKey: string, language: MiniSessionSlotCalendarLanguage) {
  const [year, month] = monthKey.split("-").map((part) => Number.parseInt(part, 10));
  const locale = language === "de" ? "de-AT" : "hu-HU";

  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(Date.UTC(year, month - 1, 1, 12, 0, 0)));
}

function buildMonthCells(monthKey: string, dayMap: Map<string, MiniSessionSlotCalendarDay>) {
  const [year, month] = monthKey.split("-").map((part) => Number.parseInt(part, 10));
  const firstDay = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0));
  const firstWeekdayFromMonday = (firstDay.getUTCDay() + 6) % 7;
  const gridStart = addUtcDays(firstDay, -firstWeekdayFromMonday);
  const cells: CalendarDayCell[] = [];

  for (let index = 0; index < 42; index += 1) {
    const day = addUtcDays(gridStart, index);
    const key = toDateKey(day);
    const inMonth = day.getUTCMonth() === month - 1;

    cells.push({
      key,
      dayNumber: day.getUTCDate(),
      inMonth,
      availableDay: inMonth ? dayMap.get(key) ?? null : null
    });
  }

  return cells;
}

export function MiniSessionSlotCalendar({
  days,
  defaultSlotToken,
  language
}: {
  days: MiniSessionSlotCalendarDay[];
  defaultSlotToken: string;
  language: MiniSessionSlotCalendarLanguage;
}) {
  const copy = COPY[language];
  const initialDayKey =
    days.find((day) => day.slots.some((slot) => slot.token === defaultSlotToken))?.key ?? days[0]?.key ?? "";
  const initialSlotToken = defaultSlotToken || days[0]?.slots[0]?.token || "";
  const [selectedDayKey, setSelectedDayKey] = useState(initialDayKey);
  const [selectedSlotToken, setSelectedSlotToken] = useState(initialSlotToken);
  const [view, setView] = useState<"calendar" | "slots">("calendar");

  const dayMap = useMemo(() => new Map(days.map((day) => [day.key, day])), [days]);
  const monthKeys = useMemo(() => {
    const keys = Array.from(new Set(days.map((day) => day.key.slice(0, 7))));

    return keys.sort();
  }, [days]);
  const months = useMemo(
    () =>
      monthKeys.map((monthKey) => ({
        key: monthKey,
        label: formatMonthLabel(monthKey, language),
        cells: buildMonthCells(monthKey, dayMap)
      })),
    [dayMap, language, monthKeys]
  );
  const selectedDay = dayMap.get(selectedDayKey) ?? null;

  function selectDay(day: MiniSessionSlotCalendarDay) {
    setSelectedDayKey(day.key);
    setSelectedSlotToken((currentToken) => {
      const currentTokenStillAvailable = day.slots.some((slot) => slot.token === currentToken);

      return currentTokenStillAvailable ? currentToken : day.slots[0]?.token ?? "";
    });
    setView("slots");
  }

  return (
    <div className="mt-5">
      {view === "calendar" && selectedSlotToken ? <input type="hidden" name="slot" value={selectedSlotToken} /> : null}
      <section className="rounded-md border border-ink/10 bg-paper p-3">
        <div className="flex min-h-10 items-center justify-between gap-3 border-b border-ink/10 pb-3">
          {view === "slots" ? (
            <>
              <button
                type="button"
                onClick={() => setView("calendar")}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-ink/10 bg-white px-3 text-sm font-medium text-ink transition hover:border-ink/25"
              >
                <ArrowLeft size={15} />
                {copy.backToCalendar}
              </button>
              <div className="min-w-0 text-right">
                <p className="truncate text-sm font-semibold text-ink">{selectedDay ? selectedDay.label : copy.noDay}</p>
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-graphite/50">{copy.availableSlots}</p>
              </div>
            </>
          ) : (
            <h3 className="text-sm font-semibold text-ink">{copy.availableDays}</h3>
          )}
        </div>

        {view === "calendar" ? (
          <div className="mt-3 max-h-[520px] space-y-5 overflow-y-auto pr-1">
            {months.map((month) => (
              <div key={month.key}>
                <div className="mb-3 text-sm font-semibold capitalize text-graphite">{month.label}</div>
                <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase text-graphite/55">
                  {WEEKDAYS[language].map((weekday) => (
                    <span key={weekday} className="grid h-7 place-items-center">
                      {weekday}
                    </span>
                  ))}
                </div>
                <div className="mt-1 grid grid-cols-7 gap-1">
                  {month.cells.map((cell) => {
                    const availableDay = cell.availableDay;
                    const isSelected = availableDay?.key === selectedDayKey;

                    return (
                      <button
                        key={cell.key}
                        type="button"
                        disabled={!availableDay}
                        aria-pressed={isSelected}
                        onClick={() => {
                          if (availableDay) {
                            selectDay(availableDay);
                          }
                        }}
                        className={`grid aspect-square min-h-10 place-items-center rounded-md border text-sm font-semibold transition ${
                          isSelected
                            ? "border-ink bg-ink text-white shadow-sm"
                            : availableDay
                              ? "border-sage/25 bg-sage/15 text-ink hover:border-sage/50 hover:bg-sage/25"
                              : cell.inMonth
                                ? "border-transparent bg-white text-graphite/35"
                                : "border-transparent bg-transparent text-transparent"
                        }`}
                      >
                        {cell.dayNumber}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : selectedDay ? (
          <div className="mt-3 grid max-h-[520px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
            {selectedDay.slots.map((slot) => (
              <label
                key={slot.token}
                className="relative flex min-h-12 cursor-pointer items-center rounded-md border border-ink/10 bg-white px-3 text-sm font-medium text-ink transition hover:border-ink/25"
              >
                <input
                  name="slot"
                  type="radio"
                  value={slot.token}
                  required
                  checked={selectedSlotToken === slot.token}
                  onChange={() => setSelectedSlotToken(slot.token)}
                  className="peer sr-only"
                />
                <span className="absolute inset-0 rounded-md ring-0 transition peer-checked:ring-2 peer-checked:ring-ink" />
                <span className="relative">{slot.label}</span>
              </label>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
