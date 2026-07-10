"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, CheckCircle2, Clock3, UserRound } from "lucide-react";
import { FormSubmitButton } from "@/components/form-submit-button";

type MiniSessionEmbedLanguage = "hu" | "de";

export type MiniSessionEmbedBookingDay = {
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
  availableDay: MiniSessionEmbedBookingDay | null;
};

type WizardStep = "days" | "slots" | "details";

const WEEKDAYS = {
  hu: ["H", "K", "Sze", "Cs", "P", "Szo", "V"],
  de: ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]
} as const;

const COPY = {
  hu: {
    steps: ["Nap", "Időpont", "Adatok"],
    chooseDay: "Válassz napot",
    chooseSlot: "Válassz idősávot",
    details: "Személyes adatok",
    backToDays: "Vissza a napokhoz",
    backToSlots: "Vissza az időpontokhoz",
    availableDays: "Foglalható napok",
    availableSlots: "Szabad idősávok",
    name: "Név",
    email: "E-mail",
    phone: "Telefonszám",
    attendeeCount: "Hányan jöttök?",
    book: "Foglalás véglegesítése",
    booking: "Foglalás..."
  },
  de: {
    steps: ["Tag", "Zeit", "Daten"],
    chooseDay: "Tag auswählen",
    chooseSlot: "Zeit auswählen",
    details: "Deine Daten",
    backToDays: "Zurück zu den Tagen",
    backToSlots: "Zurück zu den Zeiten",
    availableDays: "Verfügbare Tage",
    availableSlots: "Freie Zeiten",
    name: "Name",
    email: "E-Mail",
    phone: "Telefonnummer",
    attendeeCount: "Wie viele Personen?",
    book: "Buchung abschließen",
    booking: "Buchung..."
  }
} as const;

function addUtcDays(date: Date, days: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days, 12, 0, 0));
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatMonthLabel(monthKey: string, language: MiniSessionEmbedLanguage) {
  const [year, month] = monthKey.split("-").map((part) => Number.parseInt(part, 10));
  const locale = language === "de" ? "de-AT" : "hu-HU";

  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(Date.UTC(year, month - 1, 1, 12, 0, 0)));
}

