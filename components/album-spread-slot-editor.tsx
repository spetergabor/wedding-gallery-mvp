"use client";

import Image from "next/image";
import { MousePointer2, RotateCcw, Save } from "lucide-react";
import { useEffect, useMemo, useRef, type PointerEvent } from "react";
import { FormSubmitButton } from "@/components/form-submit-button";
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
  draftItems,
  onDraftItemsChange,
  selectedSlotIndex,
  onSelectedSlotIndexChange,
  onFocusSpread,
  hasChanges,
}: {
  customerId: string | null;
  designId: string;
  spread: EditableSpread;
  draftItems: SpreadItem[];
  onDraftItemsChange: (updater: (items: SpreadItem[]) => SpreadItem[]) => void;
  selectedSlotIndex: number;
  onSelectedSlotIndexChange: (slotIndex: number) => void;
  onFocusSpread?: () => void;
  hasChanges: boolean;
}) {
  const orderedItems = useMemo(() => [...spread.items].sort((left, right) => left.slotIndex - right.slotIndex), [spread.items]);
  const cropDragStateRef = useRef<CropDragState | null>(null);
  const selectedItem = draftItems.find((item) => item.slotIndex === selectedSlotIndex) ?? draftItems[0] ?? null;
  const slotInset = getAlbumLayoutPreviewSlotInsetPx(spread.layoutKey);

  useEffect(() => {
    if (draftItems.length > 0 && !draftItems.some((item) => item.slotIndex === selectedSlotIndex)) {
      onSelectedSlotIndexChange(draftItems[0].slotIndex);
    }
  }, [draftItems, onSelectedSlotIndexChange, selectedSlotIndex]);

  function selectSlot(slotIndex: number) {
    onFocusSpread?.();
    onSelectedSlotIndexChange(slotIndex);
  }

  function beginCropDrag(event: PointerEvent<HTMLButtonElement>, item: SpreadItem) {
    if (event.button !== 0) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    selectSlot(item.slotIndex);
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

    onDraftItemsChange((items) =>
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
    onDraftItemsChange(() => orderedItems);
    onSelectedSlotIndexChange(orderedItems[0]?.slotIndex ?? 0);
  }

  function centerSelectedSlotCrop() {
    onDraftItemsChange((items) =>
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
                  onClick={() => selectSlot(item.slotIndex)}
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
                onClick={() => selectSlot(item.slotIndex)}
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
              <FormSubmitButton
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-ink px-3 text-xs font-medium text-white transition hover:bg-graphite disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!hasChanges}
                pendingLabel="Mentés..."
              >
                <Save size={14} />
                Mentés
              </FormSubmitButton>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
