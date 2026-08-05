"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, EyeOff, Loader2, Search, Trash2, X } from "lucide-react";
import { bulkUpdateGuestPhotosAction } from "@/lib/guest-gallery-actions";

export type GuestGalleryAdminPhoto = {
  id: string;
  filename: string;
  email: string | null;
  guestName: string | null;
  imageUrl: string;
  thumbnailUrl: string;
  previewUrl: string;
  fileSize: number;
  status: string;
  processingStatus: string;
  createdAt: string;
};

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

function matchesDate(photo: GuestGalleryAdminPhoto, filter: string) {
  if (filter === "all") {
    return true;
  }

  const createdAt = new Date(photo.createdAt);
  const now = new Date();

  if (filter === "today") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return createdAt >= start;
  }

  const days = filter === "7d" ? 7 : 30;
  return createdAt.getTime() >= now.getTime() - days * 24 * 60 * 60 * 1000;
}

export function GuestGalleryPhotoManager({
  galleryId,
  initialPhotos
}: {
  galleryId: string;
  initialPhotos: GuestGalleryAdminPhoto[];
}) {
  const router = useRouter();
  const [photos, setPhotos] = useState(initialPhotos);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setPhotos(initialPhotos);
  }, [initialPhotos]);

  const filteredPhotos = useMemo(() => {
    const query = search.trim().toLowerCase();

    return photos.filter((photo) => {
      const identity = `${photo.guestName ?? ""} ${photo.email ?? ""} ${photo.filename}`.toLowerCase();
      const matchesSearch = !query || identity.includes(query);
      const matchesStatus = statusFilter === "all"
        ? true
        : statusFilter === "uploading"
          ? photo.status === "pending" || photo.processingStatus === "uploading"
        : statusFilter === "processing"
          ? photo.processingStatus === "pending" || photo.processingStatus === "processing"
          : statusFilter === "failed"
            ? photo.processingStatus === "failed"
            : photo.status === statusFilter;

      return matchesSearch && matchesStatus && matchesDate(photo, dateFilter);
    });
  }, [dateFilter, photos, search, statusFilter]);

  const selectedCount = selectedIds.size;
  const allFilteredSelected = filteredPhotos.length > 0 && filteredPhotos.every((photo) => selectedIds.has(photo.id));

  function togglePhoto(photoId: string) {
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

  function toggleAllFiltered() {
    setSelectedIds((current) => {
      const next = new Set(current);

      if (allFilteredSelected) {
        filteredPhotos.forEach((photo) => next.delete(photo.id));
      } else {
        filteredPhotos.forEach((photo) => next.add(photo.id));
      }

      return next;
    });
  }

  function runOperation(operation: "approve" | "hide" | "delete") {
    if (selectedCount === 0 || isPending) {
      return;
    }

    if (operation === "delete" && !window.confirm(`Biztosan véglegesen törlöd a kijelölt ${selectedCount} képet? Ez az R2-fájlokat is eltávolítja.`)) {
      return;
    }

    const ids = [...selectedIds];
    const operationIds = new Set(ids);
    setNotice(null);

    startTransition(async () => {
      try {
        const result = await bulkUpdateGuestPhotosAction(galleryId, ids, operation);

        if (!result.ok) {
          setNotice({ type: "error", message: result.message });
          return;
        }

        setPhotos((current) => operation === "delete"
          ? current.filter((photo) => !operationIds.has(photo.id))
          : current.map((photo) => operationIds.has(photo.id)
            ? { ...photo, status: operation === "approve" ? "visible" : "hidden" }
            : photo));
        setSelectedIds(new Set());
        setNotice({ type: "success", message: result.message });
        router.refresh();
      } catch {
        setNotice({ type: "error", message: "A tömeges művelet nem sikerült. Próbáld újra." });
      }
    });
  }

  return (
    <div className="mt-5">
      <div className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_190px_170px]">
        <label className="relative block">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-graphite/45" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Keresés vendég, e-mail vagy fájlnév alapján"
            className="h-11 w-full rounded-md border border-ink/15 bg-white pl-10 pr-3 text-sm text-ink outline-none transition focus:border-ink/50"
          />
        </label>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="h-11 rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50"
        >
          <option value="all">Minden státusz</option>
          <option value="pending_review">Jóváhagyásra vár</option>
          <option value="visible">Látható</option>
          <option value="hidden">Elrejtett</option>
          <option value="uploading">Feltöltés alatt</option>
          <option value="processing">Feldolgozás alatt</option>
          <option value="failed">Feldolgozási hiba</option>
        </select>
        <select
          value={dateFilter}
          onChange={(event) => setDateFilter(event.target.value)}
          className="h-11 rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50"
        >
          <option value="all">Minden időpont</option>
          <option value="today">Ma</option>
          <option value="7d">Elmúlt 7 nap</option>
          <option value="30d">Elmúlt 30 nap</option>
        </select>
      </div>

      <div className="mt-3 flex flex-col gap-3 rounded-md border border-ink/10 bg-paper p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-ink">
            <input
              type="checkbox"
              checked={allFilteredSelected}
              onChange={toggleAllFiltered}
              className="size-4 accent-ink"
            />
            A szűrt képek kijelölése
          </label>
          <span className="text-xs text-graphite/60">{filteredPhotos.length} találat · {selectedCount} kijelölve</span>
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
              onClick={() => setSelectedIds(new Set())}
              disabled={isPending}
              className="inline-flex h-9 items-center justify-center gap-1 rounded-md px-2 text-xs font-medium text-graphite hover:bg-ink/5"
            >
              <X size={14} /> Kijelölés törlése
            </button>
          ) : null}
        </div>
      </div>

      {notice ? (
        <p className={`mt-3 rounded-md border px-3 py-2 text-sm ${notice.type === "success" ? "border-sage/20 bg-sage/10 text-sage" : "border-red-200 bg-red-50 text-red-700"}`}>
          {notice.message}
        </p>
      ) : null}

      {filteredPhotos.length > 0 ? (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filteredPhotos.map((photo) => {
            const selected = selectedIds.has(photo.id);
            const identity = photo.guestName || photo.email || "Névtelen vendég";
            const meta = statusMeta(photo);

            return (
              <article key={photo.id} className={`overflow-hidden rounded-md border bg-paper transition ${selected ? "border-ink ring-2 ring-ink/15" : "border-ink/10"}`}>
                <div className="relative aspect-square overflow-hidden bg-mist">
                  <Image
                    src={photo.thumbnailUrl || photo.previewUrl || photo.imageUrl}
                    alt={photo.filename}
                    fill
                    unoptimized
                    className="object-cover"
                    sizes="(min-width: 1280px) 20vw, (min-width: 768px) 25vw, 50vw"
                  />
                  <label className="absolute right-2 top-2 grid size-8 cursor-pointer place-items-center rounded-md bg-white/95 shadow-sm">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => togglePhoto(photo.id)}
                      className="size-4 accent-ink"
                      aria-label={`${photo.filename} kijelölése`}
                    />
                  </label>
                  <span className={`absolute left-2 top-2 rounded-full px-2 py-1 text-[10px] font-semibold ${meta.className}`}>
                    {meta.label}
                  </span>
                  {photo.processingStatus === "failed" ? (
                    <span className="absolute bottom-2 right-2 rounded-full bg-red-700 px-2 py-1 text-[10px] font-semibold text-white">Feldolgozási hiba</span>
                  ) : photo.processingStatus !== "ready" && photo.status !== "pending" ? (
                    <span className="absolute bottom-2 right-2 rounded-full bg-ink/75 px-2 py-1 text-[10px] font-semibold text-white">Előnézet készül</span>
                  ) : null}
                </div>
                <div className="p-3">
                  <p className="truncate text-xs font-semibold text-ink" title={photo.filename}>{photo.filename}</p>
                  <p className="mt-1 truncate text-[11px] text-graphite/55" title={identity}>{identity}</p>
                  {photo.guestName && photo.email ? <p className="mt-1 truncate text-[11px] text-graphite/45" title={photo.email}>{photo.email}</p> : null}
                  <p className="mt-1 text-[11px] text-graphite/55">{formatFileSize(photo.fileSize)}</p>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 rounded-md border border-dashed border-ink/15 bg-paper px-5 py-10 text-center text-sm text-graphite/65">
          Nincs a szűrésnek megfelelő vendégfotó.
        </div>
      )}
    </div>
  );
}
