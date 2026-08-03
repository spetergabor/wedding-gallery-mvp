"use client";

import Image from "next/image";
import { Maximize2, MousePointer2, Move, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type DragEvent, type PointerEvent } from "react";
import { ALBUM_SPREAD_BACKGROUND, getAlbumLayoutPreviewSlotInsetPx, getAlbumLayoutTemplate, getAlbumSlotEdgeInsetsPx } from "@/lib/album-design-templates";

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
  lineHeight: number;
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

type SlotResizeCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

type SlotFrameDragState = {
  slotIndex: number;
  mode: "move" | "resize";
  resizeCorner: SlotResizeCorner;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
  canvasWidth: number;
  canvasHeight: number;
};

type SlotFrameUndoState = {
  slotIndex: number;
  frame: SlotFrame;
};

const ALBUM_TEXT_FONT_STACKS: Record<string, string> = {
  playfair: '"Playfair Display", Georgia, serif',
  cormorant: '"Cormorant Garamond", Georgia, serif',
  lora: '"Lora", Georgia, serif',
  montserrat: '"Montserrat", Arial, sans-serif'
};

const SLOT_VERTICAL_BARRIERS = [25, 50, 75];
const SLOT_HORIZONTAL_BARRIERS = [50];
const SLOT_SPREAD_CENTER_BARRIER_RELEASE_PERCENT = 4;
const SLOT_PAGE_CENTER_BARRIER_RELEASE_PERCENT = 1.6;
const SLOT_BARRIER_EPSILON = 0.001;
const MIN_SLOT_FRAME_SIZE_PERCENT = 3;
const SLOT_RESIZE_HANDLES: Array<{
  corner: SlotResizeCorner;
  className: string;
  label: string;
}> = [
  {
    corner: "top-left",
    className: "-left-2 -top-2 cursor-nwse-resize",
    label: "Bal felső sarok méretezése"
  },
  {
    corner: "top-right",
    className: "-right-2 -top-2 cursor-nesw-resize",
    label: "Jobb felső sarok méretezése"
  },
  {
    corner: "bottom-left",
    className: "-bottom-2 -left-2 cursor-nesw-resize",
    label: "Bal alsó sarok méretezése"
  },
  {
    corner: "bottom-right",
    className: "-bottom-2 -right-2 cursor-nwse-resize",
    label: "Jobb alsó sarok méretezése"
  }
];

function clampTextLineHeight(value: number) {
  if (!Number.isFinite(value)) {
    return 1.05;
  }

  return Math.min(2.5, Math.max(0.8, value));
}

function clampCropPosition(value: number) {
  if (!Number.isFinite(value)) {
    return 50;
  }

  return Math.min(100, Math.max(0, value));
}

function formatCropPosition(value: number) {
  return clampCropPosition(value).toFixed(2);
}

function stopEdgeAtBarrier(startEdge: number, rawEdge: number, barriers: number[], getReleasePercent: (barrier: number) => number) {
  const orderedBarriers = rawEdge >= startEdge ? [...barriers].sort((left, right) => left - right) : [...barriers].sort((left, right) => right - left);

  for (const barrier of orderedBarriers) {
    const releasePercent = getReleasePercent(barrier);

    if (Math.abs(startEdge - barrier) <= SLOT_BARRIER_EPSILON) {
      if (rawEdge > barrier && rawEdge - barrier <= releasePercent) {
        return barrier;
      }

      if (rawEdge < barrier && barrier - rawEdge <= releasePercent) {
        return barrier;
      }
    }

    if (startEdge < barrier && rawEdge >= barrier && rawEdge - barrier <= releasePercent) {
      return barrier;
    }

    if (startEdge > barrier && rawEdge <= barrier && barrier - rawEdge <= releasePercent) {
      return barrier;
    }
  }

  return rawEdge;
}

function stopFramePositionAtBarriers(rawPosition: number, startPosition: number, size: number, barriers: number[], getReleasePercent: (barrier: number) => number) {
  if (rawPosition === startPosition) {
    return rawPosition;
  }

  const direction = rawPosition > startPosition ? 1 : -1;
  const framePoints = [0, size / 2, size];
  const stoppedPositions = framePoints.map((offset) => stopEdgeAtBarrier(startPosition + offset, rawPosition + offset, barriers, getReleasePercent) - offset);
  const stoppedOnPath = stoppedPositions.filter((position) => (direction > 0 ? position >= startPosition && position <= rawPosition : position <= startPosition && position >= rawPosition));

  if (stoppedOnPath.length === 0) {
    return rawPosition;
  }

  return direction > 0 ? Math.min(...stoppedOnPath) : Math.max(...stoppedOnPath);
}

