"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  MINI_SESSION_BOOKING_MODE_RECURRING,
  MINI_SESSION_BOOKING_MODE_SINGLE_DAY
} from "@/lib/mini-sessions";

const fieldClass =
  "h-12 w-full min-w-0 max-w-full rounded-md border border-ink/15 bg-paper px-3 text-ink outline-none transition placeholder:text-graphite/45 focus:border-ink/50";

function uniqueDates(values: string[]) {
  const dates = Array.from(new Set(values.filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value)))).sort();
  return dates.length > 0 ? dates : [""];
}

export function MiniSessionEventDaysField({ defaultDates = [] }: { defaultDates?: string[] }) {
  const [dates, setDates] = useState(() => uniqueDates(defaultDates));

  function updateDate(index: number, value: string) {
    setDates((current) => current.map((date, dateIndex) => (dateIndex === index ? value : date)));
  }

  function addDate() {
    setDates((current) => [...current, ""]);
  }

  function removeDate(index: number) {
    setDates((current) => {
      const next = current.filter((_, dateIndex) => dateIndex !== index);
      return next.length > 0 ? next : [""];
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
      <div className="grid gap-2 sm:grid-cols-2">
        {dates.map((date, index) => (
          <div key={index} className="flex gap-2">
            <input
              name="sessionDates"
              type="date"
              value={date}
              onChange={(event) => updateDate(index, event.target.value)}
              required
              className={fieldClass}
              aria-label={`${index + 1}. foglalható nap`}
            />
            <button
              type="button"
              onClick={() => removeDate(index)}
              disabled={dates.length === 1}
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
  defaultEventDates
}: {
  defaultMode: string;
  defaultRecurringDate: string;
  defaultEventDates: string[];
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
        <label className="block space-y-2">
          <span className="text-sm font-medium text-graphite">Foglalható ettől</span>
          <input name="date" type="date" defaultValue={defaultRecurringDate} required className={fieldClass} />
        </label>
      ) : (
        <MiniSessionEventDaysField defaultDates={defaultEventDates} />
      )}
    </div>
  );
}
