"use client";

import { CheckCircle2, LoaderCircle, Send } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/button";

type ReviewExportProgress = {
  status: string;
  total: number;
  completed: number;
  startedAt: string | null;
};

function formatDuration(totalSeconds: number) {
  const seconds = Math.max(0, Math.round(totalSeconds));

  if (seconds < 60) {
    return `${seconds} mp`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return remainingSeconds > 0 ? `${minutes} p ${remainingSeconds} mp` : `${minutes} p`;
}

export function AlbumReviewExportSubmit({
  designId,
  spreadCount,
  confirmationMessage,
  disabled = false
}: {
  designId: string;
  spreadCount: number;
  confirmationMessage: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<ReviewExportProgress | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const submissionStartedAtRef = useRef(0);
  const exportIsActive = isExporting || pending;

  useEffect(() => {
    if (!exportIsActive) {
      setProgress(null);
      setElapsedSeconds(0);
      submissionStartedAtRef.current = 0;
      return;
    }

    if (!submissionStartedAtRef.current) {
      submissionStartedAtRef.current = Date.now();
    }
    let cancelled = false;

    const updateElapsed = () => {
      if (!cancelled) {
        setElapsedSeconds(Math.max(0, Math.floor((Date.now() - submissionStartedAtRef.current) / 1000)));
      }
    };
    const loadProgress = async () => {
      try {
        const response = await fetch(`/api/admin/album-designs/${designId}/review-export-progress`, {
          cache: "no-store"
        });

        if (!response.ok || cancelled) {
          return;
        }

        const nextProgress = (await response.json()) as ReviewExportProgress;
        setProgress((current) => {
          if (nextProgress.status === "processing") {
            return nextProgress;
          }

          const serverStartedAt = nextProgress.startedAt ? new Date(nextProgress.startedAt).getTime() : 0;
          const belongsToCurrentExport =
            (current?.startedAt && current.startedAt === nextProgress.startedAt) ||
            (serverStartedAt > 0 && serverStartedAt >= submissionStartedAtRef.current - 60_000);

          if (belongsToCurrentExport) {
            return nextProgress;
          }

          return current;
        });
      } catch {
        // A szerveroldali művelet tovább fut; a következő lekérés újrapróbálja.
      }
    };

    updateElapsed();
    void loadProgress();
    const elapsedTimer = window.setInterval(updateElapsed, 500);
    const progressTimer = window.setInterval(() => void loadProgress(), 800);

    return () => {
      cancelled = true;
      window.clearInterval(elapsedTimer);
      window.clearInterval(progressTimer);
    };
  }, [designId, exportIsActive]);

  useEffect(() => {
    if (!isExporting || pending || !["complete", "failed"].includes(progress?.status ?? "")) {
      return;
    }

    const completionTimer = window.setTimeout(() => setIsExporting(false), 1400);

    return () => window.clearTimeout(completionTimer);
  }, [isExporting, pending, progress?.status]);

  const total = Math.max(1, progress?.total || spreadCount || 1);
  const completed = Math.min(total, Math.max(0, progress?.completed ?? 0));
  const percent = progress?.status === "complete" ? 100 : completed >= total ? 95 : Math.round((completed / total) * 100);
  const estimatedRemainingSeconds = useMemo(() => {
    if (progress?.status === "complete") {
      return 0;
    }

    if (completed > 0 && elapsedSeconds > 0) {
      return Math.ceil((elapsedSeconds / completed) * (total - completed) + 2);
    }

    return Math.max(1, total * 5 - elapsedSeconds);
  }, [completed, elapsedSeconds, progress?.status, total]);

  return (
    <>
      <Button
        type="submit"
        title="Album ellenőrző létrehozása"
        className="h-10 px-3"
        disabled={disabled || pending}
        onClick={(event) => {
          if (!window.confirm(confirmationMessage)) {
            event.preventDefault();
            return;
          }

          submissionStartedAtRef.current = Date.now();
          setProgress(null);
          setElapsedSeconds(0);
          window.setTimeout(() => setIsExporting(true), 0);
        }}
      >
        {exportIsActive ? <LoaderCircle size={15} className="animate-spin" /> : <Send size={15} />}
        {exportIsActive ? "Ellenőrző készül..." : "Ellenőrzőbe küldés"}
      </Button>

      {exportIsActive ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-ink/65 px-4 py-6" role="dialog" aria-modal="true" aria-labelledby={`review-export-title-${designId}`}>
          <div className="w-full max-w-lg rounded-lg border border-white/15 bg-white p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
            <div className="flex items-start gap-4">
              <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-ink text-white">
                {progress?.status === "complete" ? <CheckCircle2 size={22} /> : <LoaderCircle size={22} className="animate-spin" />}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-graphite/55">JPG-k generálása és feltöltése</p>
                <h3 id={`review-export-title-${designId}`} className="mt-1 text-xl font-semibold text-ink">
                  {progress?.status === "complete" ? "Az ellenőrző elkészült" : "Az ellenőrző készül"}
                </h3>
                <p className="mt-1 text-sm leading-6 text-graphite/65">
                  {progress?.status === "complete" ? "A kész ellenőrző betöltése..." : "Ne zárd be ezt az ablakot a feldolgozás végéig."}
                </p>
              </div>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-ink">{completed}/{total} oldalpár elkészült</span>
                <span className="tabular-nums text-graphite/65">{percent}%</span>
              </div>
              <div
                className="mt-2 h-3 overflow-hidden rounded-full bg-ink/10"
                role="progressbar"
                aria-label="Album ellenőrző készültsége"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
              >
                <div
                  className="relative h-full rounded-full bg-ink transition-[width] duration-500 ease-out after:absolute after:inset-0 after:animate-pulse after:bg-white/20"
                  style={{ width: `${Math.max(3, percent)}%` }}
                />
              </div>
              <p className="mt-3 text-sm text-graphite/70">
                {progress?.status === "complete"
                  ? "Az ellenőrző véglegesítése..."
                  : progress && completed >= total
                    ? "Az ellenőrző véglegesítése..."
                    : progress
                    ? `${Math.min(total, completed + 1)}. oldalpár feldolgozása...`
                    : "A feldolgozás indítása..."}
              </p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 rounded-md bg-paper p-4 text-sm">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-graphite/50">Eltelt idő</p>
                <p className="mt-1 font-semibold tabular-nums text-ink">{formatDuration(elapsedSeconds)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-graphite/50">Becsült hátralévő idő</p>
                <p className="mt-1 font-semibold tabular-nums text-ink">
                  {progress?.status === "complete" ? "néhány másodperc" : `kb. ${formatDuration(estimatedRemainingSeconds)}`}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