function stopFrameSizeAtBarriers(rawSize: number, startPosition: number, startSize: number, barriers: number[], getReleasePercent: (barrier: number) => number) {
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
  const stoppedSizes = sizePoints.map((point) => point.toSize(stopEdgeAtBarrier(point.start, point.raw, barriers, getReleasePercent)));
  const stoppedOnPath = stoppedSizes.filter((size) => (direction > 0 ? size >= startSize && size <= rawSize : size <= startSize && size >= rawSize));

  if (stoppedOnPath.length === 0) {
    return rawSize;
  }

  return direction > 0 ? Math.min(...stoppedOnPath) : Math.max(...stoppedOnPath);
}

function stopFrameStartResizeAtBarriers(
  rawPosition: number,
  startPosition: number,
  fixedEndPosition: number,
  barriers: number[],
  getReleasePercent: (barrier: number) => number
) {
  if (rawPosition === startPosition) {
    return rawPosition;
  }

  const direction = rawPosition > startPosition ? 1 : -1;
  const startSize = fixedEndPosition - startPosition;
  const rawSize = fixedEndPosition - rawPosition;
  const resizePoints = [
    {
      start: startPosition,
      raw: rawPosition,
      toPosition: (stoppedPoint: number) => stoppedPoint
    },
    {
      start: startPosition + startSize / 2,
      raw: rawPosition + rawSize / 2,
      toPosition: (stoppedPoint: number) => stoppedPoint * 2 - fixedEndPosition
    }
  ];
  const stoppedPositions = resizePoints.map((point) => point.toPosition(stopEdgeAtBarrier(point.start, point.raw, barriers, getReleasePercent)));
  const stoppedOnPath = stoppedPositions.filter((position) => (direction > 0 ? position >= startPosition && position <= rawPosition : position <= startPosition && position >= rawPosition));

  if (stoppedOnPath.length === 0) {
    return rawPosition;
  }

  return direction > 0 ? Math.min(...stoppedOnPath) : Math.max(...stoppedOnPath);
}

function getSlotVerticalBarrierRelease(barrier: number) {
  return barrier === 50 ? SLOT_SPREAD_CENTER_BARRIER_RELEASE_PERCENT : SLOT_PAGE_CENTER_BARRIER_RELEASE_PERCENT;
}

function getSlotPageCenterBarrierRelease() {
  return SLOT_PAGE_CENTER_BARRIER_RELEASE_PERCENT;
}

function getMovedSlotFrame(dragState: SlotFrameDragState, deltaX: number, deltaY: number, width: number, height: number): SlotFrame {
  const rawX = Math.min(100 - width, Math.max(0, dragState.startX + deltaX));
  const rawY = Math.min(100 - height, Math.max(0, dragState.startY + deltaY));
  const blockedX = stopFramePositionAtBarriers(rawX, dragState.startX, width, SLOT_VERTICAL_BARRIERS, getSlotVerticalBarrierRelease);
  const blockedY = stopFramePositionAtBarriers(rawY, dragState.startY, height, SLOT_HORIZONTAL_BARRIERS, getSlotPageCenterBarrierRelease);

  return {
    x: Math.min(100 - width, Math.max(0, blockedX)),
    y: Math.min(100 - height, Math.max(0, blockedY)),
    width,
    height
  };
}

