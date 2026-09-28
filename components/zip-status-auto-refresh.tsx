"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export function ZipStatusAutoRefresh({
  enabled,
  intervalMs = 4000
}: {
  enabled: boolean;
  intervalMs?: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const refresh = () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      startTransition(() => {
        router.refresh();
      });
    };
    const intervalId = window.setInterval(refresh, intervalMs);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, intervalMs, router]);

  if (!enabled) {
    return null;
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-sage/10 px-3 py-1.5 text-xs font-medium text-sage">
      <RefreshCw size={13} className={isPending ? "animate-spin" : undefined} />
      {isPending ? "Frissítés..." : "Élő állapot"}
    </span>
  );
}
