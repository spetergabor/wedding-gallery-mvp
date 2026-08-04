"use client";

import { Printer } from "lucide-react";

export function PrintPageButton({ label = "Nyomtatás" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-medium text-white transition hover:bg-graphite print:hidden"
    >
      <Printer size={16} />
      {label}
    </button>
  );
}