function getResizedSlotAxis(
  startPosition: number,
  startSize: number,
  delta: number,
  edge: "start" | "end",
  barriers: number[],
  getReleasePercent: (barrier: number) => number
) {
  if (edge === "start") {
    const fixedEndPosition = startPosition + startSize;
    const rawPosition = Math.min(fixedEndPosition - MIN_SLOT_FRAME_SIZE_PERCENT, Math.max(0, startPosition + delta));
    const blockedPosition = stopFrameStartResizeAtBarriers(rawPosition, startPosition, fixedEndPosition, barriers, getReleasePercent);
    const position = Math.min(fixedEndPosition - MIN_SLOT_FRAME_SIZE_PERCENT, Math.max(0, blockedPosition));

    return {
      position,
      size: fixedEndPosition - position
    };
  }

  const rawSize = Math.min(100 - startPosition, Math.max(MIN_SLOT_FRAME_SIZE_PERCENT, startSize + delta));
  const blockedSize = stopFrameSizeAtBarriers(rawSize, startPosition, startSize, barriers, getReleasePercent);

  return {
    position: startPosition,
    size: Math.min(100 - startPosition, Math.max(MIN_SLOT_FRAME_SIZE_PERCENT, blockedSize))
  };
}

function stopCenteredFrameSizeAtBarriers(
  rawSize: number,
  centerPosition: number,
  startSize: number,
  barriers: number[],
  getReleasePercent: (barrier: number) => number
) {
  if (rawSize === startSize) {
    return rawSize;
  }

  const direction = rawSize > startSize ? 1 : -1;
  const resizePoints = [
    {
      start: centerPosition - startSize / 2,
      raw: centerPosition - rawSize / 2,
      toSize: (stoppedPoint: number) => (centerPosition - stoppedPoint) * 2
    },
    {
      start: centerPosition + startSize / 2,
      raw: centerPosition + rawSize / 2,
      toSize: (stoppedPoint: number) => (stoppedPoint - centerPosition) * 2
    }
  ];
  const stoppedSizes = resizePoints.map((point) => point.toSize(stopEdgeAtBarrier(point.start, point.raw, barriers, getReleasePercent)));
  const stoppedOnPath = stoppedSizes.filter((size) =>
    direction > 0 ? size >= startSize && size <= rawSize : size <= startSize && size >= rawSize
  );

  if (stoppedOnPath.length === 0) {
    return rawSize;
  }

  return direction > 0 ? Math.min(...stoppedOnPath) : Math.max(...stoppedOnPath);
}

function getCenteredResizedSlotAxis(
  startPosition: number,
  startSize: number,
  delta: number,
  edge: "start" | "end",
  barriers: number[],
  getReleasePercent: (barrier: number) => number
) {
  const centerPosition = startPosition + startSize / 2;
  const maximumSize = Math.min(centerPosition, 100 - centerPosition) * 2;
  const rawSize = Math.min(
    maximumSize,
    Math.max(MIN_SLOT_FRAME_SIZE_PERCENT, startSize + (edge === "start" ? -delta * 2 : delta * 2))
  );
  const blockedSize = stopCenteredFrameSizeAtBarriers(rawSize, centerPosition, startSize, barriers, getReleasePercent);
  const size = Math.min(maximumSize, Math.max(MIN_SLOT_FRAME_SIZE_PERCENT, blockedSize));

  return {
    position: centerPosition - size / 2,
    size
  };
}

function getResizedSlotFrame(dragState: SlotFrameDragState, deltaX: number, deltaY: number, resizeFromCenter = false): SlotFrame {
  const horizontalEdge = dragState.resizeCorner === "top-left" || dragState.resizeCorner === "bottom-left" ? "start" : "end";
  const verticalEdge = dragState.resizeCorner === "top-left" || dragState.resizeCorner === "top-right" ? "start" : "end";
  const resizeAxis = resizeFromCenter ? getCenteredResizedSlotAxis : getResizedSlotAxis;
  const horizontal = resizeAxis(dragState.startX, dragState.startWidth, deltaX, horizontalEdge, SLOT_VERTICAL_BARRIERS, getSlotVerticalBarrierRelease);
  const vertical = resizeAxis(dragState.startY, dragState.startHeight, deltaY, verticalEdge, SLOT_HORIZONTAL_BARRIERS, getSlotPageCenterBarrierRelease);

  return {
    x: horizontal.position,
    y: vertical.position,
    width: horizontal.size,
    height: vertical.size
  };
}

