"use client";

import { useState } from "react";

type LogoHeightControlProps = {
  defaultValue: number;
};

export function LogoHeightControl({ defaultValue }: LogoHeightControlProps) {
  const [value, setValue] = useState(defaultValue);

  return (
    <label className="block space-y-3 rounded-md border border-ink/10 bg-paper p-4">
      <span className="flex items-center justify-between gap-4 text-sm font-medium text-graphite">
        <span>Publikus galéria logómérete</span>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-ink">{value}px</span>
      </span>
      <input
        name="logoHeight"
        type="range"
        min="32"
        max="140"
        step="4"
        value={value}
        onChange={(event) => setValue(Number(event.target.value))}
        className="w-full accent-ink"
      />
      <span className="text-xs leading-5 text-graphite/60">
        Ez csak az ügyfeleknek látható galéria fejlécében változtatja a logó magasságát.
      </span>
    </label>
  );
}
