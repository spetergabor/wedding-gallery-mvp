"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  MINI_SESSION_BOOKING_MODE_RECURRING,
  MINI_SESSION_BOOKING_MODE_SINGLE_DAY
} from "@/lib/mini-sessions";

const fieldClass =
  "h-12 w-full min-w-0 max-w-full rounded-md border border-ink/15 bg-paper px-3 text-ink outline-none transition placeholder:text-graphite/45 focus:border-ink/50";

export type MiniSessionEventDayFieldValue = {
  date: string;
  startsAt: string;
  endsAt: string;
};

const emptyEventDay = (): MiniSessionEventDayFieldValue => ({ date: "", startsAt: "10:00", endsAt: "18:00" });

function normalizeEventDays(values: MiniSessionEventDayFieldValue[]) {
  const days = Array.from(
    new Map(
      values
        .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value.date))
        .map((value) => [value.date, value])
    ).values()
  ).sort((a, b) => a.date.localeCompare(b.date));

  return days.length > 0 ? days : [emptyEventDay()];
}

export function MiniSessionEventDaysField({ defaultDays = [] }: { defaultDays?: MiniSessionEventDayFieldValue[] }) {
  const [days, setDays] = useState(() => normalizeEventDays(defaultDays));

  function updateDay(index: number, field: keyof MiniSessionEventDayFieldValue, value: string) {
    setDays((current) => current.map((day, dayIndex) => (dayIndex === index ? { ...day, [field]: value } : day)));
  }

  function addDate() {
    setDays((current) => [...current, emptyEventDay()]);
  }

  function removeDate(index: number) {
    setDays((current) => {
      const next = current.filter((_, dateIndex) => dateIndex !== index);
      return next.length > 0 ? next : [emptyEventDay()];
    });
  }

  return (
    <fieldset className="space-y-3 md:col-span-2">
      <div>
        <legend className="text-sm font-medium text-graphite">Foglalható napok</legend>
        <p className="mt-1 text-xs leading-5 text-graphite/60">
          Csak a külön hozzáadott napokon jelennek meg idősávok. A napok közötti időszak nem lesz foglalható.
        </p>
      </div>
      <div className="space-y-2">
        {days.map((day, index) => (
          <div key={index} className="grid gap-2 rounded-md border border-ink/10 bg-paper p-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_48px] sm:items-end">
            <label className="block space-y-1">
              <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-graphite/55">Nap</span>
              <input
                name="sessionDates"
                type="date"
                value={day.date}
                onChange={(event) => updateDay(index, "date", event.target.value)}
                required
                className={fieldClass}
                aria-label={`${index + 1}. foglalható nap`}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-graphite/55">Mettől</span>
              <input
                name="sessionStartTimes"
                type="time"
                value={day.startsAt}
                onChange={(event) => updateDay(index, "startsAt", event.target.value)}
                required
                className={fieldClass}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-graphite/55">Meddig</span>
              <input
                name="sessionEndTimes"
                type="time"
                value={day.endsAt}
                onChange={(event) => updateDay(index, "endsAt", event.target.value)}
                required
                className={fieldClass}
              />
            </label>
            <button
              type="button"
              onClick={() => removeDate(index)}
              disabled={days.length === 1}
              className="inline-flex size-12 shrink-0 items-center justify-center rounded-md border border-ink/10 text-graphite transition hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-35"
              aria-label="Nap eltávolítása"
            >
              <Trash2 size={17} />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addDate}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-ink/10 px-4 text-sm font-medium text-ink transition hover:bg-ink/5"
      >
        <Plus size={15} />
        Másik nap hozzáadása
      </button>
    </fieldset>
  );
}

export function MiniSessionScheduleFields({
  defaultMode,
  defaultRecurringDate,
  defaultRecurringStartTime,
  defaultRecurringEndTime,
  defaultEventDays
}: {
  defaultMode: string;
  defaultRecurringDate: string;
  defaultRecurringStartTime: string;
  defaultRecurringEndTime: string;
  defaultEventDays: MiniSessionEventDayFieldValue[];
}) {
  const [mode, setMode] = useState(
    defaultMode === MINI_SESSION_BOOKING_MODE_RECURRING
      ? MINI_SESSION_BOOKING_MODE_RECURRING
      : MINI_SESSION_BOOKING_MODE_SINGLE_DAY
  );

  return (
    <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
      <label className="block space-y-2">
        <span className="text-sm font-medium text-graphite">Foglaló típusa</span>
        <select
          name="bookingMode"
          value={mode}
          onChange={(event) => setMode(event.target.value)}
          className={fieldClass}
        >
          <option value={MINI_SESSION_BOOKING_MODE_SINGLE_DAY}>Mini session napok</option>
          <option value={MINI_SESSION_BOOKING_MODE_RECURRING}>Állandó szolgáltatás</option>
        </select>
      </label>

      {mode === MINI_SESSION_BOOKING_MODE_RECURRING ? (
        <div className="grid gap-4 sm:col-span-2 sm:grid-cols-3">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-graphite">Foglalható ettől</span>
            <input name="date" type="date" defaultValue={defaultRecurringDate} required className={fieldClass} />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-graphite">Alap kezdés</span>
            <input name="startTime" type="time" defaultValue={defaultRecurringStartTime} required className={fieldClass} />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-graphite">Alap zárás</span>
            <input name="endTime" type="time" defaultValue={defaultRecurringEndTime} required className={fieldClass} />
          </label>
        </div>
      ) : (
        <MiniSessionEventDaysField defaultDays={defaultEventDays} />
      )}
    </div>
  );
}
