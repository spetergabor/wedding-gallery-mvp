"use client";

import Image from "next/image";
import { AlignCenter, AlignLeft, AlignRight, Maximize2, MousePointer2, Move, PanelLeft, PanelRight, RotateCcw, Save, Trash2, Type } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type DragEvent, type PointerEvent } from "react";
import { FormSubmitButton } from "@/components/form-submit-button";
import { saveAlbumDesignSpreadSlotDraftAction } from "@/lib/album-design-actions";
import { ALBUM_SPREAD_BACKGROUND, getAlbumLayoutPreviewSlotInsetPx, getAlbumLayoutTemplate } from "@/lib/album-design-templates";

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

type SlotFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type SpreadTextItem = {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontFamily: string;
  fontSize: number;
  color: string;
  textAlign: string;
  sortOrder: number;
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

type TextDragState = {
  id: string;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
  width: number;
  height: number;
};

type SlotFrameDragState = {
  slotIndex: number;
  mode: "move" | "resize";
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
  canvasWidth: number;
  canvasHeight: number;
};

const ALBUM_TEXT_FONT_STACKS: Record<string, string> = {
  playfair: '"Playfair Display", Georgia, serif',
  cormorant: '"Cormorant Garamond", Georgia, serif',
  lora: '"Lora", Georgia, serif',
  montserrat: '"Montserrat", Arial, sans-serif'
};

const ALBUM_TEXT_FONT_OPTIONS = [
  { value: "playfair", label: "Playfair" },
  { value: "cormorant", label: "Cormorant" },
  { value: "lora", label: "Lora" },
  { value: "montserrat", label: "Montserrat" }
];
const SLOT_VERTICAL_BARRIERS = [25, 50, 75];
const SLOT_HORIZONTAL_BARRIERS = [50];
const SLOT_BARRIER_RELEASE_PERCENT = 4;
const SLOT_BARRIER_EPSILON = 0.001;
const MIN_SLOT_FRAME_SIZE_PERCENT = 3;

function clampCropPosition(value: number) {
  if (!Number.isFinite(value)) {
    return 50;
  }

  return Math.min(100, Math.max(0, value));
}

function formatCropPosition(value: number) {
  return clampCropPosition(value).toFixed(2);
}

function stopEdgeAtBarrier(startEdge: number, rawEdge: number, barriers: number[]) {
  const orderedBarriers = rawEdge >= startEdge ? [...barriers].sort((left, right) => left - right) : [...barriers].sort((left, right) => right - left);

  for (const barrier of orderedBarriers) {
    if (Math.abs(startEdge - barrier) <= SLOT_BARRIER_EPSILON) {
      if (rawEdge > barrier && rawEdge - barrier <= SLOT_BARRIER_RELEASE_PERCENT) {
        return barrier;
      }

      if (rawEdge < barrier && barrier - rawEdge <= SLOT_BARRIER_RELEASE_PERCENT) {
        return barrier;
      }
    }

    if (startEdge < barrier && rawEdge >= barrier) {
      return barrier;
    }

    if (startEdge > barrier && rawEdge <= barrier) {
      return barrier;
    }
  }

  return rawEdge;
}

function stopFramePositionAtBarriers(rawPosition: number, startPosition: number, size: number, barriers: number[]) {
  if (rawPosition === startPosition) {
    return rawPosition;
  }

  const direction = rawPosition > startPosition ? 1 : -1;
  const framePoints = [0, size / 2, size];
  const stoppedPositions = framePoints.map((offset) => stopEdgeAtBarrier(startPosition + offset, rawPosition + offset, barriers) - offset);
  const stoppedOnPath = stoppedPositions.filter((position) => (direction > 0 ? position >= startPosition && position <= rawPosition : position <= startPosition && position >= rawPosition));

  if (stoppedOnPath.length === 0) {
    return rawPosition;
  }

  return direction > 0 ? Math.min(...stoppedOnPath) : Math.max(...stoppedOnPath);
}

function stopFrameSizeAtBarriers(rawSize: number, startPosition: number, startSize: number, barriers: number[]) {
  if (rawSize === startSize) {
    return rawSize;
  }

  const direction = rawSize > startSize ? 1 : -1;
  const sizePoints = [
    {
      start: startPosition + startSize / 2,
      raw: startPosition + rawSize / 2,
      toSize: (stoppedPoint: number) => (stoppedPoint - startPosition) * 2
    },
    {
      start: startPosition + startSize,
      raw: startPosition + rawSize,
      toSize: (stoppedPoint: number) => stoppedPoint - startPosition
    }
  ];
  const stoppedSizes = sizePoints.map((point) => point.toSize(stopEdgeAtBarrier(point.start, point.raw, barriers)));
  const stoppedOnPath = stoppedSizes.filter((size) => (direction > 0 ? size >= startSize && size <= rawSize : size <= startSize && size >= rawSize));

  if (stoppedOnPath.length === 0) {
    return rawSize;
  }

  return direction > 0 ? Math.min(...stoppedOnPath) : Math.max(...stoppedOnPath);
}

function getMovedSlotFrame(dragState: SlotFrameDragState, deltaX: number, deltaY: number, width: number, height: number): SlotFrame {
  const rawX = Math.min(100 - width, Math.max(0, dragState.startX + deltaX));
  const rawY = Math.min(100 - height, Math.max(0, dragState.startY + deltaY));
  const blockedX = stopFramePositionAtBarriers(rawX, dragState.startX, width, SLOT_VERTICAL_BARRIERS);
  const blockedY = stopFramePositionAtBarriers(rawY, dragState.startY, height, SLOT_HORIZONTAL_BARRIERS);

  return {
    x: Math.min(100 - width, Math.max(0, blockedX)),
    y: Math.min(100 - height, Math.max(0, blockedY)),
    width,
    height
  };
}

function getResizedSlotFrame(dragState: SlotFrameDragState, deltaX: number, deltaY: number): SlotFrame {
  const rawWidth = Math.min(100 - dragState.startX, Math.max(MIN_SLOT_FRAME_SIZE_PERCENT, dragState.startWidth + deltaX));
  const rawHeight = Math.min(100 - dragState.startY, Math.max(MIN_SLOT_FRAME_SIZE_PERCENT, dragState.startHeight + deltaY));
  const blockedWidth = stopFrameSizeAtBarriers(rawWidth, dragState.startX, dragState.startWidth, SLOT_VERTICAL_BARRIERS);
  const blockedHeight = stopFrameSizeAtBarriers(rawHeight, dragState.startY, dragState.startHeight, SLOT_HORIZONTAL_BARRIERS);

  return {
    x: dragState.startX,
    y: dragState.startY,
    width: Math.min(100 - dragState.startX, Math.max(MIN_SLOT_FRAME_SIZE_PERCENT, blockedWidth)),
    height: Math.min(100 - dragState.startY, Math.max(MIN_SLOT_FRAME_SIZE_PERCENT, blockedHeight))
  };
}

export function AlbumSpreadSlotEditor({
  customerId,
  designId,
  spread,
  draftItems,
  onDraftItemsChange,
  draftSlotFrames = {},
  onDraftSlotFramesChange,
  selectedSlotIndex,
  onSelectedSlotIndexChange,
  onFocusSpread,
  onPhotoDropToSlot,
  textItems = [],
  selectedTextItemId = null,
  onSelectedTextItemIdChange,
  onTextItemsChange,
  onDeleteTextItem,
  hasChanges,
}: {
  customerId: string | null;
  designId: string;
  spread: EditableSpread;
  draftItems: SpreadItem[];
  onDraftItemsChange: (updater: (items: SpreadItem[]) => SpreadItem[]) => void;
  draftSlotFrames?: Record<number, SlotFrame>;
  onDraftSlotFramesChange?: (updater: (frames: Record<number, SlotFrame>) => Record<number, SlotFrame>) => void;
  selectedSlotIndex: number;
  onSelectedSlotIndexChange: (slotIndex: number) => void;
  onFocusSpread?: () => void;
  onPhotoDropToSlot?: (slotIndex: number, photoId: string) => void;
  textItems?: SpreadTextItem[];
  selectedTextItemId?: string | null;
  onSelectedTextItemIdChange?: (textItemId: string | null) => void;
  onTextItemsChange?: (updater: (items: SpreadTextItem[]) => SpreadTextItem[]) => void;
  onDeleteTextItem?: (textItemId: string) => void;
  hasChanges: boolean;
}) {
  const orderedItems = useMemo(() => [...spread.items].sort((left, right) => left.slotIndex - right.slotIndex), [spread.items]);
  const template = getAlbumLayoutTemplate(spread.layoutKey);
  const cropDragStateRef = useRef<CropDragState | null>(null);
  const textDragStateRef = useRef<TextDragState | null>(null);
  const slotFrameDragStateRef = useRef<SlotFrameDragState | null>(null);
  const slotFramePointerMoveHandlerRef = useRef<((event: globalThis.PointerEvent) => void) | null>(null);
  const slotFramePointerUpHandlerRef = useRef<((event: globalThis.PointerEvent) => void) | null>(null);
  const [dragOverSlotIndex, setDragOverSlotIndex] = useState<number | null>(null);
  const selectedItem = draftItems.find((item) => item.slotIndex === selectedSlotIndex) ?? null;
  const slotInset = getAlbumLayoutPreviewSlotInsetPx(spread.layoutKey);

  useEffect(() => {
    if (!template.slots[selectedSlotIndex]) {
      onSelectedSlotIndexChange(0);
    }
  }, [onSelectedSlotIndexChange, selectedSlotIndex, template.slots]);

  useEffect(() => {
    return () => {
      if (slotFramePointerMoveHandlerRef.current) {
        window.removeEventListener("pointermove", slotFramePointerMoveHandlerRef.current);
      }

      if (slotFramePointerUpHandlerRef.current) {
        window.removeEventListener("pointerup", slotFramePointerUpHandlerRef.current);
        window.removeEventListener("pointercancel", slotFramePointerUpHandlerRef.current);
      }
    };
  }, []);

  function selectSlot(slotIndex: number) {
    onFocusSpread?.();
    onSelectedSlotIndexChange(slotIndex);
  }

  function getSlotFrame(slotIndex: number, item?: SpreadItem | null): SlotFrame {
    const templateSlot = template.slots[slotIndex] ?? { x: 0, y: 0, width: 100, height: 100 };

    return draftSlotFrames[slotIndex] ?? item ?? templateSlot;
  }

  function beginCropDrag(event: PointerEvent<HTMLElement>, item: SpreadItem) {
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

  function updateCropDrag(event: PointerEvent<HTMLElement>) {
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

  function endCropDrag(event: PointerEvent<HTMLElement>) {
    cropDragStateRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function selectTextItem(textItemId: string) {
    onFocusSpread?.();
    onSelectedTextItemIdChange?.(textItemId);
  }

  function updateTextItem(textItemId: string, patch: Partial<SpreadTextItem>) {
    onTextItemsChange?.((items) =>
      items.map((item) =>
        item.id === textItemId
          ? {
              ...item,
              ...patch
            }
          : item
      )
    );
  }

  function centerTextItemOnPage(textItemId: string, page: "left" | "right") {
    onTextItemsChange?.((items) =>
      items.map((item) => {
        if (item.id !== textItemId) {
          return item;
        }

        const pageX = page === "left" ? 0 : 50;
        const pageWidth = 50;
        const nextX = pageX + Math.max(0, (pageWidth - item.width) / 2);
        const nextY = Math.max(0, (100 - item.height) / 2);

        return {
          ...item,
          x: Math.min(100 - item.width, Math.max(0, nextX)),
          y: Math.min(100 - item.height, Math.max(0, nextY))
        };
      })
    );
  }

  function applySlotFrameDrag(clientX: number, clientY: number) {
    const dragState = slotFrameDragStateRef.current;

    if (!dragState) {
      return;
    }

    const deltaX = ((clientX - dragState.startClientX) / Math.max(1, dragState.canvasWidth)) * 100;
    const deltaY = ((clientY - dragState.startClientY) / Math.max(1, dragState.canvasHeight)) * 100;

    onDraftItemsChange((items) =>
      items.map((item) => {
        if (item.slotIndex !== dragState.slotIndex) {
          return item;
        }

        if (dragState.mode === "move") {
          const nextFrame = getMovedSlotFrame(dragState, deltaX, deltaY, item.width, item.height);

          return {
            ...item,
            x: nextFrame.x,
            y: nextFrame.y
          };
        }

        const nextFrame = getResizedSlotFrame(dragState, deltaX, deltaY);

        return {
          ...item,
          width: nextFrame.width,
          height: nextFrame.height
        };
      })
    );

    onDraftSlotFramesChange?.((frames) => {
      const currentFrame = frames[dragState.slotIndex] ?? {
        x: dragState.startX,
        y: dragState.startY,
        width: dragState.startWidth,
        height: dragState.startHeight
      };

      if (dragState.mode === "move") {
        const nextFrame = getMovedSlotFrame(dragState, deltaX, deltaY, currentFrame.width, currentFrame.height);

        return {
          ...frames,
          [dragState.slotIndex]: {
            ...currentFrame,
            x: nextFrame.x,
            y: nextFrame.y
          }
        };
      }

      const nextFrame = getResizedSlotFrame(dragState, deltaX, deltaY);

      return {
        ...frames,
        [dragState.slotIndex]: {
          ...currentFrame,
          width: nextFrame.width,
          height: nextFrame.height
        }
      };
    });
  }

  function endSlotFrameDrag() {
    slotFrameDragStateRef.current = null;

    if (slotFramePointerMoveHandlerRef.current) {
      window.removeEventListener("pointermove", slotFramePointerMoveHandlerRef.current);
      slotFramePointerMoveHandlerRef.current = null;
    }

    if (slotFramePointerUpHandlerRef.current) {
      window.removeEventListener("pointerup", slotFramePointerUpHandlerRef.current);
      window.removeEventListener("pointercancel", slotFramePointerUpHandlerRef.current);
      slotFramePointerUpHandlerRef.current = null;
    }
  }

  function beginSlotFrameDrag(event: PointerEvent<HTMLButtonElement>, slotIndex: number, frame: SlotFrame, mode: SlotFrameDragState["mode"]) {
    if (event.button !== 0) {
      return;
    }

    const bounds = event.currentTarget.closest("[data-album-spread-canvas]")?.getBoundingClientRect();

    if (!bounds) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    selectSlot(slotIndex);
    endSlotFrameDrag();
    slotFrameDragStateRef.current = {
      slotIndex,
      mode,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: frame.x,
      startY: frame.y,
      startWidth: frame.width,
      startHeight: frame.height,
      canvasWidth: bounds.width,
      canvasHeight: bounds.height
    };

    const handleMove = (nativeEvent: globalThis.PointerEvent) => {
      nativeEvent.preventDefault();
      applySlotFrameDrag(nativeEvent.clientX, nativeEvent.clientY);
    };
    const handleEnd = () => endSlotFrameDrag();

    slotFramePointerMoveHandlerRef.current = handleMove;
    slotFramePointerUpHandlerRef.current = handleEnd;
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleEnd);
    window.addEventListener("pointercancel", handleEnd);
  }

  function beginTextDrag(event: PointerEvent<HTMLButtonElement>, item: SpreadTextItem) {
    if (event.button !== 0 || !onTextItemsChange) {
      return;
    }

    const bounds = event.currentTarget.closest("[data-album-spread-canvas]")?.getBoundingClientRect();

    if (!bounds) {
      return;
    }

    selectTextItem(item.id);
    textDragStateRef.current = {
      id: item.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: item.x,
      startY: item.y,
      width: bounds.width,
      height: bounds.height
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function updateTextDrag(event: PointerEvent<HTMLButtonElement>) {
    const dragState = textDragStateRef.current;

    if (!dragState || !onTextItemsChange) {
      return;
    }

    event.preventDefault();
    const deltaX = ((event.clientX - dragState.startClientX) / Math.max(1, dragState.width)) * 100;
    const deltaY = ((event.clientY - dragState.startClientY) / Math.max(1, dragState.height)) * 100;

    onTextItemsChange((items) =>
      items.map((item) =>
        item.id === dragState.id
          ? {
              ...item,
              x: Math.min(100 - item.width, Math.max(0, dragState.startX + deltaX)),
              y: Math.min(100 - item.height, Math.max(0, dragState.startY + deltaY))
            }
          : item
      )
    );
  }

  function endTextDrag(event: PointerEvent<HTMLButtonElement>) {
    textDragStateRef.current = null;

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

  function getDraggedPhotoId(event: DragEvent<HTMLElement>) {
    return event.dataTransfer.getData("application/x-spetly-album-photo-id") || event.dataTransfer.getData("text/plain");
  }

  function hasDraggedAlbumPhoto(event: DragEvent<HTMLElement>) {
    return Array.from(event.dataTransfer.types).includes("application/x-spetly-album-photo-id");
  }

  function handleSlotDragOver(event: DragEvent<HTMLElement>, slotIndex: number) {
    if (!onPhotoDropToSlot || !hasDraggedAlbumPhoto(event)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";

    if (dragOverSlotIndex !== slotIndex) {
      setDragOverSlotIndex(slotIndex);
    }

    if (selectedSlotIndex !== slotIndex) {
      selectSlot(slotIndex);
    } else {
      onFocusSpread?.();
    }
  }

  function handleSlotDragLeave(event: DragEvent<HTMLElement>, slotIndex: number) {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }

    setDragOverSlotIndex((current) => (current === slotIndex ? null : current));
  }

  function handleSlotDrop(event: DragEvent<HTMLElement>, slotIndex: number) {
    const photoId = getDraggedPhotoId(event);

    if (!onPhotoDropToSlot || !photoId) {
      return;
    }

    event.preventDefault();
    setDragOverSlotIndex(null);
    selectSlot(slotIndex);
    onPhotoDropToSlot(slotIndex, photoId);
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
            {template.slots.map((_, slotIndex) => {
              const isSelected = slotIndex === selectedSlotIndex;
              const hasPhoto = draftItems.some((item) => item.slotIndex === slotIndex);

              return (
                <button
                  key={`slot-button-${spread.id}-${slotIndex}`}
                  type="button"
                  onClick={() => selectSlot(slotIndex)}
                  className={`h-9 rounded-md border px-3 text-sm font-medium transition ${
                    isSelected ? "border-ink bg-ink text-white" : "border-ink/10 bg-white text-graphite hover:border-brass hover:text-ink"
                  }`}
                >
                  Slot {slotIndex + 1}
                  {!hasPhoto ? <span className="ml-1 text-xs opacity-60">üres</span> : null}
                </button>
              );
            })}
          </div>
        </div>
        <div
          data-album-spread-canvas
          className="relative aspect-[2/1] overflow-hidden rounded-md border border-ink/10 bg-white"
          style={{ backgroundColor: ALBUM_SPREAD_BACKGROUND }}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 left-1/2 top-0 z-20 w-px -translate-x-1/2 bg-ink/35"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 left-1/4 top-0 z-20 w-px -translate-x-1/2 bg-ink/15"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-0 left-3/4 top-0 z-20 w-px -translate-x-1/2 bg-ink/15"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-0 right-0 top-1/2 z-20 h-px -translate-y-1/2 bg-ink/15"
          />
          {template.slots.map((slot, slotIndex) => {
            const item = draftItems.find((draftItem) => draftItem.slotIndex === slotIndex);
            const isSelected = slotIndex === selectedSlotIndex;
            const isDragOver = slotIndex === dragOverSlotIndex;
            const slotFrame = getSlotFrame(slotIndex, item);

            if (!item) {
              return (
                <div
                  key={`empty-slot-${spread.id}-${slotIndex}`}
                  onClick={() => selectSlot(slotIndex)}
                  onDragOver={(event) => handleSlotDragOver(event, slotIndex)}
                  onDragLeave={(event) => handleSlotDragLeave(event, slotIndex)}
                  onDrop={(event) => handleSlotDrop(event, slotIndex)}
                  className={`absolute overflow-hidden border border-dashed transition ${
                    isDragOver
                      ? "z-20 border-brass bg-brass/15 shadow-[0_0_0_4px_rgba(181,143,77,0.18)]"
                      : isSelected
                        ? "z-10 border-ink bg-ink/[0.04] shadow-[0_0_0_3px_rgba(25,25,25,0.12)]"
                        : "border-ink/20 bg-white/65 hover:border-brass"
                  }`}
                  style={{
                    left: `calc(${slotFrame.x}% + ${slotInset}px)`,
                    top: `calc(${slotFrame.y}% + ${slotInset}px)`,
                    width: `calc(${slotFrame.width}% - ${slotInset * 2}px)`,
                    height: `calc(${slotFrame.height}% - ${slotInset * 2}px)`
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`${slotIndex + 1}. üres slot kiválasztása`}
                >
                  <span className={`absolute left-2 top-2 rounded-md px-2 py-1 text-xs font-semibold ${isSelected ? "bg-ink text-white" : "bg-white/90 text-ink"}`}>
                    {slotIndex + 1}
                  </span>
                  <span className="flex h-full items-center justify-center px-3 text-center text-xs font-medium text-graphite/45">
                    Húzz ide képet lentről
                  </span>
                  {isSelected ? (
                    <>
                      <button
                        type="button"
                        onPointerDown={(event) => beginSlotFrameDrag(event, slotIndex, slotFrame, "move")}
                        className="absolute right-2 top-2 z-30 inline-flex size-7 cursor-grab items-center justify-center rounded-full bg-ink text-white shadow active:cursor-grabbing"
                        title="Képdoboz mozgatása"
                        aria-label="Képdoboz mozgatása"
                      >
                        <Move size={13} />
                      </button>
                      <button
                        type="button"
                        onPointerDown={(event) => beginSlotFrameDrag(event, slotIndex, slotFrame, "resize")}
                        className="absolute bottom-2 right-2 z-30 inline-flex size-7 cursor-nwse-resize items-center justify-center rounded-full bg-white text-ink shadow ring-1 ring-ink/15"
                        title="Képdoboz méretezése"
                        aria-label="Képdoboz méretezése"
                      >
                        <Maximize2 size={13} />
                      </button>
                    </>
                  ) : null}
                </div>
              );
            }

            return (
              <div
                key={item.id}
                  onClick={() => selectSlot(item.slotIndex)}
                  onPointerDown={(event) => beginCropDrag(event, item)}
                  onPointerMove={updateCropDrag}
                  onPointerUp={endCropDrag}
                  onPointerCancel={endCropDrag}
                  onDragOver={(event) => handleSlotDragOver(event, slotIndex)}
                  onDragLeave={(event) => handleSlotDragLeave(event, slotIndex)}
                  onDrop={(event) => handleSlotDrop(event, slotIndex)}
                  className={`absolute overflow-hidden border bg-white transition ${
                  isDragOver
                    ? "z-20 border-brass shadow-[0_0_0_4px_rgba(181,143,77,0.2)]"
                    : isSelected
                      ? "z-10 border-ink shadow-[0_0_0_3px_rgba(25,25,25,0.18)]"
                      : "border-white hover:border-brass"
                } cursor-grab touch-none active:cursor-grabbing`}
                style={{
                  left: `calc(${item.x}% + ${slotInset}px)`,
                  top: `calc(${item.y}% + ${slotInset}px)`,
                  width: `calc(${item.width}% - ${slotInset * 2}px)`,
                  height: `calc(${item.height}% - ${slotInset * 2}px)`,
                  touchAction: "none"
                }}
                role="button"
                tabIndex={0}
                aria-label={`${slotIndex + 1}. slot kiválasztása`}
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
                  {slotIndex + 1}
                </span>
                {isSelected ? (
                  <>
                    <button
                      type="button"
                      onPointerDown={(event) => beginSlotFrameDrag(event, item.slotIndex, slotFrame, "move")}
                      className="absolute right-2 top-2 z-30 inline-flex size-7 cursor-grab items-center justify-center rounded-full bg-ink text-white shadow active:cursor-grabbing"
                      title="Képdoboz mozgatása"
                      aria-label="Képdoboz mozgatása"
                    >
                      <Move size={13} />
                    </button>
                    <button
                      type="button"
                      onPointerDown={(event) => beginSlotFrameDrag(event, item.slotIndex, slotFrame, "resize")}
                      className="absolute bottom-2 right-2 z-30 inline-flex size-7 cursor-nwse-resize items-center justify-center rounded-full bg-white text-ink shadow ring-1 ring-ink/15"
                      title="Képdoboz méretezése"
                      aria-label="Képdoboz méretezése"
                    >
                      <Maximize2 size={13} />
                    </button>
                  </>
                ) : null}
              </div>
            );
          })}
          {textItems.map((item) => {
            const isSelected = selectedTextItemId === item.id;

            return (
              <div
                key={item.id}
                className={`group absolute z-30 touch-none border bg-white/0 transition ${
                  isSelected ? "border-ink shadow-[0_0_0_3px_rgba(25,25,25,0.16)]" : "border-transparent hover:border-brass/80"
                }`}
                style={{
                  left: `${item.x}%`,
                  top: `${item.y}%`,
                  width: `${item.width}%`,
                  height: `${item.height}%`,
                  color: item.color,
                  fontFamily: ALBUM_TEXT_FONT_STACKS[item.fontFamily] ?? ALBUM_TEXT_FONT_STACKS.playfair,
                  fontSize: `${Math.max(0.65, item.fontSize * 0.22)}rem`,
                  lineHeight: 1.05,
                  textAlign: item.textAlign as "left" | "center" | "right",
                  touchAction: "none"
                }}
                onMouseDown={() => selectTextItem(item.id)}
              >
                {isSelected ? (
                  <div
                    className="absolute z-40 flex min-h-10 -translate-x-1/2 items-center gap-1 rounded-md border border-ink/10 bg-white px-2 py-1 shadow-[0_12px_32px_rgba(0,0,0,0.18)]"
                    style={{
                      left: "50%",
                      top: "-48px"
                    }}
                    onMouseDown={(event) => event.stopPropagation()}
                    onPointerDown={(event) => event.stopPropagation()}
                  >
                    <select
                      value={item.fontFamily}
                      onChange={(event) => updateTextItem(item.id, { fontFamily: event.target.value })}
                      className="h-8 rounded border border-ink/10 bg-white px-2 text-xs font-medium text-ink outline-none"
                      aria-label="Betűtípus"
                    >
                      {ALBUM_TEXT_FONT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="1.5"
                      max="18"
                      step="0.5"
                      value={item.fontSize}
                      onChange={(event) => updateTextItem(item.id, { fontSize: Number.parseFloat(event.target.value) || item.fontSize })}
                      className="h-8 w-16 rounded border border-ink/10 bg-white px-2 text-xs font-medium text-ink outline-none"
                      aria-label="Betűméret"
                    />
                    <input
                      type="color"
                      value={item.color}
                      onChange={(event) => updateTextItem(item.id, { color: event.target.value })}
                      className="size-8 rounded border border-ink/10 bg-white p-1"
                      aria-label="Szöveg színe"
                    />
                    <span className="mx-1 h-6 w-px bg-ink/10" aria-hidden="true" />
                    <button
                      type="button"
                      onClick={() => centerTextItemOnPage(item.id, "left")}
                      title="Bal oldal közepére"
                      className="inline-flex size-8 items-center justify-center rounded text-graphite transition hover:bg-ink/5 hover:text-ink"
                    >
                      <PanelLeft size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => centerTextItemOnPage(item.id, "right")}
                      title="Jobb oldal közepére"
                      className="inline-flex size-8 items-center justify-center rounded text-graphite transition hover:bg-ink/5 hover:text-ink"
                    >
                      <PanelRight size={15} />
                    </button>
                    <span className="mx-1 h-6 w-px bg-ink/10" aria-hidden="true" />
                    {[
                      { value: "left", icon: AlignLeft, label: "Balra" },
                      { value: "center", icon: AlignCenter, label: "Középre" },
                      { value: "right", icon: AlignRight, label: "Jobbra" }
                    ].map((option) => {
                      const Icon = option.icon;

                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => updateTextItem(item.id, { textAlign: option.value })}
                          title={option.label}
                          className={`inline-flex size-8 items-center justify-center rounded transition ${
                            item.textAlign === option.value ? "bg-ink text-white" : "text-graphite hover:bg-ink/5 hover:text-ink"
                          }`}
                        >
                          <Icon size={15} />
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => onDeleteTextItem?.(item.id)}
                      className="inline-flex size-8 items-center justify-center rounded text-red-600 transition hover:bg-red-50"
                      title="Szöveg törlése"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ) : null}
                <button
                  type="button"
                  onPointerDown={(event) => beginTextDrag(event, item)}
                  onPointerMove={updateTextDrag}
                  onPointerUp={endTextDrag}
                  onPointerCancel={endTextDrag}
                  className={`absolute -left-2 -top-2 z-30 inline-flex size-6 cursor-grab items-center justify-center rounded-full bg-ink text-white shadow active:cursor-grabbing ${
                    isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                  }`}
                  title="Szöveg mozgatása"
                  aria-label="Szöveg mozgatása"
                >
                  <Type size={12} />
                </button>
                <textarea
                  value={item.text}
                  onFocus={() => selectTextItem(item.id)}
                  onChange={(event) => updateTextItem(item.id, { text: event.target.value })}
                  onPointerDown={(event) => event.stopPropagation()}
                  className="size-full resize-none border-0 bg-transparent p-2 text-inherit outline-none"
                  style={{
                    color: item.color,
                    fontFamily: ALBUM_TEXT_FONT_STACKS[item.fontFamily] ?? ALBUM_TEXT_FONT_STACKS.playfair,
                    fontSize: `${Math.max(0.65, item.fontSize * 0.22)}rem`,
                    lineHeight: 1.05,
                    textAlign: item.textAlign as "left" | "center" | "right"
                  }}
                  aria-label="Album szöveg"
                />
              </div>
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
                  <input type="hidden" name="slotIndexes" value={String(item.slotIndex)} />
                  <input type="hidden" name="slotPhotoIds" value={item.photo.id} />
                  <input type="hidden" name="slotX" value={formatCropPosition(item.x)} />
                  <input type="hidden" name="slotY" value={formatCropPosition(item.y)} />
                  <input type="hidden" name="slotWidth" value={formatCropPosition(item.width)} />
                  <input type="hidden" name="slotHeight" value={formatCropPosition(item.height)} />
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
