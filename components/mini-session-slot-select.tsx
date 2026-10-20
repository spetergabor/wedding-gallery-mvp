"use client";

import { ChevronDown } from "lucide-react";

type MiniSessionSlotSelectItem = {
  token: string;
  label: string;
};

type SlotGroup = {
  key: "morning" | "afternoon" | "evening";
  label: string;
  slots: MiniSessionSlotSelectItem[];
};

function getSlotHour(label: string) {
  const match = label.match(/^(\d{1,2}):/);

  return match ? Number.parseInt(match[1], 10) : 12;
}

export function MiniSessionSlotSelect({
  afternoonLabel,
  ariaLabel,
  eveningLabel,
  morningLabel,
  onChange,
  placeholder,
  slots,
  value
}: {
  afternoonLabel: string;
  ariaLabel: string;
  eveningLabel: string;
  morningLabel: string;
  onChange: (token: string) => void;
  placeholder: string;
  slots: MiniSessionSlotSelectItem[];
  value: string;
}) {
  const groups = ([
    { key: "morning", label: morningLabel, slots: slots.filter((slot) => getSlotHour(slot.label) < 12) },
    {
      key: "afternoon",
      label: afternoonLabel,
      slots: slots.filter((slot) => {
        const hour = getSlotHour(slot.label);
        return hour >= 12 && hour < 18;
      })
    },
    { key: "evening", label: eveningLabel, slots: slots.filter((slot) => getSlotHour(slot.label) >= 18) }
  ] satisfies SlotGroup[]).filter((group) => group.slots.length > 0);

  return (
    <div className="relative mx-auto w-full max-w-xs">
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full appearance-none rounded-md border border-ink/15 bg-paper px-4 pr-11 text-base font-semibold tabular-nums text-ink outline-none transition focus:border-ink/50 focus:ring-2 focus:ring-ink/10"
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {groups.map((group) => (
          <optgroup key={group.key} label={group.label}>
            {group.slots.map((slot) => (
              <option key={slot.token} value={slot.token}>
                {slot.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-graphite/55" size={18} />
    </div>
  );
}
