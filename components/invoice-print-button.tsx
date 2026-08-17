"use client";

import { Printer } from "lucide-react";

export function InvoicePrintButton({ label = true }: { label?: boolean }) {
  return <button type="button" onClick={() => window.print()} className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-ink/15 bg-white px-4 text-sm font-medium print:hidden"><Printer size={17}/>{label ? "Nyomtatás" : null}</button>;
}
