"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export function ZipStatusAutoRefresh({
  galleryId,
  enabled,
  intervalMs = 4000
}: {
  galleryId: string;
  enabled: boolean;
  intervalMs?: number;
}) {
  const router = useRouter();
  const refreshTriggeredRef = useRef(false);
  const [progress, setProgress] = useState<{ completedParts: number; totalParts: number } | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let stopped = false;
    let checking = false;
    let controller: AbortController | null = null;

    const checkStatus = async () => {
      if (stopped || checking || document.visibilityState !== "visible") {
        return;
      }

      checking = true;
      controller?.abort();
      controller = new AbortController();

      try {
        const response = await fetch(`/api/admin/galleries/${encodeURIComponent(galleryId)}/zip-status`, {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal
        });

        if (!response.ok) {
          setHasError(true);
          return;
        }

        const result = (await response.json()) as {
          active?: unknown;
          completedParts?: unknown;
          totalParts?: unknown;
        };

        if (stopped) {
          return;
        }

        setHasError(false);
        setProgress({
          completedParts: Number(result.completedParts) || 0,
          totalParts: Number(result.totalParts) || 0
        });

        if (result.active === false && !refreshTriggeredRef.current) {
          refreshTriggeredRef.current = true;
          router.refresh();
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setHasError(true);
        }
      } finally {
        checking = false;
      }
    };

    const intervalId = window.setInterval(() => void checkStatus(), intervalMs);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void checkStatus();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    void checkStatus();

    return () => {
      stopped = true;
      controller?.abort();
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, galleryId, intervalMs, router]);

  if (!enabled) {
    return null;
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${
        hasError ? "bg-red-50 text-red-700" : "bg-sage/10 text-sage"
      }`}
    >
      <RefreshCw size={13} className={hasError ? undefined : "animate-spin"} />
      {hasError
        ? "Állapot nem elérhető"
        : progress?.totalParts
          ? `Készül · ${progress.completedParts}/${progress.totalParts} rész`
          : "Élő állapot"}
    </span>
  );
}
