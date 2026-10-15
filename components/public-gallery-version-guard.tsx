"use client";

import { useEffect } from "react";
import { recoverFromServerActionVersionError } from "@/lib/client-deployment-recovery";

const VERSION_ENDPOINT = "/api/public/app-version";
const VERSION_CHECK_INTERVAL_MS = 60_000;
const VERSION_RELOAD_KEY = "spetly:deployment-reload";

export function PublicGalleryVersionGuard({ version }: { version: string }) {
  useEffect(() => {
    let stopped = false;
    let checking = false;
    let controller: AbortController | null = null;

    try {
      if (window.sessionStorage.getItem(VERSION_RELOAD_KEY) === version) {
        window.sessionStorage.removeItem(VERSION_RELOAD_KEY);
      }
    } catch {
      // Version checks still work when session storage is disabled.
    }

    const reloadForVersion = (nextVersion: string) => {
      try {
        if (window.sessionStorage.getItem(VERSION_RELOAD_KEY) === nextVersion) {
          return;
        }

        window.sessionStorage.setItem(VERSION_RELOAD_KEY, nextVersion);
      } catch {
        // Reload even if the browser blocks session storage.
      }

      window.location.reload();
    };

    const checkVersion = async () => {
      if (stopped || checking || document.visibilityState !== "visible") {
        return;
      }

      checking = true;
      controller?.abort();
      controller = new AbortController();

      try {
        const response = await fetch(`${VERSION_ENDPOINT}?t=${Date.now()}`, {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as { version?: unknown };
        const nextVersion = typeof payload.version === "string" ? payload.version.trim() : "";

        if (!stopped && nextVersion && nextVersion !== version) {
          reloadForVersion(nextVersion);
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          // A temporary network error should not interrupt the gallery.
        }
      } finally {
        checking = false;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void checkVersion();
      }
    };
    const handleWindowError = (event: ErrorEvent) => {
      recoverFromServerActionVersionError(event.error ?? event.message);
    };
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      recoverFromServerActionVersionError(event.reason);
    };

    const interval = window.setInterval(() => void checkVersion(), VERSION_CHECK_INTERVAL_MS);
    window.addEventListener("focus", checkVersion);
    window.addEventListener("online", checkVersion);
    window.addEventListener("pageshow", checkVersion);
    window.addEventListener("error", handleWindowError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    void checkVersion();

    return () => {
      stopped = true;
      controller?.abort();
      window.clearInterval(interval);
      window.removeEventListener("focus", checkVersion);
      window.removeEventListener("online", checkVersion);
      window.removeEventListener("pageshow", checkVersion);
      window.removeEventListener("error", handleWindowError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [version]);

  return null;
}
