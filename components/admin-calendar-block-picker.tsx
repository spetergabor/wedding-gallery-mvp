"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, MousePointer2, X } from "lucide-react";
import { FormSubmitButton } from "@/components/form-submit-button";
import { createAdminCalendarDaysBlockAction } from "@/lib/mini-session-actions";

type ExistingCalendarBlock = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
};

const WEEKDAYS = ["H", "K", "Sze", "Cs", "P", "Szo", "V"];

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function dateOrdinal(value: string) {
  const [year, month, day] = value.split("-").map((part) => Number.parseInt(part, 10));
  return Date.UTC(year, month - 1, day);
}

function formatSelectedDate(value: string) {
  const [year, month, day] = value.split("-").map((part) => Number.parseInt(part, 10));
  return new Intl.DateTimeFormat("hu-HU", { month: "short", day: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month - 1, day, 12)));
}

export function AdminCalendarBlockPicker({
  todayDate,
  existingBlocks
}: {
  todayDate: string;
  existingBlocks: ExistingCalendarBlock[];
}) {
  const [todayYear, todayMonth] = todayDate.split("-").map((part) => Number.parseInt(part, 10));
  const [monthCursor, setMonthCursor] = useState({ year: todayYear, month: todayMonth - 1 });
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [blockMode, setBlockMode] = useState<"full-day" | "time-slot">("full-day");
  const selectedDateList = useMemo(() => [...selectedDates].sort(), [selectedDates]);
  const todayOrdinal = dateOrdinal(todayDate);
  const firstWeekday = (new Date(Date.UTC(monthCursor.year, monthCursor.month, 1)).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(monthCursor.year, monthCursor.month + 1, 0)).getUTCDate();
  const calendarDays = Array.from({ length: 42 }, (_, index) => {
    const day = index - firstWeekday + 1;
    return day >= 1 && day <= daysInMonth ? day : null;
  });
  const monthLabel = new Intl.DateTimeFormat("hu-HU", {
    year: "numeric",
    month: "long",
    timeZone: "UTC"
  }).format(new Date(Date.UTC(monthCursor.year, monthCursor.month, 1)));

  function existingBlocksForDate(value: string) {
    const ordinal = dateOrdinal(value);
    return existingBlocks.filter((block) => ordinal >= dateOrdinal(block.startDate) && ordinal <= dateOrdinal(block.endDate));
  }

  function isFullDayBlock(block: ExistingCalendarBlock, value: string) {
    const startsAtDayStart = block.startDate < value || (block.startDate === value && block.startTime <= "00:00");
    const endsAtDayEnd = block.endDate > value || (block.endDate === value && block.endTime >= "23:59");
    return startsAtDayStart && endsAtDayEnd;
  }

  function changeMonth(offset: number) {
    const next = new Date(Date.UTC(monthCursor.year, monthCursor.month + offset, 1));
    setMonthCursor({ year: next.getUTCFullYear(), month: next.getUTCMonth() });
  }

  function toggleDate(value: string) {
    if (dateOrdinal(value) < todayOrdinal || existingBlocksForDate(value).some((block) => isFullDayBlock(block, value))) return;
    const nextSelectionSize = selectedDates.has(value) ? selectedDates.size - 1 : selectedDates.size + 1;
    if (nextSelectionSize !== 1) setBlockMode("full-day");

    setSelectedDates((current) => {
      const next = new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  return (
    <form action={createAdminCalendarDaysBlockAction} className="rounded-lg border border-ink/10 bg-paper p-4 sm:p-5">
      <input type="hidden" name="selectedDates" value={selectedDateList.join(",")} />
      <input type="hidden" name="blockMode" value={selectedDateList.length === 1 ? blockMode : "full-day"} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <CalendarDays size={17} /> Nem foglalható napok kijelölése
          </div>
          <p className="mt-1 max-w-lg text-xs leading-5 text-graphite/60">
            Kattints minden napra, amit le szeretnél tiltani. A fekete napok a mentésre váró kijelölések.
          </p>
        </div>
        {selectedDateList.length > 0 ? (
          <button
            type="button"
            onClick={() => { setSelectedDates(new Set()); setBlockMode("full-day"); }}
            className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md border border-ink/10 bg-white px-3 text-xs font-medium text-graphite hover:border-ink/25 hover:text-ink"
          >
            <X size={13} /> Kijelölés törlése
          </button>
        ) : null}
      </div>

      <div className="mt-5 overflow-hidden rounded-lg border border-ink/10 bg-white">
        <div className="flex items-center justify-between border-b border-ink/10 px-3 py-3">
          <button type="button" onClick={() => changeMonth(-1)} aria-label="Előző hónap" className="grid size-9 place-items-center rounded-full text-graphite hover:bg-paper hover:text-ink">
            <ChevronLeft size={18} />
          </button>
          <p className="text-sm font-semibold capitalize text-ink">{monthLabel}</p>
          <button type="button" onClick={() => changeMonth(1)} aria-label="Következő hónap" className="grid size-9 place-items-center rounded-full text-graphite hover:bg-paper hover:text-ink">
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="grid grid-cols-7 border-b border-ink/10 bg-paper/70 px-2 py-2">
          {WEEKDAYS.map((weekday) => (
            <span key={weekday} className="text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-graphite/50">{weekday}</span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 p-2 sm:gap-1.5 sm:p-3">
          {calendarDays.map((day, index) => {
            if (!day) return <span key={`empty-${index}`} className="aspect-square" aria-hidden="true" />;

            const value = dateKey(monthCursor.year, monthCursor.month, day);
            const dayBlocks = existingBlocksForDate(value);
            const fullDayBlock = dayBlocks.find((block) => isFullDayBlock(block, value));
            const partialBlocks = fullDayBlock ? [] : dayBlocks;
            const selected = selectedDates.has(value);
            const past = dateOrdinal(value) < todayOrdinal;
            const today = value === todayDate;
            const disabled = past || Boolean(fullDayBlock);
            const blockTitle = dayBlocks.map((block) => {
              const startsAt = block.startDate < value ? "00:00" : block.startTime;
              const endsAt = block.endDate > value ? "23:59" : block.endTime;
              return `${block.title} (${startsAt}–${endsAt})`;
            }).join("\n");

            return (
              <button
                key={value}
                type="button"
                onClick={() => toggleDate(value)}
                disabled={disabled}
                aria-pressed={selected}
                aria-label={`${value}${fullDayBlock ? `, egész nap tiltva: ${fullDayBlock.title}` : partialBlocks.length ? ", részben tiltva" : selected ? ", kijelölve" : ""}`}
                title={blockTitle || undefined}
                className={`relative flex aspect-square min-w-0 flex-col items-center justify-center rounded-md border text-sm font-semibold transition sm:text-base ${
                  selected
                    ? "border-ink bg-ink text-white shadow-sm"
                    : fullDayBlock
                      ? "cursor-not-allowed border-red-200 bg-red-50 text-red-700"
                      : partialBlocks.length > 0
                        ? "border-brass/35 bg-brass/10 text-ink hover:border-brass/60 hover:bg-brass/15"
                      : past
                        ? "cursor-not-allowed border-transparent bg-transparent text-graphite/25"
                        : "border-transparent bg-white text-ink hover:border-ink/20 hover:bg-paper"
                } ${today && !selected ? "ring-1 ring-inset ring-ink/45" : ""}`}
              >
                <span>{day}</span>
                {fullDayBlock ? <span className="mt-0.5 hidden text-[8px] font-medium uppercase leading-none sm:block">Tiltva</span> : null}
                {partialBlocks.length > 0 ? <span className="mt-0.5 hidden text-[8px] font-medium uppercase leading-none text-brass sm:block">Részben</span> : null}
                {fullDayBlock ? <span className="absolute bottom-1 size-1 rounded-full bg-red-500 sm:hidden" /> : null}
                {partialBlocks.length > 0 ? <span className="absolute bottom-1 size-1 rounded-full bg-brass sm:hidden" /> : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-graphite/60">
        <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-sm bg-ink" /> Új kijelölés</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-sm border border-red-200 bg-red-50" /> Már letiltva</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-sm border border-brass/35 bg-brass/10" /> Részben tiltva</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-sm ring-1 ring-inset ring-ink/45" /> Ma</span>
      </div>

      {selectedDateList.length === 1 ? (
        <div className="mt-5 rounded-md border border-ink/10 bg-white p-3 sm:p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-graphite/55">Mit szeretnél letiltani?</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setBlockMode("full-day")}
              className={`flex min-h-12 items-center justify-center gap-2 rounded-md border px-3 text-sm font-semibold transition ${blockMode === "full-day" ? "border-ink bg-ink text-white" : "border-ink/10 bg-paper text-graphite hover:border-ink/25"}`}
            >
              <CalendarDays size={16} /> Egész nap
            </button>
            <button
              type="button"
              onClick={() => setBlockMode("time-slot")}
              className={`flex min-h-12 items-center justify-center gap-2 rounded-md border px-3 text-sm font-semibold transition ${blockMode === "time-slot" ? "border-ink bg-ink text-white" : "border-ink/10 bg-paper text-graphite hover:border-ink/25"}`}
            >
              <Clock3 size={16} /> Csak egy idősáv
            </button>
          </div>
          {blockMode === "time-slot" ? (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-graphite">Kezdés</span>
                <input name="startTime" type="time" defaultValue="09:00" required className="h-11 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none focus:border-ink/50" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-graphite">Befejezés</span>
                <input name="endTime" type="time" defaultValue="12:00" required className="h-11 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none focus:border-ink/50" />
              </label>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-5 rounded-md border border-ink/10 bg-white p-3">
        {selectedDateList.length > 0 ? (
          <>
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <MousePointer2 size={15} /> {selectedDateList.length} nap kijelölve
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {selectedDateList.slice(0, 8).map((value) => (
                <button key={value} type="button" onClick={() => toggleDate(value)} className="rounded-full bg-ink/5 px-2.5 py-1 text-[11px] font-medium text-graphite hover:bg-red-50 hover:text-red-700">
                  {formatSelectedDate(value)} ×
                </button>
              ))}
              {selectedDateList.length > 8 ? <span className="rounded-full bg-ink/5 px-2.5 py-1 text-[11px] text-graphite">+{selectedDateList.length - 8} nap</span> : null}
            </div>
          </>
        ) : (
          <p className="text-sm text-graphite/60">Még nincs kijelölt nap.</p>
        )}
      </div>

      <div className="mt-4 border-t border-ink/10 pt-4">
        <FormSubmitButton disabled={selectedDateList.length === 0} pendingLabel="Napok letiltása..." className="w-full sm:w-auto">
          {blockMode === "time-slot" && selectedDateList.length === 1 ? <Clock3 size={15} /> : <CalendarDays size={15} />}
          {blockMode === "time-slot" && selectedDateList.length === 1 ? "Idősáv letiltása" : "Kijelölt napok letiltása"}
        </FormSubmitButton>
      </div>
    </form>
  );
}
