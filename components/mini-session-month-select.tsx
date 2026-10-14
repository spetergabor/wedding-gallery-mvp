"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export function MiniSessionMonthSelect({
  label,
  months,
  value,
  onChange
}: {
  label: string;
  months: Array<{ key: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedMonth = months.find((month) => month.key === value) ?? months[0] ?? null;

  if (!selectedMonth) {
    return null;
  }

  return (
    <div className="relative z-20 mb-4">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-11 w-full touch-manipulation items-center justify-between gap-3 rounded-md border border-ink/15 bg-white px-3 py-2 text-left text-sm font-semibold capitalize text-ink outline-none transition hover:border-ink/30 focus:border-ink focus:ring-2 focus:ring-ink/10"
      >
        <span>{selectedMonth.label}</span>
        <ChevronDown size={17} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label={label}
          className="absolute left-0 right-0 top-full z-30 mt-2 grid max-h-64 gap-1 overflow-y-auto overscroll-contain rounded-md border border-ink/10 bg-white p-1.5 shadow-lg"
        >
          {months.map((month) => {
            const selected = month.key === selectedMonth.key;

            return (
              <button
                key={month.key}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(month.key);
                  setOpen(false);
                }}
                className={`flex min-h-11 w-full touch-manipulation items-center justify-between gap-3 rounded px-3 py-2 text-left text-sm font-medium capitalize transition ${
                  selected ? "bg-ink text-white" : "text-ink hover:bg-paper"
                }`}
              >
                <span>{month.label}</span>
                {selected ? <Check size={15} className="shrink-0" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
