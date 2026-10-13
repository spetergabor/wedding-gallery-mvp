"use client";

import { CalendarPlus, Check, Copy, Download } from "lucide-react";
import { useState } from "react";
import type { MiniSessionConfirmationLanguageContent } from "@/lib/mini-session-confirmation-content";

export function MiniSessionConfirmationActions({
  googleCalendarHref,
  calendarFileHref,
  details,
  labels
}: {
  googleCalendarHref: string;
  calendarFileHref: string;
  details: string;
  labels: Pick<
    MiniSessionConfirmationLanguageContent,
    "googleCalendar" | "calendarFile" | "copyDetails" | "copied"
  >;
}) {
  const [copied, setCopied] = useState(false);

  function legacyCopy(value: string) {
    const textArea = document.createElement("textarea");
    textArea.value = value;
    textArea.setAttribute("readonly", "");
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.select();
    const wasCopied = document.execCommand("copy");
    textArea.remove();

    if (!wasCopied) {
      throw new Error("Clipboard copy failed.");
    }
  }

  async function copyDetails() {
    try {
      if (window.navigator.clipboard?.writeText) {
        try {
          await window.navigator.clipboard.writeText(details);
        } catch {
          legacyCopy(details);
        }
      } else {
        legacyCopy(details);
      }

      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="grid gap-3">
      <a
        href={googleCalendarHref}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-ink px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-ink/90 focus:outline-none focus:ring-2 focus:ring-brass/50"
      >
        <CalendarPlus size={18} />
        {labels.googleCalendar}
      </a>
      <a
        href={calendarFileHref}
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-ink/15 bg-white px-4 py-3 text-center text-sm font-semibold text-ink transition hover:bg-paper focus:outline-none focus:ring-2 focus:ring-brass/40"
      >
        <Download size={18} />
        {labels.calendarFile}
      </a>
      <button
        type="button"
        onClick={copyDetails}
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-ink/15 bg-white px-4 py-3 text-center text-sm font-semibold text-ink transition hover:bg-paper focus:outline-none focus:ring-2 focus:ring-brass/40"
        aria-live="polite"
      >
        {copied ? <Check size={18} className="text-sage" /> : <Copy size={18} />}
        {copied ? labels.copied : labels.copyDetails}
      </button>
    </div>
  );
}