function buildMonthCells(monthKey: string, dayMap: Map<string, MiniSessionEmbedBookingDay>) {
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

function stepIndex(step: WizardStep) {
  if (step === "details") {
    return 2;
  }

  if (step === "slots") {
    return 1;
  }

  return 0;
}

export function MiniSessionEmbedBookingWizard({
  days,
  language
}: {
  days: MiniSessionEmbedBookingDay[];
  language: MiniSessionEmbedLanguage;
}) {
  const copy = COPY[language];
  const [step, setStep] = useState<WizardStep>("days");
  const [selectedDayKey, setSelectedDayKey] = useState("");
  const [selectedSlotToken, setSelectedSlotToken] = useState("");
  const currentStepIndex = stepIndex(step);
  const dayMap = useMemo(() => new Map(days.map((day) => [day.key, day])), [days]);
  const monthKeys = useMemo(() => Array.from(new Set(days.map((day) => day.key.slice(0, 7)))).sort(), [days]);
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
  const selectedSlot = selectedDay?.slots.find((slot) => slot.token === selectedSlotToken) ?? null;

  function selectDay(day: MiniSessionEmbedBookingDay) {
    setSelectedDayKey(day.key);
    setSelectedSlotToken("");
    setStep("slots");
  }

  function selectSlot(token: string) {
    setSelectedSlotToken(token);
    setStep("details");
  }

  return (
    <div className="space-y-4">
      <nav className="rounded-md border border-ink/10 bg-paper px-3 py-3">
        {step !== "days" ? (
          <button
            type="button"
            onClick={() => setStep(step === "details" ? "slots" : "days")}
            className="mb-3 inline-flex h-9 items-center gap-2 rounded-md border border-ink/10 bg-white px-3 text-sm font-medium text-ink transition hover:border-ink/25"
          >
            <ArrowLeft size={15} />
            {step === "details" ? copy.backToSlots : copy.backToDays}
          </button>
        ) : null}
        <div className="grid grid-cols-3 gap-2">
          {copy.steps.map((label, index) => {
            const isActive = currentStepIndex === index;
            const isDone = currentStepIndex > index;

            return (
              <div
                key={label}
                className={`flex min-h-10 items-center justify-center rounded-md border px-2 text-center text-xs font-semibold transition ${
                  isActive
                    ? "border-ink bg-ink text-white"
                    : isDone
                      ? "border-sage/25 bg-sage/15 text-sage"
                      : "border-ink/10 bg-white text-graphite/55"
                }`}
              >
                {isDone ? <CheckCircle2 size={13} className="mr-1.5" /> : null}
                {label}
              </div>
            );
          })}
        </div>
      </nav>

      {step === "days" ? (
        <section className="rounded-md border border-ink/10 bg-white p-4">
          <h2 className="flex items-center justify-center gap-2 text-base font-semibold text-ink">
            <CalendarDays size={18} />
            {copy.chooseDay}
          </h2>
          <p className="mt-1 text-center text-xs font-medium uppercase tracking-[0.14em] text-graphite/50">{copy.availableDays}</p>
          <div className="mx-auto mt-4 max-h-[430px] max-w-sm space-y-5 overflow-y-auto pr-1">
            {months.map((month) => (
              <div key={month.key}>
                <div className="mb-3 text-center text-sm font-semibold capitalize text-graphite">{month.label}</div>
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
                                ? "border-transparent bg-paper text-graphite/35"
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
        </section>
      ) : null}

      {step === "slots" && selectedDay ? (
        <section className="rounded-md border border-ink/10 bg-white p-4">
          <h2 className="flex items-center justify-center gap-2 text-base font-semibold text-ink">
            <Clock3 size={18} />
            {copy.chooseSlot}
          </h2>
          <p className="mt-1 text-center text-sm text-graphite/65">{selectedDay.label}</p>
          <p className="mt-1 text-center text-xs font-medium uppercase tracking-[0.14em] text-graphite/50">{copy.availableSlots}</p>
          <div className="mx-auto mt-4 grid max-h-[430px] max-w-md gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
            {selectedDay.slots.map((slot) => (
              <button
                key={slot.token}
                type="button"
                onClick={() => selectSlot(slot.token)}
                className="min-h-12 rounded-md border border-ink/10 bg-paper px-3 text-left text-sm font-semibold text-ink transition hover:border-ink/25 hover:bg-white"
              >
                {slot.label}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {step === "details" && selectedDay && selectedSlot ? (
        <section className="rounded-md border border-ink/10 bg-white p-4">
          <input type="hidden" name="slot" value={selectedSlot.token} />
          <h2 className="flex items-center justify-center gap-2 text-base font-semibold text-ink">
            <UserRound size={18} />
            {copy.details}
          </h2>
          <p className="mt-1 text-center text-sm text-graphite/65">
            {selectedDay.label} · {selectedSlot.label}
          </p>
          <div className="mt-4 grid gap-3">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-graphite">{copy.name}</span>
              <input name="name" required className="h-11 w-full rounded-md border border-ink/15 bg-paper px-3 text-ink outline-none transition focus:border-ink/50" />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-graphite">{copy.email}</span>
                <input name="email" type="email" required className="h-11 w-full rounded-md border border-ink/15 bg-paper px-3 text-ink outline-none transition focus:border-ink/50" />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium text-graphite">{copy.phone}</span>
                <input name="phone" type="tel" required className="h-11 w-full rounded-md border border-ink/15 bg-paper px-3 text-ink outline-none transition focus:border-ink/50" />
              </label>
            </div>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-graphite">{copy.attendeeCount}</span>
              <input name="attendeeCount" type="number" min="1" defaultValue="1" required className="h-11 w-full rounded-md border border-ink/15 bg-paper px-3 text-ink outline-none transition focus:border-ink/50" />
            </label>
          </div>
          <div className="mt-5 border-t border-ink/10 pt-4">
            <FormSubmitButton pendingLabel={copy.booking} className="w-full">
              {copy.book}
            </FormSubmitButton>
          </div>
        </section>
      ) : null}
    </div>
  );
}