export function AlbumSpreadSlotEditor({
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
  isTextToolActive = false,
  onActivateTextTool,
  onCreateTextItem,
  hasChanges,
}: {
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
  isTextToolActive?: boolean;
  onActivateTextTool?: () => void;
  onCreateTextItem?: (position: { x: number; y: number }) => void;
  hasChanges: boolean;
}) {
  const orderedItems = useMemo(() => [...spread.items].sort((left, right) => left.slotIndex - right.slotIndex), [spread.items]);
  const template = getAlbumLayoutTemplate(spread.layoutKey);
  const cropDragStateRef = useRef<CropDragState | null>(null);
  const textDragStateRef = useRef<TextDragState | null>(null);
  const textAreaRefs = useRef(new Map<string, HTMLTextAreaElement>());
  const slotFrameDragStateRef = useRef<SlotFrameDragState | null>(null);
  const pendingSlotFrameUndoRef = useRef<SlotFrameUndoState | null>(null);
  const slotFrameChangedRef = useRef(false);
  const slotFramePointerMoveHandlerRef = useRef<((event: globalThis.PointerEvent) => void) | null>(null);
  const slotFramePointerUpHandlerRef = useRef<((event: globalThis.PointerEvent) => void) | null>(null);
  const [dragOverSlotIndex, setDragOverSlotIndex] = useState<number | null>(null);
  const [lastSlotFrameUndo, setLastSlotFrameUndo] = useState<SlotFrameUndoState | null>(null);
  const selectedItem = draftItems.find((item) => item.slotIndex === selectedSlotIndex) ?? null;
  const slotInset = getAlbumLayoutPreviewSlotInsetPx(spread.layoutKey);

  useEffect(() => {
    if (!template.slots[selectedSlotIndex]) {
      onSelectedSlotIndexChange(0);
    }
  }, [onSelectedSlotIndexChange, selectedSlotIndex, template.slots]);

  useEffect(() => {
    if (!isTextToolActive || !selectedTextItemId) {
      return;
    }

    const textArea = textAreaRefs.current.get(selectedTextItemId);

    if (!textArea) {
      return;
    }

    textArea.focus();
    textArea.setSelectionRange(textArea.value.length, textArea.value.length);
  }, [isTextToolActive, selectedTextItemId]);

  const selectedTextItem = textItems.find((item) => item.id === selectedTextItemId) ?? null;

  useEffect(() => {
    if (!selectedTextItem) {
      return;
    }

    const frame = window.requestAnimationFrame(() => fitTextItemToContent(selectedTextItem.id));

    return () => window.cancelAnimationFrame(frame);
  }, [selectedTextItem?.color, selectedTextItem?.fontFamily, selectedTextItem?.fontSize, selectedTextItem?.id, selectedTextItem?.lineHeight, selectedTextItem?.text]);

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

  function fitTextItemToContent(textItemId: string) {
    const textArea = textAreaRefs.current.get(textItemId);
    const item = textItems.find((candidate) => candidate.id === textItemId);
    const canvas = textArea?.closest("[data-album-spread-canvas]");

    if (!textArea || !item || !canvas || !onTextItemsChange) {
      return;
    }

    const canvasWidth = Math.max(1, canvas.clientWidth);
    const canvasHeight = Math.max(1, canvas.clientHeight);
    const computedStyle = window.getComputedStyle(textArea);
    const measurementCanvas = document.createElement("canvas");
    const context = measurementCanvas.getContext("2d");

    if (!context) {
      return;
    }

    context.font = `${computedStyle.fontWeight} ${computedStyle.fontSize} ${computedStyle.fontFamily}`;
    const lines = (item.text || " ").replace(/\r\n/g, "\n").split("\n");
    const paddingX = Number.parseFloat(computedStyle.paddingLeft) + Number.parseFloat(computedStyle.paddingRight);
    const paddingY = Number.parseFloat(computedStyle.paddingTop) + Number.parseFloat(computedStyle.paddingBottom);
    const lineHeightPx = Number.parseFloat(computedStyle.lineHeight) || Number.parseFloat(computedStyle.fontSize) * clampTextLineHeight(item.lineHeight);
    const contentWidthPx = Math.max(...lines.map((line) => context.measureText(line || " ").width)) + paddingX + 2;
    const contentHeightPx = Math.max(1, lines.length) * lineHeightPx + paddingY;
    const nextWidth = Math.min(100, Math.max(1, (contentWidthPx / canvasWidth) * 100));
    const nextHeight = Math.min(100, Math.max(1, (contentHeightPx / canvasHeight) * 100));
    const anchorX = item.textAlign === "right" ? item.x + item.width : item.textAlign === "center" ? item.x + item.width / 2 : item.x;
    const nextX = item.textAlign === "right" ? anchorX - nextWidth : item.textAlign === "center" ? anchorX - nextWidth / 2 : item.x;
    const clampedX = Math.min(100 - nextWidth, Math.max(0, nextX));

    if (Math.abs(item.x - clampedX) < 0.01 && Math.abs(item.width - nextWidth) < 0.01 && Math.abs(item.height - nextHeight) < 0.01) {
      return;
    }

    onTextItemsChange((items) =>
      items.map((candidate) =>
        candidate.id === textItemId
          ? {
              ...candidate,
              x: clampedX,
              width: nextWidth,
              height: nextHeight
            }
          : candidate
      )
    );
  }

  function applySlotFrameDrag(clientX: number, clientY: number, resizeFromCenter = false) {
    const dragState = slotFrameDragStateRef.current;

    if (!dragState) {
      return;
    }

    const deltaX = ((clientX - dragState.startClientX) / Math.max(1, dragState.canvasWidth)) * 100;
    const deltaY = ((clientY - dragState.startClientY) / Math.max(1, dragState.canvasHeight)) * 100;
    const nextFrame = getResizedSlotFrame(dragState, deltaX, deltaY, resizeFromCenter);
    const movedFrame = getMovedSlotFrame(dragState, deltaX, deltaY, dragState.startWidth, dragState.startHeight);
    const activeFrame = dragState.mode === "move" ? movedFrame : nextFrame;
    slotFrameChangedRef.current =
      Math.abs(activeFrame.x - dragState.startX) > SLOT_BARRIER_EPSILON ||
      Math.abs(activeFrame.y - dragState.startY) > SLOT_BARRIER_EPSILON ||
      Math.abs(activeFrame.width - dragState.startWidth) > SLOT_BARRIER_EPSILON ||
      Math.abs(activeFrame.height - dragState.startHeight) > SLOT_BARRIER_EPSILON;

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

        return {
          ...item,
          x: nextFrame.x,
          y: nextFrame.y,
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

      const nextFrame = getResizedSlotFrame(dragState, deltaX, deltaY, resizeFromCenter);

      return {
        ...frames,
        [dragState.slotIndex]: {
          ...currentFrame,
          x: nextFrame.x,
          y: nextFrame.y,
          width: nextFrame.width,
          height: nextFrame.height
        }
      };
    });
  }

  function undoLastSlotFrameChange() {
    if (!lastSlotFrameUndo) {
      return;
    }

    const { slotIndex, frame } = lastSlotFrameUndo;
    onDraftItemsChange((items) =>
      items.map((item) =>
        item.slotIndex === slotIndex
          ? {
              ...item,
              x: frame.x,
              y: frame.y,
              width: frame.width,
              height: frame.height
            }
          : item
      )
    );
    onDraftSlotFramesChange?.((frames) => ({
      ...frames,
      [slotIndex]: frame
    }));
    selectSlot(slotIndex);
    setLastSlotFrameUndo(null);
  }

  function endSlotFrameDrag() {
    if (slotFrameChangedRef.current && pendingSlotFrameUndoRef.current) {
      setLastSlotFrameUndo(pendingSlotFrameUndoRef.current);
    }

    slotFrameDragStateRef.current = null;
    pendingSlotFrameUndoRef.current = null;
    slotFrameChangedRef.current = false;

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

  function beginSlotFrameDrag(
    event: PointerEvent<HTMLButtonElement>,
    slotIndex: number,
    frame: SlotFrame,
    mode: SlotFrameDragState["mode"],
    resizeCorner: SlotResizeCorner = "bottom-right"
  ) {
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
    pendingSlotFrameUndoRef.current = {
      slotIndex,
      frame: {
        x: frame.x,
        y: frame.y,
        width: frame.width,
        height: frame.height
      }
    };
    slotFrameDragStateRef.current = {
      slotIndex,
      mode,
      resizeCorner,
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
      applySlotFrameDrag(nativeEvent.clientX, nativeEvent.clientY, nativeEvent.altKey);
    };
    const handleEnd = () => endSlotFrameDrag();

    slotFramePointerMoveHandlerRef.current = handleMove;
    slotFramePointerUpHandlerRef.current = handleEnd;
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleEnd);
    window.addEventListener("pointercancel", handleEnd);
  }

  function beginTextDrag(event: PointerEvent<HTMLElement>, item: SpreadTextItem) {
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

  function updateTextDrag(event: PointerEvent<HTMLElement>) {
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

  function endTextDrag(event: PointerEvent<HTMLElement>) {
    textDragStateRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleCanvasTextPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!isTextToolActive || !onCreateTextItem || (event.target as HTMLElement).closest("[data-album-text-item]")) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / Math.max(1, bounds.width)) * 100;
    const y = ((event.clientY - bounds.top) / Math.max(1, bounds.height)) * 100;
    onCreateTextItem({ x, y });
  }

  function resetDraft() {
    onDraftItemsChange(() => orderedItems);
    onSelectedSlotIndexChange(orderedItems[0]?.slotIndex ?? 0);
    setLastSlotFrameUndo(null);
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

  function renderSlotFrameControls(slotIndex: number, slotFrame: SlotFrame) {
    return (
      <>
        <button
          type="button"
          onPointerDown={(event) => beginSlotFrameDrag(event, slotIndex, slotFrame, "move")}
          className="absolute right-2 top-2 z-40 inline-flex size-7 cursor-grab items-center justify-center rounded-full bg-ink text-white shadow active:cursor-grabbing"
          title="Képdoboz mozgatása"
          aria-label="Képdoboz mozgatása"
        >
          <Move size={13} />
        </button>
        {SLOT_RESIZE_HANDLES.map((handle) => (
          <button
            key={handle.corner}
            type="button"
            onPointerDown={(event) => beginSlotFrameDrag(event, slotIndex, slotFrame, "resize", handle.corner)}
            className={`absolute z-40 inline-flex size-5 items-center justify-center rounded-full bg-white text-ink shadow ring-1 ring-ink/20 transition hover:bg-ink hover:text-white ${handle.className}`}
            title={`${handle.label} · Alt: középpontból méretezés`}
            aria-label={handle.label}
          >
            <Maximize2 size={10} />
          </button>
        ))}
      </>
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
          className={`relative aspect-[2/1] overflow-hidden rounded-md border border-ink/10 bg-white ${isTextToolActive ? "cursor-text" : ""}`}
          style={{ backgroundColor: ALBUM_SPREAD_BACKGROUND, containerType: "inline-size" }}
          onPointerDownCapture={handleCanvasTextPointerDown}
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
            const edgeInsets = getAlbumSlotEdgeInsetsPx(slotFrame, slotInset);

            if (!item) {
              return (
                <div
                  key={`empty-slot-${spread.id}-${slotIndex}`}
                  onClick={() => selectSlot(slotIndex)}
                  onDragOver={(event) => handleSlotDragOver(event, slotIndex)}
                  onDragLeave={(event) => handleSlotDragLeave(event, slotIndex)}
                  onDrop={(event) => handleSlotDrop(event, slotIndex)}
                  className={`absolute border border-dashed transition ${isSelected ? "overflow-visible" : "overflow-hidden"} ${
                    isDragOver
                      ? "z-20 border-brass bg-brass/15 shadow-[0_0_0_4px_rgba(181,143,77,0.18)]"
                      : isSelected
                        ? "z-10 border-ink bg-ink/[0.04] shadow-[0_0_0_3px_rgba(25,25,25,0.12)]"
                        : "border-ink/20 bg-white/65 hover:border-brass"
                  }`}
                  style={{
                    left: `calc(${slotFrame.x}% + ${edgeInsets.left}px)`,
                    top: `calc(${slotFrame.y}% + ${edgeInsets.top}px)`,
                    width: `calc(${slotFrame.width}% - ${edgeInsets.left + edgeInsets.right}px)`,
                    height: `calc(${slotFrame.height}% - ${edgeInsets.top + edgeInsets.bottom}px)`
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
                  {isSelected ? renderSlotFrameControls(slotIndex, slotFrame) : null}
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
                className={`absolute border-0 bg-white transition ${isSelected ? "overflow-visible" : "overflow-hidden"} ${
                  isDragOver
                    ? "z-20 ring-2 ring-inset ring-brass shadow-[0_0_0_4px_rgba(181,143,77,0.2)]"
                    : isSelected
                      ? "z-10 ring-1 ring-inset ring-ink shadow-[0_0_0_3px_rgba(25,25,25,0.18)]"
                      : "hover:ring-1 hover:ring-inset hover:ring-brass"
                } cursor-grab touch-none active:cursor-grabbing`}
                style={{
                  left: `calc(${item.x}% + ${edgeInsets.left}px)`,
                  top: `calc(${item.y}% + ${edgeInsets.top}px)`,
                  width: `calc(${item.width}% - ${edgeInsets.left + edgeInsets.right}px)`,
                  height: `calc(${item.height}% - ${edgeInsets.top + edgeInsets.bottom}px)`,
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
                {isSelected ? renderSlotFrameControls(item.slotIndex, slotFrame) : null}
              </div>
            );
          })}
          {textItems.map((item) => {
            const isSelected = selectedTextItemId === item.id;

            return (
              <div
                key={item.id}
                data-album-text-item
                className={`absolute z-30 touch-none bg-transparent ${isTextToolActive ? "cursor-text" : "cursor-grab active:cursor-grabbing"}`}
                style={{
                  left: `${item.x}%`,
                  top: `${item.y}%`,
                  width: `${item.width}%`,
                  height: `${item.height}%`,
                  color: item.color,
                  fontFamily: ALBUM_TEXT_FONT_STACKS[item.fontFamily] ?? ALBUM_TEXT_FONT_STACKS.playfair,
                  fontSize: `${item.fontSize * 0.2}cqw`,
                  lineHeight: clampTextLineHeight(item.lineHeight),
                  textAlign: item.textAlign as "left" | "center" | "right",
                  touchAction: "none"
                }}
                onPointerDown={(event) => {
                  selectTextItem(item.id);

                  if (!isTextToolActive) {
                    beginTextDrag(event, item);
                  }
                }}
                onPointerMove={(event) => {
                  if (!isTextToolActive) {
                    updateTextDrag(event);
                  }
                }}
                onPointerUp={(event) => {
                  if (!isTextToolActive) {
                    endTextDrag(event);
                  }
                }}
                onPointerCancel={(event) => {
                  if (!isTextToolActive) {
                    endTextDrag(event);
                  }
                }}
                onDoubleClick={() => onActivateTextTool?.()}
              >
                <textarea
                  ref={(element) => {
                    if (element) {
                      textAreaRefs.current.set(item.id, element);
                    } else {
                      textAreaRefs.current.delete(item.id);
                    }
                  }}
                  value={item.text}
                  readOnly={!isTextToolActive}
                  placeholder={isSelected && isTextToolActive ? "Írj ide…" : ""}
                  onFocus={() => selectTextItem(item.id)}
                  onChange={(event) => updateTextItem(item.id, { text: event.target.value })}
                  onPointerDown={(event) => {
                    if (isTextToolActive) {
                      event.stopPropagation();
                    }
                  }}
                  className="size-full resize-none overflow-hidden border-0 bg-transparent p-2 text-inherit outline-none placeholder:text-ink/35"
                  style={{
                    color: item.color,
                    fontFamily: ALBUM_TEXT_FONT_STACKS[item.fontFamily] ?? ALBUM_TEXT_FONT_STACKS.playfair,
                    fontSize: `${item.fontSize * 0.2}cqw`,
                    lineHeight: clampTextLineHeight(item.lineHeight),
                    textAlign: item.textAlign as "left" | "center" | "right",
                    pointerEvents: isTextToolActive ? "auto" : "none"
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
              {hasChanges ? "Nem mentett módosítások vannak. A fejléc Mentés gombja minden oldalpárt egyszerre ment." : "Képet húzással pozicionálsz a sloton belül."}
            </p>
            <p className="mt-1 text-xs leading-5 text-graphite/60">
              <kbd className="rounded border border-ink/15 bg-paper px-1.5 py-0.5 font-mono text-[11px] text-ink">Alt</kbd> + sarokhúzás: méretezés a slot középpontjából.
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
              onClick={undoLastSlotFrameChange}
              disabled={!lastSlotFrameUndo}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-ink/15 bg-white px-3 text-xs font-medium text-ink transition hover:border-ink/30 disabled:cursor-not-allowed disabled:opacity-40"
              title="Utolsó slot mozgatás visszavonása"
            >
              <RotateCcw size={14} />
              Slot vissza
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
          </div>
        </div>

      </div>
    </div>
  );
}
