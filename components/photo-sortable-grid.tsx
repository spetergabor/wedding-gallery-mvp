"use client";

import Image from "next/image";
import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { CheckSquare, Eye, EyeOff, Film, FolderInput, GripVertical, ImageIcon, Square, Star, Trash2, Undo2, Upload, X } from "lucide-react";
import {
  deleteSelectedPhotosAction,
  deletePhotoAction,
  moveSelectedPhotosToSectionAction,
  restoreClientHiddenPhotoAction,
  saveGalleryPhotoOrderAction,
  setCoverPhotoAction,
  setVideoThumbnailAction
} from "@/lib/gallery-actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { EmptyState } from "@/components/empty-state";
import { FormSubmitButton } from "@/components/form-submit-button";
import { APP_TIME_ZONE } from "@/lib/date-format";
import {
  PHOTO_DELIVERY_STAGE_FINAL,
  PHOTO_DELIVERY_STAGE_RAW,
  isProofingGallery,
  photoDeliveryStageLabel
} from "@/lib/proofing";

export type SortablePhoto = {
  id: string;
  sectionId?: string | null;
  section?: {
    id: string;
    title: string;
    slug: string;
  } | null;
  filename: string;
  imageUrl: string;
  thumbnailUrl: string;
  previewUrl: string;
  deliveryStage: string;
  mediaType: string;
  fileSize: number;
  sortOrder: number;
  isClientHidden: boolean;
  clientHiddenAt: Date | null;
  processingStatus: string;
  processingError: string | null;
  processingRequestedAt: Date | null;
};

export type PhotoManagerSet = "all" | "raw" | "final" | "selected";

const STALE_PROCESSING_BADGE_MS = 2 * 60 * 60 * 1000;
const PHOTO_GRID_COLUMN_STORAGE_KEY = "speter.admin.photoGridColumns";
const PHOTO_GRID_COLUMN_OPTIONS = [3, 4, 5, 6, 7] as const;

type PhotoGridColumnCount = (typeof PHOTO_GRID_COLUMN_OPTIONS)[number];

function getAdminPreviewUrl(photo: SortablePhoto) {
  if (photo.thumbnailUrl && photo.thumbnailUrl !== photo.imageUrl) {
    return photo.thumbnailUrl;
  }

  if (photo.previewUrl && photo.previewUrl !== photo.imageUrl) {
    return photo.previewUrl;
  }

  return photo.imageUrl;
}

function hasProcessedVariant(photo: SortablePhoto) {
  return (
    photo.mediaType !== "video" &&
    ((photo.thumbnailUrl && photo.thumbnailUrl !== photo.imageUrl) ||
      (photo.previewUrl && photo.previewUrl !== photo.imageUrl))
  );
}

function hasCustomVideoThumbnail(photo: SortablePhoto) {
  return photo.mediaType === "video" && photo.thumbnailUrl && photo.thumbnailUrl !== photo.imageUrl;
}

function shouldShowProcessingBadge(photo: SortablePhoto) {
  if (photo.processingStatus === "ready" || hasProcessedVariant(photo)) {
    return false;
  }

  if (
    photo.processingStatus !== "failed" &&
    (!photo.processingRequestedAt ||
      Date.now() - photo.processingRequestedAt.getTime() > STALE_PROCESSING_BADGE_MS)
  ) {
    return false;
  }

  return true;
}

function photosChanged(left: SortablePhoto[], right: SortablePhoto[]) {
  return left.some((photo, index) => photo.id !== right[index]?.id);
}

