"use client";

import Image from "next/image";
import { ImageIcon, MousePointer2, RotateCcw, Save, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { saveAlbumDesignSpreadSlotDraftAction } from "@/lib/album-design-actions";
import { ALBUM_SPREAD_BACKGROUND, getAlbumLayoutPreviewSlotInsetPx } from "@/lib/album-design-templates";

type FavoritePhoto = {
  id: string;
  filename: string;
  imageUrl: string;
  thumbnailUrl: string;
};

type SpreadItem = {
  id: string;
  slotIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  cropX: number;
  cropY: number;
  photo: FavoritePhoto;
};

type EditableSpread = {
  id: string;
  title: string | null;
  layoutKey: string;
  sortOrder: number;
  items: SpreadItem[];
};

type CropDragState = {
  slotIndex: number;
  startClientX: number;
  startClientY: number;
  startCropX: number;
  startCropY: number;
  width: number;
  height: number;
};

function clampCropPosition(value: number) {
  if (!Number.isFinite(value)) {
    return 50;
  }

  return Math.min(100, Math.max(0, value));
}

function formatCropPosition(value: number) {
  return clampCropPosition(value).toFixed(2);
}

export function AlbumSpreadSlotEditor({
  customerId,
  designId,
  spread,
  photos
}: {
  customerId: string;
  designId: string;
  spread: EditableSpread;
  photos: FavoritePhoto[];
}) {
  const orderedItems = useMemo(() => [...spread.items].sort((left, right) => left.slotIndex - right.slotIndex), [spread.items]);
  const originalItemSignature = useMemo(
    () => orderedItems.map((item) => `${item.photo.id}:${formatCropPosition(item.cropX)}:${formatCropPosition(item.cropY)}`).join("|"),
    [orderedItems]
  );
  const [draftItems, setDraftItems] = useState(orderedItems);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState(orderedItems[0]?.slotIndex ?? 0);
  const [photoQuery, setPhotoQuery] = useState("");
  const cropDragStateRef = useRef<CropDragState | null>(null);
  const selectedItem = draftItems.find((item) => item.slotIndex === selectedSlotIndex) ?? draftItems[0] ?? null;
  const draftItemSignature = draftItems.map((item) => `${item.photo.id}:${formatCropPosition(item.cropX)}:${formatCropPosition(item.cropY)}`).join("|");
  const hasChanges = draftItemSignature !== originalItemSignature;
  const slotInset = getAlbumLayoutPreviewSlotInsetPx(spread.layoutKey);
  const filteredPhotos = useMemo(() => {
    const normalizedQuery = photoQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return photos;
    }

    return photos.filter((photo) => photo.filename.toLowerCase().includes(normalizedQuery));
  }, [photoQuery, photos]);

  useEffect(() => {
    setDraftItems(orderedItems);
    setSelectedSlotIndex(orderedItems[0]?.slotIndex ?? 0);
  }, [orderedItems]);

  function replaceSelectedSlotPhoto(photo: FavoritePhoto) {
    setDraftItems((items) =>
      items.map((item) =>
        item.slotIndex === selectedSlotIndex
          ? {
              ...item,
              photo,
              cropX: 50,
              cropY: 50
            }
          : item
      )
    );
  }

  function beginCropDrag(event: PointerEvent<HTMLButtonElement>, item: SpreadItem) {
    if (event.button !== 0) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    setSelectedSlotIndex(item.slotIndex);
    cropDragStateRef.current = {
      slotIndex: item.slotIndex,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startCropX: clampCropPosition(item.cropX),
      startCropY: clampCropPosition(item.cropY),
      width: bounds.width,
      height: bounds.height
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function updateCropDrag(event: PointerEvent<HTMLButtonElement>) {
    const dragState = cropDragStateRef.current;

    if (!dragState) {
      return;
    }

    event.preventDefault();
    const deltaXPercent = ((event.clientX - dragState.startClientX) / Math.max(1, dragState.width)) * 100;
    const deltaYPercent = ((event.clientY - dragState.startClientY) / Math.max(1, dragState.height)) * 100;
    const cropX = clampCropPosition(dragState.startCropX - deltaXPercent);
    const cropY = clampCropPosition(dragState.startCropY - deltaYPercent);

    setDraftItems((items) =>
      items.map((item) =>
        item.slotIndex === dragState.slotIndex
          ? {
              ...item,
              cropX,
              cropY
            }
          : item
      )
    );
  }

  function endCropDrag(event: PointerEvent<HTMLButtonElement>) {
    cropDragStateRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function resetDraft() {
    setDraftItems(orderedItems);
    setSelectedSlotIndex(orderedItems[0]?.slotIndex ?? 0);
  }

  function centerSelectedSlotCrop() {
    setDraftItems((items) =>
      items.map((item) =>
        item.slotIndex === selectedSlotIndex
          ? {
              ...item,
              cropX: 50,
              cropY: 50
            }
          : item
      )
    );
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="rounded-md border border-ink/10 bg-paper p-3">
        <div className="mb-3 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <p className="flex items-center gap-2 text-sm font-medium text-ink">
            <MousePointer2 size={15} />
            Oldalpár vászon
          </p>
          <div className="flex flex-wrap gap-2">
            {draftItems.map((item) => {
              const isSelected = item.slotIndex === selectedSlotIndex;

              return (
                <button
                  key={`slot-button-${item.id}`}
                  type="button"
                  onClick={() => setSelectedSlotIndex(item.slotIndex)}
                  className={`h-9 rounded-md border px-3 text-sm font-medium transition ${
                    isSelected ? "border-ink bg-ink text-white" : "border-ink/10 bg-white text-graphite hover:border-brass hover:text-ink"
                  }`}
                >
                  Slot {item.slotIndex + 1}
                </button>
              );
            })}
          </div>
        </div>
        <div className="relative aspect-[2/1] overflow-hidden rounded-md border border-ink/10 bg-white" style={{ backgroundColor: ALBUM_SPREAD_BACKGROUND }}>
          {draftItems.map((item) => {
            const isSelected = item.slotIndex === selectedSlotIndex;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedSlotIndex(item.slotIndex)}
                onPointerDown={(event) => beginCropDrag(event, item)}
                onPointerMove={updateCropDrag}
                onPointerUp={endCropDrag}
                onPointerCancel={endCropDrag}
                className={`absolute overflow-hidden border bg-white transition ${
                  isSelected ? "z-10 border-ink shadow-[0_0_0_3px_rgba(25,25,25,0.18)]" : "border-white hover:border-brass"
                } cursor-grab touch-none active:cursor-grabbing`}
                style={{
                  left: `calc(${item.x}% + ${slotInset}px)`,
                  top: `calc(${item.y}% + ${slotInset}px)`,
                  width: `calc(${item.width}% - ${slotInset * 2}px)`,
                  height: `calc(${item.height}% - ${slotInset * 2}px)`,
                  touchAction: "none"
                }}
                aria-label={`${item.slotIndex + 1}. slot kiválasztása`}
              >
                <Image
                  src={item.photo.thumbnailUrl || item.photo.imageUrl}
                  alt={item.photo.filename}
                  fill
                  unoptimized
                  sizes="(min-width: 1280px) 960px, 100vw"
                  className="object-cover"
                  draggable={false}
                  style={{ objectPosition: `${formatCropPosition(item.cropX)}% ${formatCropPosition(item.cropY)}%` }}
                />
                <span className={`absolute left-2 top-2 rounded-md px-2 py-1 text-xs font-semibold ${isSelected ? "bg-ink text-white" : "bg-white/90 text-ink"}`}>
                  {item.slotIndex + 1}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-md border border-ink/10 bg-paper p-3">
        <div className="flex flex-col gap-3 rounded-md bg-white p-3 xl:flex-row xl:items-center xl:justify-between">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-graphite/60">Aktív slot {selectedSlotIndex + 1}</p>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold text-ink">{selectedItem?.photo.filename ?? "Nincs kép"}</p>
            <p className="mt-1 text-xs leading-5 text-graphite/60">
              {hasChanges ? "Nem mentett módosítások vannak. Mentésig csak ebben a nézetben változik." : "Képet húzással pozicionálsz a sloton belül."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={centerSelectedSlotCrop}
              disabled={!selectedItem}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-ink/15 bg-white px-3 text-xs font-medium text-ink transition hover:border-ink/30 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <MousePointer2 size={14} />
              Középre
            </button>
            <button
              type="button"
              onClick={resetDraft}
              disabled={!hasChanges}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-ink/15 bg-white px-3 text-xs font-medium text-ink transition hover:border-ink/30 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <RotateCcw size={14} />
              Vissza
            </button>
            <form action={saveAlbumDesignSpreadSlotDraftAction.bind(null, customerId, designId, spread.id)}>
              {draftItems.map((item) => (
                <span key={`slot-draft-${item.slotIndex}`}>
                  <input type="hidden" name="slotPhotoIds" value={item.photo.id} />
                  <input type="hidden" name="slotCropX" value={formatCropPosition(item.cropX)} />
                  <input type="hidden" name="slotCropY" value={formatCropPosition(item.cropY)} />
                </span>
              ))}
              <button
                type="submit"
                disabled={!hasChanges}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-ink px-3 text-xs font-medium text-white transition hover:bg-graphite disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Save size={14} />
                Mentés
              </button>
            </form>
          </div>
        </div>

        <details className="mt-3 rounded-md border border-ink/10 bg-white">
          <summary className="flex cursor-pointer items-center justify-between gap-3 px-3 py-3 text-sm font-medium text-ink transition hover:bg-paper">
            <span className="inline-flex items-center gap-2">
              <ImageIcon size={15} />
              Képcsere megnyitása
            </span>
            <span className="text-xs font-normal text-graphite/60">{photos.length} kép</span>
          </summary>
          <div className="border-t border-ink/10 p-3">
            <label className="text-xs font-medium uppercase tracking-[0.14em] text-graphite/60" htmlFor={`photo-search-${spread.id}`}>
              Keresés
            </label>
            <div className="relative mt-2">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-graphite/45" />
              <input
                id={`photo-search-${spread.id}`}
                value={photoQuery}
                onChange={(event) => setPhotoQuery(event.target.value)}
                placeholder="Kép keresése fájlnév alapján"
                className="h-10 w-full rounded-md border border-ink/15 bg-white pl-9 pr-3 text-sm text-ink outline-none transition focus:border-ink/45"
              />
            </div>

            <div className="mt-3 grid max-h-80 gap-2 overflow-auto pr-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {filteredPhotos.map((photo) => {
                const isCurrent = selectedItem?.photo.id === photo.id;

                return (
                  <button
                    key={`${spread.id}-slot-${selectedSlotIndex}-${photo.id}`}
                    type="button"
                    onClick={() => replaceSelectedSlotPhoto(photo)}
                    className={`grid w-full grid-cols-[72px_minmax(0,1fr)] items-center gap-3 rounded-md border p-1.5 text-left transition ${
                      isCurrent ? "border-ink bg-ink text-white" : "border-ink/10 bg-paper text-graphite hover:border-brass hover:bg-brass/10"
                    }`}
                  >
                    <span className="relative block aspect-[4/3] overflow-hidden rounded bg-mist">
                      <Image
                        src={photo.thumbnailUrl || photo.imageUrl}
                        alt={photo.filename}
                        fill
                        unoptimized
                        sizes="72px"
                        className="object-cover"
                      />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{photo.filename}</span>
                      <span className={`mt-0.5 block text-xs ${isCurrent ? "text-white/70" : "text-graphite/60"}`}>
                        {isCurrent ? "Ebben a slotban van" : `Slot ${selectedSlotIndex + 1}-be tesz`}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            {photos.length === 0 ? (
              <div className="mt-3 flex items-center gap-2 rounded-md bg-paper px-3 py-3 text-sm text-graphite/70">
                <ImageIcon size={16} className="shrink-0" />
                Nincs elérhető kép ehhez a favorite listához.
              </div>
            ) : null}

            {photos.length > 0 && filteredPhotos.length === 0 ? (
              <div className="mt-3 flex items-center gap-2 rounded-md bg-paper px-3 py-3 text-sm text-graphite/70">
                <ImageIcon size={16} className="shrink-0" />
                Nincs találat erre a keresésre.
              </div>
            ) : null}
          </div>
        </details>
      </div>
    </div>
  );
}
