"use client";

import { useEffect, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";

type BookingStatusFilter = "booked" | "cancelled" | "all";
type BookingSourceFilter = "all" | "client" | "manual";

const filterInputClass =
  "h-10 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition placeholder:text-graphite/45 focus:border-ink/50";

export function MiniSessionBookingFilters({
  totalCount,
  activeCount,
  cancelledCount,
  clientCount,
  manualCount
}: {
  totalCount: number;
  activeCount: number;
  cancelledCount: number;
  clientCount: number;
  manualCount: number;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<BookingStatusFilter>("booked");
  const [source, setSource] = useState<BookingSourceFilter>("all");

  useEffect(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const visibleBookingIds = new Set<string>();
    const items = Array.from(document.querySelectorAll<HTMLElement>("[data-mini-session-booking-item]"));

    items.forEach((item) => {
      const itemStatus = item.dataset.miniSessionBookingStatus ?? "";
      const itemSource = item.dataset.miniSessionBookingSource ?? "";
      const itemSearch = item.dataset.miniSessionBookingSearch ?? "";
      const matchesStatus = status === "all" || itemStatus === status;
      const matchesSource = source === "all" || itemSource === source;
      const matchesQuery = !normalizedQuery || itemSearch.includes(normalizedQuery);
      const isVisible = matchesStatus && matchesSource && matchesQuery;

      item.hidden = !isVisible;

      if (isVisible && item.dataset.miniSessionBookingRecord) {
        visibleBookingIds.add(item.dataset.miniSessionBookingRecord);
      }
    });

    document.querySelectorAll<HTMLElement>("[data-mini-session-booking-count]").forEach((counter) => {
      counter.textContent = String(visibleBookingIds.size);
    });

    document.querySelectorAll<HTMLElement>("[data-mini-session-booking-empty]").forEach((emptyState) => {
      emptyState.hidden = visibleBookingIds.size > 0;
    });
  }, [query, source, status]);

  return (
    <div className="mt-5 rounded-md border border-ink/10 bg-paper p-3">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div className="flex items-center gap-2 text-sm font-semibold text-ink">
          <SlidersHorizontal size={16} />
          Kontaktlista szűrése
        </div>
        <p className="text-xs uppercase tracking-[0.12em] text-graphite/55">
          <span data-mini-session-booking-count>{activeCount}</span> / {totalCount} találat
        </p>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-graphite/45" size={15} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className={`${filterInputClass} pl-9`}
            placeholder="Név, e-mail, telefon, megjegyzés..."
          />
        </label>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as BookingStatusFilter)}
          className={filterInputClass}
          aria-label="Foglalás státusz"
        >
          <option value="booked">Csak aktív ({activeCount})</option>
          <option value="cancelled">Törölt ({cancelledCount})</option>
          <option value="all">Összes ({totalCount})</option>
        </select>
        <select
          value={source}
          onChange={(event) => setSource(event.target.value as BookingSourceFilter)}
          className={filterInputClass}
          aria-label="Foglalás típusa"
        >
          <option value="all">Minden típus</option>
          <option value="client">Ügyfél ({clientCount})</option>
          <option value="manual">Kézi ({manualCount})</option>
        </select>
      </div>
    </div>
  );
}