export function PhotoSortableGrid({
  activeSearch,
  activeSet,
  coverPhotoId,
  emptyDescription,
  galleryId,
  galleryMode,
  photos,
  sections = [],
  selectedPhotoIds
}: {
  activeSearch: string;
  activeSet: PhotoManagerSet;
  coverPhotoId: string | null;
  emptyDescription: string;
  galleryId: string;
  galleryMode: string;
  photos: SortablePhoto[];
  sections?: Array<{ id: string; title: string }>;
  selectedPhotoIds: string[];
}) {
  const [orderedPhotos, setOrderedPhotos] = useState(() => photos);
  const [draggedPhotoId, setDraggedPhotoId] = useState<string | null>(null);
  const [dropTargetPhotoId, setDropTargetPhotoId] = useState<string | null>(null);
  const [gridColumnCount, setGridColumnCount] = useState<PhotoGridColumnCount>(3);
  const [bulkSelectedPhotoIds, setBulkSelectedPhotoIds] = useState<Set<string>>(() => new Set());
  const lastLiveMoveRef = useRef<{ draggedId: string; targetId: string } | null>(null);
  const lastBulkSelectionAnchorIdRef = useRef<string | null>(null);
  const proofingGallery = isProofingGallery(galleryMode);
  const selectedSet = useMemo(() => new Set(selectedPhotoIds), [selectedPhotoIds]);
  const normalizedSearch = activeSearch.trim().toLowerCase();
  const hasUnsavedOrder = photosChanged(orderedPhotos, photos);
  const compactGrid = gridColumnCount >= 5;
  const basePhotos = useMemo(() => {
    if (!proofingGallery) {
      return orderedPhotos;
    }

    return orderedPhotos.filter((photo) => {
      if (activeSet === "raw") {
        return photo.deliveryStage === PHOTO_DELIVERY_STAGE_RAW;
      }

      if (activeSet === "final") {
        return photo.deliveryStage === PHOTO_DELIVERY_STAGE_FINAL;
      }

      if (activeSet === "selected") {
        return selectedSet.has(photo.id);
      }

      return true;
    });
  }, [activeSet, orderedPhotos, proofingGallery, selectedSet]);
  const displayedPhotos = normalizedSearch
    ? basePhotos.filter((photo) => photo.filename.toLowerCase().includes(normalizedSearch))
    : basePhotos;
  const displayedPhotoIds = useMemo(() => displayedPhotos.map((photo) => photo.id), [displayedPhotos]);
  const bulkSelectedCount = bulkSelectedPhotoIds.size;
  const selectedVisibleCount = displayedPhotoIds.filter((photoId) => bulkSelectedPhotoIds.has(photoId)).length;
  const allDisplayedSelected = displayedPhotoIds.length > 0 && selectedVisibleCount === displayedPhotoIds.length;

  useEffect(() => {
    const storedColumnCount = Number(window.localStorage.getItem(PHOTO_GRID_COLUMN_STORAGE_KEY));

    if (PHOTO_GRID_COLUMN_OPTIONS.includes(storedColumnCount as PhotoGridColumnCount)) {
      setGridColumnCount(storedColumnCount as PhotoGridColumnCount);
    }
  }, []);

  useEffect(() => {
    const currentPhotoIds = new Set(photos.map((photo) => photo.id));
    setBulkSelectedPhotoIds((current) => {
      const next = new Set([...current].filter((photoId) => currentPhotoIds.has(photoId)));

      return next.size === current.size ? current : next;
    });

    if (lastBulkSelectionAnchorIdRef.current && !currentPhotoIds.has(lastBulkSelectionAnchorIdRef.current)) {
      lastBulkSelectionAnchorIdRef.current = null;
    }
  }, [photos]);

  function updateGridColumnCount(columnCount: PhotoGridColumnCount) {
    setGridColumnCount(columnCount);
    window.localStorage.setItem(PHOTO_GRID_COLUMN_STORAGE_KEY, String(columnCount));
  }

  function resetDragState() {
    setDraggedPhotoId(null);
    setDropTargetPhotoId(null);
    lastLiveMoveRef.current = null;
  }

  function movePhoto(draggedId: string, targetId: string) {
    if (draggedId === targetId) {
      return;
    }

    setOrderedPhotos((currentPhotos) => {
      const originalDraggedIndex = currentPhotos.findIndex((photo) => photo.id === draggedId);
      const originalTargetIndex = currentPhotos.findIndex((photo) => photo.id === targetId);

      if (originalDraggedIndex < 0 || originalTargetIndex < 0) {
        return currentPhotos;
      }

      const withoutDragged = currentPhotos.filter((photo) => photo.id !== draggedId);
      const targetIndex = withoutDragged.findIndex((photo) => photo.id === targetId);
      const insertIndex = originalDraggedIndex < originalTargetIndex ? targetIndex + 1 : targetIndex;
      const draggedPhoto = currentPhotos[originalDraggedIndex];
      const nextPhotos = [...withoutDragged];
      nextPhotos.splice(insertIndex, 0, draggedPhoto);

      return nextPhotos;
    });
  }

  function clearBulkSelection() {
    lastBulkSelectionAnchorIdRef.current = null;
    setBulkSelectedPhotoIds(new Set());
  }

  function toggleBulkSelection(photoId: string, extendRange = false) {
    const anchorId = lastBulkSelectionAnchorIdRef.current;
    const anchorIndex = anchorId ? displayedPhotoIds.indexOf(anchorId) : -1;
    const targetIndex = displayedPhotoIds.indexOf(photoId);

    if (extendRange && anchorIndex >= 0 && targetIndex >= 0) {
      const startIndex = Math.min(anchorIndex, targetIndex);
      const endIndex = Math.max(anchorIndex, targetIndex);
      const rangePhotoIds = displayedPhotoIds.slice(startIndex, endIndex + 1);

      setBulkSelectedPhotoIds((current) => {
        const next = new Set(current);

        for (const rangePhotoId of rangePhotoIds) {
          next.add(rangePhotoId);
        }

        return next;
      });
      return;
    }

    setBulkSelectedPhotoIds((current) => {
      const next = new Set(current);

      if (next.has(photoId)) {
        next.delete(photoId);
      } else {
        next.add(photoId);
      }

      return next;
    });
    lastBulkSelectionAnchorIdRef.current = photoId;
  }

  function selectDisplayedPhotos() {
    setBulkSelectedPhotoIds((current) => {
      const next = new Set(current);

      for (const photoId of displayedPhotoIds) {
        next.add(photoId);
      }

      return next;
    });
  }

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 rounded-lg border border-ink/10 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-ink">Képek egy sorban</p>
          <p className="mt-0.5 text-xs text-graphite/70">
            Nagy kijelzőn most {gridColumnCount} kép látszik egy sorban.
          </p>
        </div>
        <div className="inline-flex w-full rounded-md border border-ink/10 bg-mist p-1 sm:w-auto">
          {PHOTO_GRID_COLUMN_OPTIONS.map((columnCount) => {
            const isActive = gridColumnCount === columnCount;

            return (
              <button
                key={columnCount}
                type="button"
                onClick={() => updateGridColumnCount(columnCount)}
                className={`h-9 flex-1 rounded px-3 text-sm font-semibold transition sm:flex-none ${
                  isActive
                    ? "bg-ink text-white shadow-soft"
                    : "text-graphite hover:bg-white hover:text-ink"
                }`}
                aria-pressed={isActive}
              >
                {columnCount}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 rounded-lg border border-ink/10 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-ink">Tömeges műveletek</p>
          <p className="mt-0.5 text-xs text-graphite/70">
            {bulkSelectedCount > 0
              ? `${bulkSelectedCount} kép kijelölve törléshez vagy címke alá helyezéshez.`
              : "Jelölj ki több képet, Shift-kattintással teljes tartományt is választhatsz."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={selectDisplayedPhotos}
            disabled={displayedPhotoIds.length === 0 || allDisplayedSelected}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-ink/12 bg-white px-3 text-sm font-medium text-graphite transition hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CheckSquare size={15} />
            Láthatók kijelölése
          </button>
          {bulkSelectedCount > 0 ? (
            <button
              type="button"
              onClick={clearBulkSelection}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-ink/12 bg-white px-3 text-sm font-medium text-graphite transition hover:bg-ink/5"
            >
              <Undo2 size={15} />
              Kijelölés törlése
            </button>
          ) : null}
        </div>
      </div>

      <div
        className="grid gap-4 sm:grid-cols-2 xl:[grid-template-columns:repeat(var(--photo-grid-columns),minmax(0,1fr))]"
        style={{ "--photo-grid-columns": gridColumnCount } as CSSProperties}
      >
        {displayedPhotos.map((photo) => {
          const currentIndex = orderedPhotos.findIndex((orderedPhoto) => orderedPhoto.id === photo.id);
          const isDragging = draggedPhotoId === photo.id;
          const isDropTarget = dropTargetPhotoId === photo.id && !isDragging;
          const isBulkSelected = bulkSelectedPhotoIds.has(photo.id);

          return (
            <div
              key={photo.id}
              draggable
              aria-grabbed={isDragging}
              onDragStart={(event) => {
                setDraggedPhotoId(photo.id);
                setDropTargetPhotoId(null);
                lastLiveMoveRef.current = null;
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", photo.id);
                event.dataTransfer.setDragImage(
                  event.currentTarget,
                  event.currentTarget.offsetWidth / 2,
                  Math.min(event.currentTarget.offsetHeight / 2, 180)
                );
              }}
              onDragEnter={(event) => {
                event.preventDefault();
                const draggedId = event.dataTransfer.getData("text/plain") || draggedPhotoId;

                if (!draggedId || draggedId === photo.id) {
                  return;
                }

                setDropTargetPhotoId(photo.id);

                const lastLiveMove = lastLiveMoveRef.current;
                if (lastLiveMove?.draggedId === draggedId && lastLiveMove.targetId === photo.id) {
                  return;
                }

                lastLiveMoveRef.current = { draggedId, targetId: photo.id };
                movePhoto(draggedId, photo.id);
              }}
              onDragEnd={resetDragState}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                if (dropTargetPhotoId !== photo.id) {
                  setDropTargetPhotoId(photo.id);
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                resetDragState();
              }}
              className={`group relative transform-gpu cursor-grab overflow-hidden rounded-lg border bg-white shadow-sm transition-[transform,box-shadow,border-color,opacity] duration-200 ease-out active:cursor-grabbing ${
                isDragging
                  ? "scale-[1.02] rotate-[0.35deg] border-brass/70 opacity-85 shadow-[0_18px_45px_rgba(17,17,17,0.16)] ring-2 ring-brass/25"
                  : isDropTarget
                    ? "-translate-y-0.5 border-brass/45 shadow-[0_12px_30px_rgba(178,139,78,0.16)]"
                    : isBulkSelected
                      ? "border-brass/50 shadow-soft ring-2 ring-brass/20"
                      : "border-ink/10 hover:-translate-y-0.5 hover:border-brass/25 hover:shadow-soft"
              }`}
            >
              {isDropTarget ? (
                <span className="pointer-events-none absolute inset-2 z-10 rounded-md border border-dashed border-brass/45" />
              ) : null}
              <div className="relative aspect-[4/3] bg-mist">
                {photo.mediaType === "video" ? (
                  <div className="relative h-full w-full bg-ink">
                    {hasCustomVideoThumbnail(photo) ? (
                      <Image
                        src={getAdminPreviewUrl(photo)}
                        alt={photo.filename}
                        fill
                        draggable={false}
                        unoptimized
                        loading="lazy"
                        className="object-cover"
                        sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
                      />
                    ) : (
                      <video src={photo.imageUrl} preload="metadata" muted playsInline className="h-full w-full object-cover opacity-85" />
                    )}
                    <span className="absolute inset-0 grid place-items-center text-white">
                      <span className="inline-flex items-center gap-2 rounded-md bg-white/90 px-3 py-2 text-sm font-medium text-ink shadow-soft">
                        <Film size={16} />
                        Videó
                      </span>
                    </span>
                  </div>
                ) : (
                  <Image
                    src={getAdminPreviewUrl(photo)}
                    alt={photo.filename}
                    fill
                    draggable={false}
                    unoptimized
                    loading="lazy"
                    className="object-cover"
                    sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
                  />
                )}
                <span
                  className={`absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                    isDragging ? "bg-ink text-white" : "bg-white/90 text-ink"
                  }`}
                >
                  <GripVertical size={13} />
                  Húzd
                </span>
                {coverPhotoId === photo.id ? (
                  <span className="absolute left-3 bottom-3 inline-flex items-center gap-1.5 rounded-md bg-white/90 px-2.5 py-1 text-xs font-medium text-ink">
                    <Star size={13} />
                    Borító
                  </span>
                ) : null}
                {proofingGallery ? (
                  <span className="absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-md bg-white/90 px-2.5 py-1 text-xs font-medium text-ink">
                    {photoDeliveryStageLabel(photo.deliveryStage)}
                  </span>
                ) : null}
                {photo.isClientHidden ? (
                  <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-md bg-ink/85 px-2.5 py-1 text-xs font-medium text-white">
                    <EyeOff size={13} />
                    Ügyfél elrejtette
                  </span>
                ) : null}
                {shouldShowProcessingBadge(photo) ? (
                  <span className="absolute bottom-3 left-3 rounded-md bg-white/90 px-2.5 py-1 text-xs font-medium text-graphite">
                    {photo.processingStatus === "failed" ? "Feldolgozás hibás" : "Feldolgozás alatt"}
                  </span>
                ) : null}
              </div>
              <div className={`${compactGrid ? "space-y-2 p-2.5" : "space-y-3 p-3"}`}>
                <div>
                  <p className="truncate text-sm font-medium text-ink">{photo.filename}</p>
                  <p className="mt-1 text-xs text-graphite/70">
                    Sorrend: {currentIndex + 1}
                    {proofingGallery ? ` · ${photoDeliveryStageLabel(photo.deliveryStage)}` : ""}
                  </p>
                  {photo.section?.title ? (
                    <p className="mt-1 truncate text-xs font-medium text-brass">Címke: {photo.section.title}</p>
                  ) : null}
                  {photo.processingError ? (
                    <p className="mt-1 text-xs text-red-700">{photo.processingError}</p>
                  ) : null}
                  {photo.clientHiddenAt ? (
                    <p className="mt-1 text-xs text-brass">
                      Elrejtve:{" "}
                      {photo.clientHiddenAt.toLocaleString("hu-HU", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: APP_TIME_ZONE
                      })}
                    </p>
                  ) : null}
                </div>

                <div className="grid grid-cols-[auto_1fr_auto] gap-2">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleBulkSelection(photo.id, event.shiftKey);
                    }}
                    className={`flex size-9 items-center justify-center rounded-md border text-sm transition ${
                      isBulkSelected
                        ? "border-brass/40 bg-brass/15 text-brass"
                        : "border-ink/10 text-graphite hover:bg-ink/5"
                    }`}
                    aria-pressed={isBulkSelected}
                    title={isBulkSelected ? "Kijelölés megszüntetése" : "Kijelölés tömeges művelethez. Shift-kattintással tartományt jelölsz."}
                  >
                    {isBulkSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                  </button>
                  <form action={setCoverPhotoAction.bind(null, galleryId, photo.id)}>
                    <button
                      disabled={coverPhotoId === photo.id}
                      className={`flex h-9 w-full items-center justify-center gap-2 rounded-md border border-ink/10 text-sm text-graphite transition hover:bg-ink/5 disabled:cursor-not-allowed disabled:bg-sage/10 disabled:text-sage ${
                        compactGrid ? "px-2" : "px-3"
                      }`}
                      title={coverPhotoId === photo.id ? "Borítókép" : "Legyen borító"}
                    >
                      <Star size={15} />
                      <span className={compactGrid ? "sr-only" : ""}>
                        {coverPhotoId === photo.id ? "Borítókép" : "Legyen borító"}
                      </span>
                    </button>
                  </form>
                  <form action={deletePhotoAction.bind(null, photo.id, galleryId)}>
                    <ConfirmSubmitButton
                      title="Fotó törlése"
                      message="Biztosan törlöd ezt a fotót? A feltöltött képfájl is törlődik."
                      variant="danger"
                      className="!size-9 shrink-0 !p-0"
                    >
                      <X size={18} strokeWidth={2.4} />
                    </ConfirmSubmitButton>
                  </form>
                </div>

                {photo.mediaType === "video" ? (
                  <form
                    action={setVideoThumbnailAction.bind(null, photo.id, galleryId)}
                    encType="multipart/form-data"
                    className="rounded-md border border-ink/10 bg-paper p-2"
                  >
                    <label className="flex items-center gap-2 text-xs font-medium text-graphite">
                      <ImageIcon size={14} />
                      Videó thumbnail
                    </label>
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                      <input
                        name="videoThumbnail"
                        type="file"
                        accept="image/*"
                        required
                        className="min-w-0 flex-1 rounded-md border border-ink/10 bg-white text-xs text-graphite file:mr-3 file:h-9 file:border-0 file:bg-ink file:px-3 file:text-xs file:font-medium file:text-white"
                      />
                      <FormSubmitButton
                        variant="secondary"
                        pendingLabel="Mentés..."
                        className="h-9 shrink-0 px-3 text-xs"
                      >
                        <Upload size={14} />
                        <span className={compactGrid ? "sr-only" : ""}>
                          {hasCustomVideoThumbnail(photo) ? "Csere" : "Mentés"}
                        </span>
                      </FormSubmitButton>
                    </div>
                  </form>
                ) : null}

                {photo.isClientHidden ? (
                  <form action={restoreClientHiddenPhotoAction.bind(null, galleryId, photo.id)}>
                    <button className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-brass/30 bg-brass/10 px-3 text-sm text-brass transition hover:bg-brass/15">
                      <Eye size={15} />
                      <span className={compactGrid ? "sr-only" : ""}>Visszatenni publikusba</span>
                    </button>
                  </form>
                ) : null}
              </div>
            </div>
          );
        })}
        {displayedPhotos.length === 0 ? (
          <div className="col-span-full">
            <EmptyState
              icon={<ImageIcon size={22} />}
              title={normalizedSearch ? "Nincs találat" : "Még nincs fotó"}
              description={normalizedSearch ? "Próbálj teljes vagy részleges fájlnevet keresni, például SP2_4439 vagy DJI_0018." : emptyDescription}
            />
          </div>
        ) : null}
      </div>

      {hasUnsavedOrder ? (
        <form
          action={saveGalleryPhotoOrderAction.bind(null, galleryId)}
          className={`fixed inset-x-4 z-40 mx-auto flex max-w-3xl flex-col gap-3 rounded-lg border border-brass/25 bg-white/95 p-3 shadow-[0_18px_60px_rgba(17,17,17,0.18)] backdrop-blur md:flex-row md:items-center md:justify-between ${
            bulkSelectedCount > 0 ? "bottom-56 lg:bottom-28" : "bottom-4"
          }`}
        >
          <div>
            <p className="text-sm font-semibold text-ink">A képsorrend módosult</p>
            <p className="mt-0.5 text-xs text-graphite/70">A változás csak a mentés után kerül élesbe.</p>
          </div>
          {orderedPhotos.map((photo) => (
            <input key={photo.id} type="hidden" name="photoIds" value={photo.id} />
          ))}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOrderedPhotos(photos)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-ink/12 bg-white px-3 text-sm font-medium text-graphite transition hover:bg-ink/5"
            >
              <Undo2 size={15} />
              Visszaállítás
            </button>
            <FormSubmitButton className="h-10 px-4" pendingLabel="Mentés...">
              Sorrend mentése
            </FormSubmitButton>
          </div>
        </form>
      ) : null}

      {bulkSelectedCount > 0 ? (
        <div className="fixed inset-x-4 bottom-4 z-50 mx-auto grid max-w-6xl gap-3 rounded-lg border border-ink/10 bg-white/95 p-3 shadow-[0_18px_60px_rgba(17,17,17,0.18)] backdrop-blur lg:grid-cols-[minmax(180px,0.75fr)_minmax(420px,1.1fr)_auto] lg:items-center">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">{bulkSelectedCount} kép kijelölve</p>
            <p className="mt-0.5 text-xs text-graphite/70">Címke alá helyezés vagy törlés.</p>
          </div>
          <form
            action={moveSelectedPhotosToSectionAction.bind(null, galleryId)}
            className="grid min-w-0 gap-2 sm:grid-cols-[minmax(220px,1fr)_auto]"
          >
            {[...bulkSelectedPhotoIds].map((photoId) => (
              <input key={photoId} type="hidden" name="photoIds" value={photoId} />
            ))}
            <select
              name="sectionId"
              className="h-10 w-full min-w-0 rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50"
              aria-label="Cél címke"
            >
              <option value="__all__">Nincs külön címke</option>
              {sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.title}
                </option>
              ))}
            </select>
            <FormSubmitButton variant="secondary" className="h-10 px-3" pendingLabel="Áthelyezés...">
              <FolderInput size={15} />
              Áthelyezés
            </FormSubmitButton>
          </form>
          <div className="flex flex-wrap gap-2 lg:flex-nowrap lg:justify-end">
            <button
              type="button"
              onClick={clearBulkSelection}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-ink/12 bg-white px-3 text-sm font-medium text-graphite transition hover:bg-ink/5"
            >
              <Undo2 size={15} />
              Mégse
            </button>
            <form action={deleteSelectedPhotosAction.bind(null, galleryId)}>
              {[...bulkSelectedPhotoIds].map((photoId) => (
                <input key={photoId} type="hidden" name="photoIds" value={photoId} />
              ))}
              <ConfirmSubmitButton
                message={`Biztosan törlöd a kijelölt ${bulkSelectedCount} képet? A feltöltött fájlok is törlődnek.`}
                variant="danger"
                className="h-10 shrink-0 whitespace-nowrap px-4"
              >
                <Trash2 size={16} />
                Kijelöltek törlése
              </ConfirmSubmitButton>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
