"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const ADMIN_PREFETCH_ROUTES = ["/admin/dashboard", "/admin/clients", "/admin/galleries", "/admin/notifications", "/admin/settings"];

export function AdminRoutePrefetcher() {
  const router = useRouter();

  useEffect(() => {
    const prefetchRoutes = () => {
      for (const route of ADMIN_PREFETCH_ROUTES) {
        router.prefetch(route);
      }
    };

    if ("requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(prefetchRoutes, { timeout: 1500 });
      return () => window.cancelIdleCallback(idleId);
    }

    const timeoutId = globalThis.setTimeout(prefetchRoutes, 500);
    return () => globalThis.clearTimeout(timeoutId);
  }, [router]);

  return null;
}
