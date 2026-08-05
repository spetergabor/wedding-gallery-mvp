"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, EyeOff, Loader2, RefreshCw, Search, Trash2, X } from "lucide-react";
import {
  bulkUpdateGuestPhotosAction,
  getAdminGuestGalleryPhotosPageAction,
  getAdminGuestGalleryRevisionAction
} from "@/lib/guest-gallery-actions";
import type {
  GuestGalleryAdminDateFilter,
  GuestGalleryAdminPhoto,
  GuestGalleryAdminPhotoCursor,
  GuestGalleryAdminPhotoFilters,
  GuestGalleryAdminSelection,
  GuestGalleryAdminStatusFilter
} from "@/lib/guest-gallery-admin";

type StatusCounts = Record<GuestGalleryAdminStatusFilter, number>;

const STATUS_FILTERS: Array<{ value: GuestGalleryAdminStatusFilter; label: string }> = [
  { value: "all", label: "Összes" },
  { value: "pending_review", label: "Jóváhagyásra vár" },
  { value: "visible", label: "Látható" },
  { value: "hidden", label: "Elrejtve" },
  { value: "uploading", label: "Feltöltés alatt" },
  { value: "processing", label: "Feldolgozás alatt" },
  { value: "failed", label: "Hibás" }
];

const uploadDateFormatter = new Intl.DateTimeFormat("hu-HU", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusMeta(photo: GuestGalleryAdminPhoto) {
  if (photo.status === "visible") {
    return { label: "Látható", className: "bg-sage text-white" };
  }

  if (photo.status === "pending_review") {
    return { label: "Jóváhagyásra vár", className: "bg-brass text-white" };
  }

  if (photo.status === "pending") {
    return { label: "Feltöltés alatt", className: "bg-graphite text-white" };
  }

  return { label: "Elrejtve", className: "bg-ink/75 text-white" };
}

function mergePhotos(current: GuestGalleryAdminPhoto[], additions: GuestGalleryAdminPhoto[]) {
  const existingIds = new Set(current.map((photo) => photo.id));
  return [...current, ...additions.filter((photo) => !existingIds.has(photo.id))];
}

export function GuestGalleryPhotoManager({
  galleryId,
  initialPhotos,
  initialNextCursor,
  initialTotalCount,
  initialRevision,
  statusCounts
}: {
  galleryId: string;
  initialPhotos: GuestGalleryAdminPhoto[];
  initialNextCursor: GuestGalleryAdminPhotoCursor | null;
  initialTotalCount: number;
  initialRevision: number;
  statusCounts: StatusCounts;
}) {
  const router = useRouter();
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const firstPageInFlightRef = useRef(false);
  const loadMoreInFlightRef = useRef(false);
  const revisionCheckInFlightRef = useRef(false);
  const revisionRef = useRef(initialRevision);
  const requestSequenceRef = useRef(0);
  const didMountFiltersRef = useRef(false);
  const [photos, setPhotos] = useState(initialPhotos);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [counts, setCounts] = useState(statusCounts);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [allMatchingSelected, setAllMatchingSelected] = useState(false);
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<GuestGalleryAdminStatusFilter>("all");
  const [dateFilter, setDateFilter] = useState<GuestGalleryAdminDateFilter>("all");
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isLoadingFirstPage, setIsLoadingFirstPage] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [hasUpdates, setHasUpdates] = useState(false);
  const [isPending, startTransition] = useTransition();

  const filters = useMemo<GuestGalleryAdminPhotoFilters>(() => ({
    search: debouncedSearch,
    status: statusFilter,
    date: dateFilter
  }), [dateFilter, debouncedSearch, statusFilter]);
  const selectedCount = allMatchingSelected
    ? Math.max(0, totalCount - excludedIds.size)
    : selectedIds.size;
  const allLoadedSelected = photos.length > 0 && photos.every((photo) => (
    allMatchingSelected ? !excludedIds.has(photo.id) : selectedIds.has(photo.id)
  ));
  const hasActiveFilters = Boolean(search.trim()) || statusFilter !== "all" || dateFilter !== "all";

  useEffect(() => {
    setCounts(statusCounts);
  }, [statusCounts]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => window.clearTimeout(timeoutId);
  }, [search]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setExcludedIds(new Set());
    setAllMatchingSelected(false);
  }, []);

  const loadFirstPage = useCallback(async (
    nextFilters: GuestGalleryAdminPhotoFilters,
    options?: { quiet?: boolean }
  ) => {
    const requestSequence = ++requestSequenceRef.current;
    firstPageInFlightRef.current = true;

    if (!options?.quiet) {
      setIsLoadingFirstPage(true);
    }
    setLoadError("");

    try {
      const result = await getAdminGuestGalleryPhotosPageAction(galleryId, nextFilters, null);

      if (requestSequence !== requestSequenceRef.current || !result.ok) {
        return;
      }

      setPhotos(result.photos);
      setNextCursor(result.nextCursor);
      setTotalCount(result.totalCount ?? result.photos.length);
      revisionRef.current = result.revision;
      setHasUpdates(false);
    } catch {
      if (requestSequence === requestSequenceRef.current) {
        setLoadError("A vendégfotók betöltése nem sikerült. Próbáld újra.");
      }
    } finally {
      if (requestSequence === requestSequenceRef.current) {
        firstPageInFlightRef.current = false;
        setIsLoadingFirstPage(false);
      }
    }
  }, [galleryId]);

  useEffect(() => {
    const intervalId = window.setInterval(async () => {
      if (
        document.visibilityState !== "visible" ||
        revisionCheckInFlightRef.current ||
        firstPageInFlightRef.current ||
        loadMoreInFlightRef.current
      ) {
        return;
      }

      revisionCheckInFlightRef.current = true;

      try {
        const result = await getAdminGuestGalleryRevisionAction(galleryId, revisionRef.current);

        if (result.ok && !result.unchanged) {
          revisionRef.current = result.revision;
          setHasUpdates(true);
        }
      } catch {
        // A háttérellenőrzés hibája nem zavarhatja meg a folyamatban lévő moderálást.
      } finally {
        revisionCheckInFlightRef.current = false;
      }
    }, 10_000);

    return () => window.clearInterval(intervalId);
  }, [galleryId]);

  useEffect(() => {
    if (!didMountFiltersRef.current) {
      didMountFiltersRef.current = true;
      return;
    }

    clearSelection();
    setNotice(null);
    void loadFirstPage(filters);
  }, [clearSelection, filters, loadFirstPage]);

  const loadMorePhotos = useCallback(async () => {
    const cursor = nextCursor;

    if (!cursor || loadMoreInFlightRef.current || firstPageInFlightRef.current) {
      return;
    }

    const requestSequence = requestSequenceRef.current;
    loadMoreInFlightRef.current = true;
    setIsLoadingMore(true);
    setLoadError("");

    try {
      const result = await getAdminGuestGalleryPhotosPageAction(galleryId, filters, cursor);

      if (!result.ok || requestSequence !== requestSequenceRef.current) {
        if (requestSequence !== requestSequenceRef.current) {
          return;
        }
        throw new Error("load_failed");
      }

      setPhotos((current) => mergePhotos(current, result.photos));
      setNextCursor(result.nextCursor);
      if (result.totalCount !== null) {
        setTotalCount(result.totalCount);
      }
    } catch {
      if (requestSequence === requestSequenceRef.current) {
        setLoadError("A következő képek betöltése nem sikerült. Próbáld újra.");
      }
    } finally {
      loadMoreInFlightRef.current = false;
      setIsLoadingMore(false);
    }
  }, [filters, galleryId, nextCursor]);

  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;

    if (!sentinel || !nextCursor) {
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        void loadMorePhotos();
      }
    }, { rootMargin: "600px 0px" });

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMorePhotos, nextCursor]);

  function isPhotoSelected(photoId: string) {
    return allMatchingSelected ? !excludedIds.has(photoId) : selectedIds.has(photoId);
  }

  function togglePhoto(photoId: string) {
    if (allMatchingSelected) {
      setExcludedIds((current) => {
        const next = new Set(current);

        if (next.has(photoId)) {
          next.delete(photoId);
        } else {
          next.add(photoId);
        }

        return next;
      });
      return;
    }

    setSelectedIds((current) => {
      const next = new Set(current);

      if (next.has(photoId)) {
        next.delete(photoId);
      } else {
        next.add(photoId);
      }

      return next;
    });
  }

  function toggleAllLoaded() {
    if (allMatchingSelected) {
      if (allLoadedSelected && photos.length >= totalCount) {
        clearSelection();
        return;
      }

      setExcludedIds((current) => {
        const next = new Set(current);

        if (allLoadedSelected) {
          photos.forEach((photo) => next.add(photo.id));
        } else {
          photos.forEach((photo) => next.delete(photo.id));
        }

        return next;
      });
      return;
    }

    setSelectedIds((current) => {
      const next = new Set(current);

      if (allLoadedSelected) {
        photos.forEach((photo) => next.delete(photo.id));
      } else {
        photos.forEach((photo) => next.add(photo.id));
      }

      return next;
    });
  }

  function selectEveryMatchingPhoto() {
    setAllMatchingSelected(true);
    setSelectedIds(new Set());
    setExcludedIds(new Set());
  }

  function clearFilters() {
    setSearch("");
    setDebouncedSearch("");
    setStatusFilter("all");
    setDateFilter("all");
  }

  function refreshPhotos() {
    clearSelection();
    void loadFirstPage(filters);
  }

  function runOperation(operation: "approve" | "hide" | "delete") {
    if (selectedCount === 0 || isPending) {
      return;
    }

    if (operation === "delete" && !window.confirm(
      `Biztosan véglegesen törlöd a kijelölt ${selectedCount} képet? A fájlok sem állíthatók vissza.`
    )) {
      return;
    }

    const selection: GuestGalleryAdminSelection = allMatchingSelected
      ? { mode: "filter", filters, excludedIds: [...excludedIds] }
      : { mode: "ids", ids: [...selectedIds] };
    setNotice(null);

    startTransition(async () => {
      try {
        const result = await bulkUpdateGuestPhotosAction(galleryId, selection, operation);

        if (!result.ok) {
          setNotice({ type: "error", message: result.message });
          return;
        }

        clearSelection();
        setNotice({ type: "success", message: result.message });
        await loadFirstPage(filters, { quiet: true });
        router.refresh();
      } catch {
        setNotice({ type: "error", message: "A tömeges művelet nem sikerült. Próbáld újra." });
      }
    });
  }

  return (
    <div className="mt-5">
      <div className="flex flex-wrap gap-2" aria-label="Státusz szerinti szűrés">
        {STATUS_FILTERS.map((filter) => {
          const active = statusFilter === filter.value;
          const attention = filter.value === "pending_review" || filter.value === "failed";

          return (
            <button
              key={filter.value}
              type="button"
              onClick={() => setStatusFilter(filter.value)}
              aria-pressed={active}
              className={`inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition ${active
                ? "border-ink bg-ink text-white"
                : attention && counts[filter.value] > 0
                  ? "border-brass/35 bg-brass/10 text-ink hover:border-brass"
                  : "border-ink/10 bg-white text-graphite hover:border-ink/30 hover:text-ink"
              }`}
            >
              {filter.label}
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? "bg-white/15" : "bg-ink/5"}`}>
                {counts[filter.value]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(240px,1fr)_180px_auto]">
        <label className="relative block">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-graphite/45" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Vendég, e-mail vagy fájlnév keresése"
            className="h-11 w-full rounded-md border border-ink/15 bg-white pl-10 pr-10 text-sm text-ink outline-none transition focus:border-ink/50"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Keresés törlése"
              className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-graphite/55 hover:bg-ink/5 hover:text-ink"
            >
              <X size={15} />
            </button>
          ) : null}
        </label>
        <select
          value={dateFilter}
          onChange={(event) => setDateFilter(event.target.value as GuestGalleryAdminDateFilter)}
          aria-label="Feltöltési időszak"
          className="h-11 rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50"
        >
          <option value="all">Minden időpont</option>
          <option value="today">Ma</option>
          <option value="7d">Elmúlt 7 nap</option>
          <option value="30d">Elmúlt 30 nap</option>
        </select>
        <div className="flex gap-2">
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-md border border-ink/15 bg-white px-3 text-xs font-semibold text-ink transition hover:bg-ink/5"
            >
              <X size={14} /> Szűrők törlése
            </button>
          ) : null}
          <button
            type="button"
            onClick={refreshPhotos}
            disabled={isLoadingFirstPage}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-md border border-ink/15 bg-white text-ink transition hover:bg-ink/5 disabled:opacity-45"
            aria-label="Fotók frissítése"
            title="Fotók frissítése"
          >
            <RefreshCw size={16} className={isLoadingFirstPage ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {hasUpdates ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-sage/25 bg-sage/10 px-4 py-3 text-sm text-sage">
          <span className="font-medium">Új vagy frissített vendégfotók érkeztek.</span>
          <button type="button" onClick={refreshPhotos} className="font-semibold underline underline-offset-2">
            Lista frissítése
          </button>
        </div>
      ) : null}

      <div className={`mt-3 flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between ${selectedCount > 0
        ? "sticky top-3 z-20 border-ink/20 bg-white shadow-lg"
        : "border-ink/10 bg-paper"
      }`}>
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-ink">
            <input
              type="checkbox"
              checked={allLoadedSelected}
              onChange={toggleAllLoaded}
              className="size-4 accent-ink"
            />
            Betöltött képek kijelölése
          </label>
          <span className="text-xs text-graphite/60">
            {photos.length} betöltve · {totalCount} találat{selectedCount > 0 ? ` · ${selectedCount} kijelölve` : ""}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => runOperation("approve")}
            disabled={selectedCount === 0 || isPending}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-sage px-3 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Jóváhagyás
          </button>
          <button
            type="button"
            onClick={() => runOperation("hide")}
            disabled={selectedCount === 0 || isPending}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-ink/15 bg-white px-3 text-xs font-semibold text-ink transition hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <EyeOff size={14} /> Elrejtés
          </button>
          <button
            type="button"
            onClick={() => runOperation("delete")}
            disabled={selectedCount === 0 || isPending}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 size={14} /> Törlés
          </button>
          {selectedCount > 0 ? (
            <button
              type="button"
              onClick={clearSelection}
              disabled={isPending}
              className="inline-flex h-9 items-center justify-center gap-1 rounded-md px-2 text-xs font-medium text-graphite hover:bg-ink/5"
            >
              <X size={14} /> Mégse
            </button>
          ) : null}
        </div>
      </div>

      {!allMatchingSelected && allLoadedSelected && totalCount > selectedIds.size ? (
        <div className="mt-3 rounded-md border border-brass/25 bg-brass/10 px-4 py-3 text-center text-sm text-ink">
          {selectedIds.size} betöltött kép van kijelölve.{" "}
          <button type="button" onClick={selectEveryMatchingPhoto} className="font-semibold underline underline-offset-2">
            Mind a(z) {totalCount} találat kijelölése
          </button>
        </div>
      ) : allMatchingSelected ? (
        <div className="mt-3 rounded-md border border-sage/25 bg-sage/10 px-4 py-3 text-center text-sm font-medium text-sage">
          {excludedIds.size === 0
            ? `A szűrés mind a(z) ${selectedCount} találata ki van jelölve.`
            : `${selectedCount} találat kijelölve · ${excludedIds.size} kép kihagyva.`}
        </div>
      ) : null}

      {notice ? (
        <p className={`mt-3 rounded-md border px-3 py-2 text-sm ${notice.type === "success" ? "border-sage/20 bg-sage/10 text-sage" : "border-red-200 bg-red-50 text-red-700"}`}>
          {notice.message}
        </p>
      ) : null}

      {loadError ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <span>{loadError}</span>
          <button type="button" onClick={refreshPhotos} className="font-semibold underline underline-offset-2">
            Újrapróbálás
          </button>
        </div>
      ) : null}

      <div className={isLoadingFirstPage ? "pointer-events-none opacity-45" : ""} aria-busy={isLoadingFirstPage}>
        {photos.length > 0 ? (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {photos.map((photo) => {
              const selected = isPhotoSelected(photo.id);
              const identity = photo.guestName || photo.email || "Névtelen vendég";
              const meta = statusMeta(photo);

              return (
                <article key={photo.id} className={`overflow-hidden rounded-md border bg-paper transition ${selected ? "border-ink ring-2 ring-ink/15" : "border-ink/10"}`}>
                  <button
                    type="button"
                    onClick={() => togglePhoto(photo.id)}
                    aria-pressed={selected}
                    aria-label={`${photo.filename} ${selected ? "kijelölésének megszüntetése" : "kijelölése"}`}
                    className="relative block aspect-square w-full overflow-hidden bg-mist text-left"
                  >
                    <Image
                      src={photo.thumbnailUrl || photo.previewUrl || photo.imageUrl}
                      alt={photo.filename}
                      fill
                      unoptimized
                      className="pointer-events-none object-cover"
                      sizes="(min-width: 1280px) 20vw, (min-width: 768px) 25vw, 50vw"
                    />
                    <span className={`absolute right-2 top-2 grid size-8 place-items-center rounded-full border shadow-sm ${selected
                      ? "border-ink bg-ink text-white"
                      : "border-white/80 bg-white/95 text-transparent"
                    }`}>
                      <Check size={16} />
                    </span>
                    <span className={`absolute left-2 top-2 rounded-full px-2 py-1 text-[10px] font-semibold ${meta.className}`}>
                      {meta.label}
                    </span>
                    {photo.processingStatus === "failed" ? (
                      <span className="absolute bottom-2 right-2 rounded-full bg-red-700 px-2 py-1 text-[10px] font-semibold text-white">Feldolgozási hiba</span>
                    ) : photo.processingStatus !== "ready" && photo.status !== "pending" ? (
                      <span className="absolute bottom-2 right-2 rounded-full bg-ink/75 px-2 py-1 text-[10px] font-semibold text-white">Előnézet készül</span>
                    ) : null}
                  </button>
                  <div className="p-3">
                    <p className="truncate text-xs font-semibold text-ink" title={photo.filename}>{photo.filename}</p>
                    <p className="mt-1 truncate text-[11px] text-graphite/55" title={identity}>{identity}</p>
                    {photo.guestName && photo.email ? <p className="mt-1 truncate text-[11px] text-graphite/45" title={photo.email}>{photo.email}</p> : null}
                    <p className="mt-1 text-[11px] text-graphite/55">
                      {formatFileSize(photo.fileSize)} · {uploadDateFormatter.format(new Date(photo.createdAt))}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        ) : isLoadingFirstPage ? (
          <div className="mt-4 flex min-h-40 items-center justify-center rounded-md border border-ink/10 bg-paper text-sm text-graphite/65">
            <Loader2 size={18} className="mr-2 animate-spin" /> Fotók betöltése...
          </div>
        ) : (
          <div className="mt-4 rounded-md border border-dashed border-ink/15 bg-paper px-5 py-10 text-center text-sm text-graphite/65">
            <p>Nincs a szűrésnek megfelelő vendégfotó.</p>
            {hasActiveFilters ? (
              <button type="button" onClick={clearFilters} className="mt-3 font-semibold text-ink underline underline-offset-2">
                Összes fotó mutatása
              </button>
            ) : null}
          </div>
        )}
      </div>

      <div ref={loadMoreSentinelRef} className="mt-5 flex min-h-12 items-center justify-center">
        {nextCursor ? (
          <button
            type="button"
            onClick={() => void loadMorePhotos()}
            disabled={isLoadingMore || isLoadingFirstPage}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-ink/15 bg-white px-4 text-sm font-medium text-ink transition hover:bg-paper disabled:opacity-45"
          >
            {isLoadingMore ? <Loader2 size={16} className="animate-spin" /> : null}
            {isLoadingMore ? "További képek betöltése..." : "További képek"}
          </button>
        ) : photos.length > 0 ? (
          <p className="text-xs text-graphite/55">Mind a(z) {totalCount} találat betöltve.</p>
        ) : null}
      </div>
    </div>
  );
}
