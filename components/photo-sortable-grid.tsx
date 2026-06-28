"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Eye, EyeOff, Film, GripVertical, ImageIcon, Star, Trash2, Undo2 } from "lucide-react";
import {
  deletePhotoAction,
  restoreClientHiddenPhotoAction,
  saveGalleryPhotoOrderAction,
  setCoverPhotoAction
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
  selectedPhotoIds
}: {
  activeSearch: string;
  activeSet: PhotoManagerSet;
  coverPhotoId: string | null;
  emptyDescription: string;
  galleryId: string;
  galleryMode: string;
  photos: SortablePhoto[];
  selectedPhotoIds: string[];
}) {
  const [orderedPhotos, setOrderedPhotos] = useState(() => photos);
  const [draggedPhotoId, setDraggedPhotoId] = useState<string | null>(null);
  const proofingGallery = isProofingGallery(galleryMode);
  const selectedSet = useMemo(() => new Set(selectedPhotoIds), [selectedPhotoIds]);
  const normalizedSearch = activeSearch.trim().toLowerCase();
  const hasUnsavedOrder = photosChanged(orderedPhotos, photos);
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

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {displayedPhotos.map((photo) => {
          const currentIndex = orderedPhotos.findIndex((orderedPhoto) => orderedPhoto.id === photo.id);
          const isDragging = draggedPhotoId === photo.id;

          return (
            <div
              key={photo.id}
              draggable
              onDragStart={(event) => {
                setDraggedPhotoId(photo.id);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", photo.id);
              }}
              onDragEnd={() => setDraggedPhotoId(null)}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }}
              onDrop={(event) => {
                event.preventDefault();
                const draggedId = event.dataTransfer.getData("text/plain") || draggedPhotoId;

                if (draggedId) {
                  movePhoto(draggedId, photo.id);
                }

                setDraggedPhotoId(null);
              }}
              className={`overflow-hidden rounded-lg border bg-white transition ${
                isDragging ? "border-brass/60 opacity-60 ring-2 ring-brass/25" : "border-ink/10"
              }`}
            >
              <div className="relative aspect-[4/3] bg-mist">
                {photo.mediaType === "video" ? (
                  <div className="relative h-full w-full bg-ink">
                    <video src={photo.imageUrl} preload="metadata" muted playsInline className="h-full w-full object-cover opacity-85" />
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
                    unoptimized
                    loading="lazy"
                    className="object-cover"
                    sizes="(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
                  />
                )}
                <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-md bg-white/90 px-2.5 py-1 text-xs font-medium text-ink">
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
              <div className="space-y-3 p-3">
                <div>
                  <p className="truncate text-sm font-medium text-ink">{photo.filename}</p>
                  <p className="mt-1 text-xs text-graphite/70">
                    Sorrend: {currentIndex + 1}
                    {proofingGallery ? ` · ${photoDeliveryStageLabel(photo.deliveryStage)}` : ""}
                  </p>
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

                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <form action={setCoverPhotoAction.bind(null, galleryId, photo.id)}>
                    <button
                      disabled={coverPhotoId === photo.id}
                      className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-ink/10 px-3 text-sm text-graphite transition hover:bg-ink/5 disabled:cursor-not-allowed disabled:bg-sage/10 disabled:text-sage"
                    >
                      <Star size={15} />
                      {coverPhotoId === photo.id ? "Borítókép" : "Legyen borító"}
                    </button>
                  </form>
                  <form action={deletePhotoAction.bind(null, photo.id, galleryId)}>
                    <ConfirmSubmitButton
                      title="Fotó törlése"
                      message="Biztosan törlöd ezt a fotót? A feltöltött képfájl is törlődik."
                      variant="danger"
                      className="size-9 px-0"
                    >
                      <Trash2 size={16} />
                    </ConfirmSubmitButton>
                  </form>
                </div>

                {photo.isClientHidden ? (
                  <form action={restoreClientHiddenPhotoAction.bind(null, galleryId, photo.id)}>
                    <button className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-brass/30 bg-brass/10 px-3 text-sm text-brass transition hover:bg-brass/15">
                      <Eye size={15} />
                      Visszatenni publikusba
                    </button>
                  </form>
                ) : null}
              </div>
            </div>
          );
        })}
        {displayedPhotos.length === 0 ? (
          <div className="sm:col-span-2 lg:col-span-3">
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
          className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-3xl flex-col gap-3 rounded-lg border border-brass/25 bg-white/95 p-3 shadow-[0_18px_60px_rgba(17,17,17,0.18)] backdrop-blur md:flex-row md:items-center md:justify-between"
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
    </>
  );
}
