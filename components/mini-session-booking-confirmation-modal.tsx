"use client";

import { CalendarPlus, CheckCircle2, Mail, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const CONFIRMATION_COPY = {
  hu: {
    eyebrow: "Sikeres foglalás",
    title: "A foglalásod sikeres és érvényes",
    text: "Az időpontodat rögzítettük, nincs további teendőd.",
    email:
      "A megerősítést e-mailben is elküldtük. Ha néhány percen belül nem találod, nézd meg a spam vagy a promóciók mappát is.",
    valid: "Az időpontod biztosan le van foglalva.",
    manage: "Fotózás kezelése",
    addCalendar: "Naptárhoz adás",
    close: "Rendben",
    closeLabel: "Visszaigazolás bezárása"
  },
  de: {
    eyebrow: "Buchung erfolgreich",
    title: "Deine Buchung ist erfolgreich und verbindlich",
    text: "Dein Termin wurde gespeichert. Du musst nichts weiter tun.",
    email:
      "Wir haben dir die Bestätigung auch per E-Mail geschickt. Falls du sie nach einigen Minuten nicht findest, prüfe bitte auch deinen Spam- oder Werbeordner.",
    valid: "Dein Termin ist sicher für dich reserviert.",
    manage: "Shooting verwalten",
    addCalendar: "Zum Kalender hinzufügen",
    close: "Verstanden",
    closeLabel: "Bestätigung schließen"
  }
} as const;

export function MiniSessionBookingConfirmationModal({
  language,
  manageHref,
  calendarHref
}: {
  language: "hu" | "de";
  manageHref?: string | null;
  calendarHref?: string | null;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const copy = CONFIRMATION_COPY[language];

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[140] flex items-end justify-center bg-ink/60 p-0 backdrop-blur-[2px] sm:items-center sm:p-5"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setIsOpen(false);
      }}
    >
      <section
        className="relative max-h-[94vh] w-full overflow-y-auto rounded-t-xl bg-white px-5 pb-6 pt-7 shadow-2xl sm:max-w-xl sm:rounded-xl sm:px-8 sm:pb-8 sm:pt-9"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mini-session-booking-confirmation-title"
        aria-describedby="mini-session-booking-confirmation-description"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          ref={closeButtonRef}
          type="button"
          onClick={() => setIsOpen(false)}
          aria-label={copy.closeLabel}
          className="absolute right-4 top-4 flex size-10 items-center justify-center rounded-full border border-ink/10 bg-white text-ink transition hover:bg-paper focus:outline-none focus:ring-2 focus:ring-brass/50"
        >
          <X size={20} />
        </button>

        <div className="flex size-14 items-center justify-center rounded-full bg-sage/15 text-sage">
          <CheckCircle2 size={30} strokeWidth={1.8} />
        </div>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-brass">{copy.eyebrow}</p>
        <h2 id="mini-session-booking-confirmation-title" className="mt-2 pr-8 text-3xl font-semibold leading-tight text-ink">
          {copy.title}
        </h2>
        <p id="mini-session-booking-confirmation-description" className="mt-3 text-base leading-7 text-graphite/75">
          {copy.text}
        </p>

        <div className="mt-6 space-y-3">
          <div className="flex gap-3 rounded-lg border border-ink/10 bg-paper p-4">
            <Mail className="mt-0.5 shrink-0 text-brass" size={21} />
            <p className="text-sm leading-6 text-graphite/75">{copy.email}</p>
          </div>
          <div className="flex items-center gap-3 rounded-lg bg-sage/10 px-4 py-3 text-sm font-medium text-ink">
            <ShieldCheck className="shrink-0 text-sage" size={20} />
            <span>{copy.valid}</span>
          </div>
        </div>

        <div className="mt-7 grid gap-2 sm:grid-cols-2">
          {manageHref ? (
            <Link
              href={manageHref}
              className="inline-flex h-12 items-center justify-center rounded-md bg-ink px-4 text-sm font-semibold text-white transition hover:bg-ink/90"
            >
              {copy.manage}
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="inline-flex h-12 items-center justify-center rounded-md bg-ink px-4 text-sm font-semibold text-white transition hover:bg-ink/90"
            >
              {copy.close}
            </button>
          )}
          {calendarHref ? (
            <Link
              href={calendarHref}
              target="_blank"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-ink/15 bg-white px-4 text-sm font-semibold text-ink transition hover:bg-paper"
            >
              <CalendarPlus size={17} />
              {copy.addCalendar}
            </Link>
          ) : manageHref ? (
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="inline-flex h-12 items-center justify-center rounded-md border border-ink/15 bg-white px-4 text-sm font-semibold text-ink transition hover:bg-paper"
            >
              {copy.close}
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
