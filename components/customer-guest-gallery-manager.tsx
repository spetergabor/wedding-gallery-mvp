"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Eye, EyeOff, ExternalLink, Loader2, RefreshCw, RotateCcw, Search, Trash2, X } from "lucide-react";
import {
  getCustomerGuestGalleryPhotosPageAction,
  updateCustomerGuestPhotosAction
} from "@/lib/customer-guest-gallery-actions";
import type {
  CustomerGuestPhoto,
  CustomerGuestPhotoCursor,
  CustomerGuestPhotoFilters,
  CustomerGuestPhotoStatusFilter
} from "@/lib/customer-guest-gallery";

type StatusCounts = Record<CustomerGuestPhotoStatusFilter, number>;
type Operation = "approve" | "hide" | "trash" | "restore" | "delete";

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function mergePhotos(current: CustomerGuestPhoto[], additions: CustomerGuestPhoto[]) {
  const ids = new Set(current.map((photo) => photo.id));
  return [...current, ...additions.filter((photo) => !ids.has(photo.id))];
}

export function CustomerGuestGalleryManager({
  galleryId,
  language,
  initialPhotos,
  initialNextCursor,
  initialTotalCount,
  statusCounts
}: {
  galleryId: string;
  language: string;
  initialPhotos: CustomerGuestPhoto[];
  initialNextCursor: CustomerGuestPhotoCursor | null;
  initialTotalCount: number;
  statusCounts: StatusCounts;
}) {
  const german = language !== "hu";
  const router = useRouter();
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const requestSequenceRef = useRef(0);
  const firstPageInFlightRef = useRef(false);
  const loadMoreInFlightRef = useRef(false);
  const didMountFiltersRef = useRef(false);
  const [photos, setPhotos] = useState(initialPhotos);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [counts, setCounts] = useState(statusCounts);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<CustomerGuestPhotoStatusFilter>("all");
  const [isLoadingFirstPage, setIsLoadingFirstPage] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const filters = useMemo<CustomerGuestPhotoFilters>(() => ({
    search: debouncedSearch,
    status
  }), [debouncedSearch, status]);
  const selectedCount = selectedIds.size;
  const allLoadedSelected = photos.length > 0 && photos.every((photo) => selectedIds.has(photo.id));
  const formatter = useMemo(() => new Intl.DateTimeFormat(german ? "de-DE" : "hu-HU", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }), [german]);
  const statusFilters: Array<{ value: CustomerGuestPhotoStatusFilter; label: string }> = german
    ? [
        { value: "all", label: "Alle" },
        { value: "pending_review", label: "Zu prüfen" },
        { value: "visible", label: "Sichtbar" },
        { value: "hidden", label: "Ausgeblendet" },
        { value: "trash", label: "Papierkorb" }
      ]
    : [
        { value: "all", label: "Összes" },
        { value: "pending_review", label: "Ellenőrzendő" },
        { value: "visible", label: "Látható" },
        { value: "hidden", label: "Elrejtve" },
        { value: "trash", label: "Lomtár" }
      ];

  useEffect(() => setCounts(statusCounts), [statusCounts]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => window.clearTimeout(timeout);
  }, [search]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const loadFirstPage = useCallback(async (nextFilters: CustomerGuestPhotoFilters, quiet = false) => {
    const sequence = ++requestSequenceRef.current;
    firstPageInFlightRef.current = true;
    if (!quiet) setIsLoadingFirstPage(true);
    setLoadError("");

    try {
      const result = await getCustomerGuestGalleryPhotosPageAction(galleryId, nextFilters, null);

      if (sequence !== requestSequenceRef.current || !result.ok) return;
      setPhotos(result.photos);
      setNextCursor(result.nextCursor);
      setTotalCount(result.totalCount ?? result.photos.length);
    } catch {
      if (sequence === requestSequenceRef.current) {
        setLoadError(german ? "Die Fotos konnten nicht geladen werden." : "A fotókat nem sikerült betölteni.");
      }
    } finally {
      if (sequence === requestSequenceRef.current) {
        firstPageInFlightRef.current = false;
        setIsLoadingFirstPage(false);
      }
    }
  }, [galleryId, german]);

  useEffect(() => {
    if (!didMountFiltersRef.current) {
      didMountFiltersRef.current = true;
      return;
    }

    clearSelection();
    setNotice(null);
    void loadFirstPage(filters);
  }, [clearSelection, filters, loadFirstPage]);

  const loadMore = useCallback(async () => {
    const cursor = nextCursor;
    if (!cursor || loadMoreInFlightRef.current || firstPageInFlightRef.current) return;

    const sequence = requestSequenceRef.current;
    loadMoreInFlightRef.current = true;
    setIsLoadingMore(true);
    setLoadError("");

    try {
      const result = await getCustomerGuestGalleryPhotosPageAction(galleryId, filters, cursor);
      if (!result.ok || sequence !== requestSequenceRef.current) return;
      setPhotos((current) => mergePhotos(current, result.photos));
      setNextCursor(result.nextCursor);
    } catch {
      if (sequence === requestSequenceRef.current) {
        setLoadError(german ? "Weitere Fotos konnten nicht geladen werden." : "A további fotókat nem sikerült betölteni.");
      }
    } finally {
      loadMoreInFlightRef.current = false;
      setIsLoadingMore(false);
    }
  }, [filters, galleryId, german, nextCursor]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !nextCursor) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadMore();
    }, { rootMargin: "600px 0px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, nextCursor]);

  function togglePhoto(photoId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(photoId)) next.delete(photoId);
      else next.add(photoId);
      return next;
    });
  }

  function toggleAllLoaded() {
    setSelectedIds((current) => {
      if (allLoadedSelected) return new Set();
      const next = new Set(current);
      photos.forEach((photo) => next.add(photo.id));
      return next;
    });
  }

  function runOperation(operation: Operation) {
    if (selectedCount === 0 || isPending) return;
    const permanentDelete = operation === "delete";
    const question = german
      ? `Möchtet ihr ${selectedCount} Foto(s) endgültig löschen? Das kann nicht rückgängig gemacht werden.`
      : `Biztosan véglegesen törlitek a kijelölt ${selectedCount} fotót? Ez nem vonható vissza.`;
    if (permanentDelete && !window.confirm(question)) return;

    setNotice(null);
    startTransition(async () => {
      try {
        const result = await updateCustomerGuestPhotosAction(galleryId, [...selectedIds], operation);
        if (!result.ok) {
          setNotice({ type: "error", message: german ? "Die Änderung konnte nicht gespeichert werden." : "A módosítást nem sikerült elmenteni." });
          return;
        }

        clearSelection();
        setNotice({
          type: "success",
          message: german ? `${result.changedCount} Foto(s) aktualisiert.` : `${result.changedCount} fotó frissítve.`
        });
        await loadFirstPage(filters, true);
        router.refresh();
      } catch {
        setNotice({ type: "error", message: german ? "Die Änderung konnte nicht gespeichert werden." : "A módosítást nem sikerült elmenteni." });
      }
    });
  }

  function photoStatus(photo: CustomerGuestPhoto) {
    if (photo.customerDeletedAt) return german ? "Im Papierkorb" : "Lomtárban";
    if (photo.status === "visible") return german ? "Sichtbar" : "Látható";
    if (photo.status === "pending_review") return german ? "Zu prüfen" : "Ellenőrzendő";
    return german ? "Ausgeblendet" : "Elrejtve";
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap gap-2" aria-label={german ? "Nach Status filtern" : "Szűrés állapot szerint"}>
        {statusFilters.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => setStatus(filter.value)}
            aria-pressed={status === filter.value}
            className={`inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition ${status === filter.value ? "border-ink bg-ink text-white" : "border-ink/10 bg-white text-graphite hover:border-ink/30 hover:text-ink"}`}
          >
            {filter.label}
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${status === filter.value ? "bg-white/15" : "bg-ink/5"}`}>{counts[filter.value]}</span>
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <label className="relative block flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-graphite/45" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={german ? "Name, E-Mail oder Dateiname" : "Név, e-mail vagy fájlnév"}
            className="h-11 w-full rounded-md border border-ink/15 bg-white pl-10 pr-10 text-sm text-ink outline-none focus:border-ink/50"
          />
          {search ? <button type="button" onClick={() => setSearch("")} aria-label={german ? "Suche löschen" : "Keresés törlése"} className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full hover:bg-ink/5"><X size={15} /></button> : null}
        </label>
        <button type="button" onClick={() => void loadFirstPage(filters)} className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-ink/15 bg-white px-4 text-sm font-medium text-ink hover:bg-paper">
          <RefreshCw size={15} className={isLoadingFirstPage ? "animate-spin" : ""} /> {german ? "Aktualisieren" : "Frissítés"}
        </button>
      </div>

      <div className={`mt-3 flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between ${selectedCount ? "sticky top-3 z-20 border-ink/20 bg-white shadow-lg" : "border-ink/10 bg-paper"}`}>
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-ink">
            <input type="checkbox" checked={allLoadedSelected} onChange={toggleAllLoaded} className="size-4 accent-ink" />
            {german ? "Geladene Fotos auswählen" : "Betöltött fotók kijelölése"}
          </label>
          <span className="text-xs text-graphite/60">{photos.length} / {totalCount}{selectedCount ? ` · ${selectedCount} ${german ? "ausgewählt" : "kijelölve"}` : ""}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {status === "trash" ? (
            <>
              <button type="button" onClick={() => runOperation("restore")} disabled={!selectedCount || isPending} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-sage px-3 text-xs font-semibold text-white disabled:opacity-40"><RotateCcw size={14} /> {german ? "Wiederherstellen" : "Visszaállítás"}</button>
              <button type="button" onClick={() => runOperation("delete")} disabled={!selectedCount || isPending} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700 disabled:opacity-40"><Trash2 size={14} /> {german ? "Endgültig löschen" : "Végleges törlés"}</button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => runOperation("approve")} disabled={!selectedCount || isPending} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-sage px-3 text-xs font-semibold text-white disabled:opacity-40">{isPending ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />} {german ? "Freigeben" : "Jóváhagyás"}</button>
              <button type="button" onClick={() => runOperation("hide")} disabled={!selectedCount || isPending} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-ink/15 bg-white px-3 text-xs font-semibold text-ink disabled:opacity-40"><EyeOff size={14} /> {german ? "Ausblenden" : "Elrejtés"}</button>
              <button type="button" onClick={() => runOperation("trash")} disabled={!selectedCount || isPending} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700 disabled:opacity-40"><Trash2 size={14} /> {german ? "Papierkorb" : "Lomtár"}</button>
            </>
          )}
          {selectedCount ? <button type="button" onClick={clearSelection} disabled={isPending} className="inline-flex h-9 items-center gap-1 px-2 text-xs text-graphite"><X size={14} /> {german ? "Abbrechen" : "Mégse"}</button> : null}
        </div>
      </div>

      {status === "trash" ? <p className="mt-3 rounded-md border border-brass/25 bg-brass/10 px-4 py-3 text-sm text-ink">{german ? "Fotos im Papierkorb sind für Gäste unsichtbar. Ihr könnt sie wiederherstellen oder endgültig löschen." : "A lomtárban lévő fotókat a vendégek nem látják. Visszaállíthatók vagy végleg törölhetők."}</p> : null}
      {notice ? <p className={`mt-3 rounded-md border px-3 py-2 text-sm ${notice.type === "success" ? "border-sage/20 bg-sage/10 text-sage" : "border-red-200 bg-red-50 text-red-700"}`}>{notice.message}</p> : null}
      {loadError ? <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{loadError}</p> : null}

      <div className={isLoadingFirstPage ? "pointer-events-none opacity-45" : ""} aria-busy={isLoadingFirstPage}>
        {photos.length ? (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {photos.map((photo) => {
              const selected = selectedIds.has(photo.id);
              const identity = photo.guestName || photo.email || (german ? "Unbekannter Gast" : "Névtelen vendég");
              return (
                <article key={photo.id} className={`overflow-hidden rounded-md border bg-white transition ${selected ? "border-ink ring-2 ring-ink/15" : "border-ink/10"}`}>
                  <button type="button" onClick={() => togglePhoto(photo.id)} aria-pressed={selected} className="relative block aspect-square w-full overflow-hidden bg-mist">
                    <Image src={photo.thumbnailUrl || photo.previewUrl || photo.imageUrl} alt={photo.filename} fill unoptimized className="pointer-events-none object-cover" sizes="(min-width: 1280px) 20vw, (min-width: 768px) 25vw, 50vw" />
                    <span className={`absolute right-2 top-2 grid size-8 place-items-center rounded-full border shadow-sm ${selected ? "border-ink bg-ink text-white" : "border-white/80 bg-white/95 text-transparent"}`}><Check size={16} /></span>
                    <span className="absolute left-2 top-2 rounded-full bg-ink/80 px-2 py-1 text-[10px] font-semibold text-white">{photoStatus(photo)}</span>
                  </button>
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 truncate text-xs font-semibold text-ink" title={photo.filename}>{photo.filename}</p>
                      <a href={photo.imageUrl} target="_blank" rel="noreferrer" aria-label={german ? "Original öffnen" : "Eredeti megnyitása"} className="shrink-0 text-graphite/55 hover:text-ink"><ExternalLink size={14} /></a>
                    </div>
                    <p className="mt-1 truncate text-[11px] text-graphite/55" title={identity}>{identity}</p>
                    <p className="mt-1 text-[11px] text-graphite/50">{formatFileSize(photo.fileSize)} · {formatter.format(new Date(photo.createdAt))}</p>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 rounded-md border border-dashed border-ink/15 bg-paper px-5 py-12 text-center text-sm text-graphite/65">
            {isLoadingFirstPage ? <><Loader2 size={18} className="mx-auto mb-2 animate-spin" />{german ? "Fotos werden geladen..." : "Fotók betöltése..."}</> : (german ? "Keine passenden Fotos gefunden." : "Nincs a szűrésnek megfelelő fotó.")}
          </div>
        )}
      </div>

      <div ref={sentinelRef} className="mt-5 flex min-h-12 items-center justify-center">
        {nextCursor ? <button type="button" onClick={() => void loadMore()} disabled={isLoadingMore} className="inline-flex h-10 items-center gap-2 rounded-md border border-ink/15 bg-white px-4 text-sm font-medium text-ink disabled:opacity-45">{isLoadingMore ? <Loader2 size={15} className="animate-spin" /> : null}{german ? "Weitere Fotos" : "További fotók"}</button> : photos.length ? <span className="text-xs text-graphite/55">{german ? "Alle Treffer geladen." : "Minden találat betöltve."}</span> : null}
      </div>
    </div>
  );
}
