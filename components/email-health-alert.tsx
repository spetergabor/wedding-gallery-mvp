"use client";

import Link from "next/link";
import { AlertTriangle, ExternalLink, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { EmailHealthStatus } from "@/lib/email-health";

const POLL_INTERVAL_MS = 15_000;
const ACKNOWLEDGED_INCIDENT_KEY = "spetly:email-health-acknowledged";

function formatOccurredAt(value: string) {
  return new Intl.DateTimeFormat("hu-HU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Vienna"
  }).format(new Date(value));
}

export function EmailHealthAlert() {
  const [status, setStatus] = useState<EmailHealthStatus | null>(null);
  const [open, setOpen] = useState(false);

  const checkHealth = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/email-health", { cache: "no-store" });
      const nextStatus = (await response.json()) as EmailHealthStatus;
      setStatus(nextStatus);

      if (nextStatus.healthy || !nextStatus.incident) {
        setOpen(false);
        return;
      }

      const acknowledged = window.localStorage.getItem(ACKNOWLEDGED_INCIDENT_KEY);
      setOpen(acknowledged !== nextStatus.incident.id);
    } catch (error) {
      console.error("E-mail health status could not be refreshed", error);
    }
  }, []);

  useEffect(() => {
    void checkHealth();
    const intervalId = window.setInterval(() => void checkHealth(), POLL_INTERVAL_MS);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void checkHealth();
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [checkHealth]);

  const incident = status?.incident;
  if (!incident) return null;

  const dismiss = () => {
    window.localStorage.setItem(ACKNOWLEDGED_INCIDENT_KEY, incident.id);
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-[80] inline-flex min-h-11 items-center gap-2 rounded-full bg-red-700 px-4 text-sm font-semibold text-white shadow-[0_16px_45px_rgba(185,28,28,0.32)] transition hover:bg-red-800"
      >
        <AlertTriangle size={17} />
        E-mail hiba · {incident.code}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-ink/55 p-4" role="dialog" aria-modal="true" aria-labelledby="email-health-alert-title">
      <section className="relative w-full max-w-xl overflow-hidden rounded-xl border border-red-200 bg-white shadow-2xl">
        <div className="flex items-start gap-4 border-b border-red-100 bg-red-50 px-5 py-5 sm:px-6">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-red-700 text-white">
            <AlertTriangle size={21} />
          </span>
          <div className="min-w-0 pr-8">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-700">Azonnali rendszerfigyelmeztetés</p>
            <h2 id="email-health-alert-title" className="mt-1 text-xl font-semibold text-ink">Az e-mail-küldés hibát jelzett</h2>
          </div>
          <button type="button" onClick={dismiss} aria-label="Figyelmeztetés bezárása" className="absolute right-4 top-4 grid size-9 place-items-center rounded-md text-graphite transition hover:bg-red-100 hover:text-ink">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5 px-5 py-5 sm:px-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-red-700">Hibakód</p>
              <p className="mt-1 font-mono text-base font-semibold text-red-800">{incident.code}</p>
            </div>
            <div className="rounded-md border border-ink/10 bg-paper px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-graphite/65">Észlelve</p>
              <p className="mt-1 text-sm font-semibold text-ink">{formatOccurredAt(incident.occurredAt)}</p>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-ink">Szolgáltatói válasz</p>
            <p className="mt-1 break-words rounded-md border border-ink/10 bg-paper p-3 font-mono text-xs leading-5 text-graphite">{incident.message}</p>
          </div>

          {incident.subject || incident.recipient ? (
            <div className="text-sm leading-6 text-graphite/75">
              {incident.subject ? <p><span className="font-medium text-ink">Levél:</span> {incident.subject}</p> : null}
              {incident.recipient ? <p><span className="font-medium text-ink">Címzett:</span> {incident.recipient}</p> : null}
            </div>
          ) : null}

          <p className="rounded-md border border-brass/25 bg-brass/10 px-4 py-3 text-sm leading-6 text-graphite">
            {incident.consecutiveFailures > 1
              ? `${incident.consecutiveFailures} egymást követő küldés sikertelen. A riasztás egy sikeres Resend-küldés után automatikusan megszűnik.`
              : "Egy küldés sikertelen volt. A riasztás egy sikeres Resend-küldés után automatikusan megszűnik."}
          </p>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-ink/10 bg-paper/70 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button type="button" onClick={dismiss} className="inline-flex min-h-11 items-center justify-center rounded-md border border-ink/15 bg-white px-4 text-sm font-medium text-ink hover:bg-paper">
            Tudomásul vettem
          </button>
          <Link href="/admin/settings?tab=logs" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-red-700 px-4 text-sm font-semibold text-white hover:bg-red-800">
            Hibanapló megnyitása
            <ExternalLink size={15} />
          </Link>
        </div>
      </section>
    </div>
  );
}
