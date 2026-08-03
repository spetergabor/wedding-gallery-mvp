"use client";

import Image from "next/image";
import { AlignCenter, AlignLeft, AlignRight, Download, GripVertical, Grid3X3, Images, Maximize2, MousePointer2, Plus, Save, Search, Shuffle, Trash2, Type, UploadCloud, X, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type FormEvent, type WheelEvent } from "react";
import { AlbumSpreadSlotEditor } from "@/components/album-spread-slot-editor";
import { FormSubmitButton } from "@/components/form-submit-button";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { PhotoUploadForm } from "@/components/photo-upload-form";
import {
  createEmptyAlbumDesignSpreadInlineAction,
  deleteAlbumDesignSpreadAction,
  regenerateAlbumDesignSpreadLayoutAction,
  reorderAlbumDesignSpreadsInlineAction,
  saveAlbumDesignSpreadDraftsAction,
  saveAlbumDesignSpreadDraftsInlineAction,
  updateAlbumDesignSpreadLayoutOnlyAction
} from "@/lib/album-design-actions";
import { ALBUM_LAYOUT_TEMPLATES, ALBUM_SPREAD_BACKGROUND, getAlbumLayoutPreviewSlotInsetPx, getAlbumSlotEdgeInsetsPx } from "@/lib/album-design-templates";
import { GALLERY_MODE_ALBUM_SOURCE, PHOTO_DELIVERY_STAGE_FINAL } from "@/lib/proofing";

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

type AlbumSpread = {
  id: string;
  title: string | null;
  layoutKey: string;
  sortOrder: number;
  items: SpreadItem[];
  textItems: SpreadTextItem[];
};

const MIN_WORKBENCH_ZOOM = 0.55;
const MAX_WORKBENCH_ZOOM = 1.8;
const WORKBENCH_ZOOM_STEP = 0.1;
const ALBUM_TEXT_FONT_OPTIONS = [
  { value: "playfair", label: "Playfair" },
  { value: "cormorant", label: "Cormorant" },
  { value: "lora", label: "Lora" },
  { value: "montserrat", label: "Montserrat" }
];

function clampWorkbenchZoom(value: number) {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.min(MAX_WORKBENCH_ZOOM, Math.max(MIN_WORKBENCH_ZOOM, value));
}

function formatWorkbenchZoom(value: number) {
  return `${Math.round(value * 100)}%`;
}

function getTemplate(layoutKey: string) {
  return ALBUM_LAYOUT_TEMPLATES.find((item) => item.key === layoutKey) ?? ALBUM_LAYOUT_TEMPLATES[0];
}

function formatCropPosition(value: number) {
  if (!Number.isFinite(value)) {
    return "50.00";
  }

  return Math.min(100, Math.max(0, value)).toFixed(2);
}

function getOrderedItems(spread: AlbumSpread) {
  return [...spread.items].sort((left, right) => left.slotIndex - right.slotIndex);
}

function getItemSignature(items: SpreadItem[]) {
  return items
    .map((item) =>
      [
        item.photo.id,
        formatCropPosition(item.x),
        formatCropPosition(item.y),
        formatCropPosition(item.width),
        formatCropPosition(item.height),
        formatCropPosition(item.cropX),
        formatCropPosition(item.cropY)
      ].join(":")
    )
    .join("|");
}

function getTextItemSignature(items: SpreadTextItem[]) {
  return items
    .map((item) =>
      [
        item.id,
        item.text,
        formatCropPosition(item.x),
        formatCropPosition(item.y),
        formatCropPosition(item.width),
        formatCropPosition(item.height),
        item.fontFamily,
        formatCropPosition(item.fontSize),
        formatCropPosition(item.lineHeight),
        item.color,
        item.textAlign
      ].join(":")
    )
    .join("|");
}

function createDraftMap(spreads: AlbumSpread[]) {
  return Object.fromEntries(spreads.map((spread) => [spread.id, getOrderedItems(spread)]));
}

function createTextDraftMap(spreads: AlbumSpread[]) {
  return Object.fromEntries(spreads.map((spread) => [spread.id, [...spread.textItems].sort((left, right) => left.sortOrder - right.sortOrder)]));
}

function normalizeSpreadOrder(spreads: AlbumSpread[]) {
  return spreads.map((spread, index) => {
    const sortOrder = index + 1;

    return {
      ...spread,
      sortOrder,
      title: /^Oldalpár \d+$/i.test(spread.title ?? "") ? `Oldalpár ${sortOrder}` : spread.title
    };
  });
}

function formatAlbumTextNumber(value: number) {
  if (!Number.isFinite(value)) {
    return "0.00";
  }

  return value.toFixed(2);
}

function SpreadDraftInputs({ spreadId, items, textItems }: { spreadId: string; items: SpreadItem[]; textItems: SpreadTextItem[] }) {
  return (
    <>
      <input type="hidden" name="draftSpreadIds" value={spreadId} />
      {items.map((item) => (
        <span key={`all-draft-${spreadId}-${item.slotIndex}`}>
          <input type="hidden" name={`spread-${spreadId}-slotIndexes`} value={String(item.slotIndex)} />
          <input type="hidden" name={`spread-${spreadId}-slotPhotoIds`} value={item.photo.id} />
          <input type="hidden" name={`spread-${spreadId}-slotX`} value={formatCropPosition(item.x)} />
          <input type="hidden" name={`spread-${spreadId}-slotY`} value={formatCropPosition(item.y)} />
          <input type="hidden" name={`spread-${spreadId}-slotWidth`} value={formatCropPosition(item.width)} />
          <input type="hidden" name={`spread-${spreadId}-slotHeight`} value={formatCropPosition(item.height)} />
          <input type="hidden" name={`spread-${spreadId}-slotCropX`} value={formatCropPosition(item.cropX)} />
          <input type="hidden" name={`spread-${spreadId}-slotCropY`} value={formatCropPosition(item.cropY)} />
        </span>
      ))}
      {textItems.map((item) => (
        <span key={`all-text-draft-${spreadId}-${item.id}`}>
          <input type="hidden" name={`spread-${spreadId}-textIds`} value={item.id} />
          <input type="hidden" name={`spread-${spreadId}-textValues`} value={item.text} />
          <input type="hidden" name={`spread-${spreadId}-textX`} value={formatAlbumTextNumber(item.x)} />
          <input type="hidden" name={`spread-${spreadId}-textY`} value={formatAlbumTextNumber(item.y)} />
          <input type="hidden" name={`spread-${spreadId}-textWidth`} value={formatAlbumTextNumber(item.width)} />
          <input type="hidden" name={`spread-${spreadId}-textHeight`} value={formatAlbumTextNumber(item.height)} />
          <input type="hidden" name={`spread-${spreadId}-textFont`} value={item.fontFamily} />
          <input type="hidden" name={`spread-${spreadId}-textSize`} value={formatAlbumTextNumber(item.fontSize)} />
          <input type="hidden" name={`spread-${spreadId}-textLineHeight`} value={formatAlbumTextNumber(item.lineHeight)} />
          <input type="hidden" name={`spread-${spreadId}-textColor`} value={item.color} />
          <input type="hidden" name={`spread-${spreadId}-textAlign`} value={item.textAlign} />
        </span>
      ))}
    </>
  );
}

function TemplatePreview({ layoutKey }: { layoutKey: string }) {
  const template = getTemplate(layoutKey);
  const inset = getAlbumLayoutPreviewSlotInsetPx(template.key);

  return (
    <div className="relative aspect-[2/1] overflow-hidden rounded-md border border-ink/10" style={{ backgroundColor: ALBUM_SPREAD_BACKGROUND }}>
      {template.slots.map((slot, index) => {
        const edgeInsets = getAlbumSlotEdgeInsetsPx(slot, inset);

        return (
          <div
            key={`${template.key}-${index}`}
            className="absolute border border-brass/50 bg-brass/15"
            style={{
              left: `calc(${slot.x}% + ${edgeInsets.left}px)`,
              top: `calc(${slot.y}% + ${edgeInsets.top}px)`,
              width: `calc(${slot.width}% - ${edgeInsets.left + edgeInsets.right}px)`,
              height: `calc(${slot.height}% - ${edgeInsets.top + edgeInsets.bottom}px)`
            }}
          />
        );
      })}
    </div>
  );
}

function AlbumLayoutRadioGrid({ defaultLayoutKey, className = "max-h-72 overflow-auto" }: { defaultLayoutKey?: string; className?: string }) {
  const fallbackLayoutKey = defaultLayoutKey ?? ALBUM_LAYOUT_TEMPLATES[1]?.key ?? ALBUM_LAYOUT_TEMPLATES[0].key;

  return (
    <div className={`grid gap-2 pr-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 ${className}`}>
      {ALBUM_LAYOUT_TEMPLATES.map((template) => (
        <label key={template.key} className="group cursor-pointer rounded-md border border-ink/10 bg-white p-2 transition hover:border-brass">
          <input name="layoutKey" value={template.key} type="radio" defaultChecked={template.key === fallbackLayoutKey} className="peer sr-only" />
          <div className="rounded-md border-2 border-transparent transition peer-checked:border-ink">
            <TemplatePreview layoutKey={template.key} />
          </div>
          <span className="mt-2 flex items-start justify-between gap-2 text-xs">
            <span className="font-medium text-ink">{template.name}</span>
            <span className="shrink-0 rounded-full bg-ink/5 px-2 py-0.5 text-graphite">{template.photoCount} kép</span>
          </span>
        </label>
      ))}
    </div>
  );
}

function SidebarSpreadCreateForm({
  isCreating,
  errorMessage,
  onCreateSpread,
  pendingLabel = "Létrehozás..."
}: {
  isCreating: boolean;
  errorMessage: string | null;
  onCreateSpread: () => void;
  pendingLabel?: string;
}) {
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={onCreateSpread}
        disabled={isCreating}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-dashed border-ink/10 bg-white px-3 text-sm font-medium text-ink transition hover:border-ink/30 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Plus size={16} />
        {isCreating ? pendingLabel : "Oldalpár hozzáadása"}
      </button>
      {errorMessage ? <p className="mt-2 text-xs leading-5 text-red-600">{errorMessage}</p> : null}
    </div>
  );
}

export function AlbumDesignWorkbench({
  customerId,
  designId,
  spreads,
  sourcePhotos,
  sourceGalleryId = null,
  canUploadSourceImages = false,
  initialEditorOpen = false,
  initialActiveSpreadId = null
}: {
  customerId: string | null;
  designId: string;
  spreads: AlbumSpread[];
  sourcePhotos: FavoritePhoto[];
  sourceGalleryId?: string | null;
  canUploadSourceImages?: boolean;
  initialEditorOpen?: boolean;
  initialActiveSpreadId?: string | null;
}) {
  const [localSpreads, setLocalSpreads] = useState(spreads);
  const orderedSpreads = useMemo(() => [...localSpreads].sort((left, right) => left.sortOrder - right.sortOrder), [localSpreads]);
  const resolvedInitialActiveSpreadId =
    initialActiveSpreadId && orderedSpreads.some((spread) => spread.id === initialActiveSpreadId)
      ? initialActiveSpreadId
      : orderedSpreads[0]?.id ?? "";
  const [isEditorOpen, setIsEditorOpen] = useState(initialEditorOpen);
  const [draftItemsBySpread, setDraftItemsBySpread] = useState<Record<string, SpreadItem[]>>(() => createDraftMap(spreads));
  const [draftSlotFramesBySpread, setDraftSlotFramesBySpread] = useState<Record<string, Record<number, SlotFrame>>>({});
  const [draftTextItemsBySpread, setDraftTextItemsBySpread] = useState<Record<string, SpreadTextItem[]>>(() => createTextDraftMap(spreads));
  const [activeSpreadId, setActiveSpreadId] = useState(() => resolvedInitialActiveSpreadId);
  const [selectedSlotBySpread, setSelectedSlotBySpread] = useState<Record<string, number>>(() =>
    Object.fromEntries(spreads.map((spread) => [spread.id, getOrderedItems(spread)[0]?.slotIndex ?? 0]))
  );
  const [selectedTextItemIdBySpread, setSelectedTextItemIdBySpread] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(spreads.map((spread) => [spread.id, null]))
  );
  const [photoQuery, setPhotoQuery] = useState("");
  const [showUnusedOnly, setShowUnusedOnly] = useState(false);
  const [isTextToolActive, setIsTextToolActive] = useState(false);
  const [workbenchZoom, setWorkbenchZoom] = useState(1);
  const [layoutModalSpreadId, setLayoutModalSpreadId] = useState<string | null>(null);
  const [isCreateLayoutModalOpen, setIsCreateLayoutModalOpen] = useState(false);
  const [draggedPhotoId, setDraggedPhotoId] = useState<string | null>(null);
  const [draggedSpreadId, setDraggedSpreadId] = useState<string | null>(null);
  const [spreadDropTarget, setSpreadDropTarget] = useState<{ spreadId: string; position: "before" | "after" } | null>(null);
  const [isReorderingSpreads, setIsReorderingSpreads] = useState(false);
  const [spreadOrderError, setSpreadOrderError] = useState<string | null>(null);
  const [createSpreadError, setCreateSpreadError] = useState<string | null>(null);
  const [isCreatingSpread, setIsCreatingSpread] = useState(false);
  const [isSavingBeforeCreate, setIsSavingBeforeCreate] = useState(false);
  const saveAllFormRef = useRef<HTMLFormElement | null>(null);
  const workbenchZoomRef = useRef(workbenchZoom);
  const workbenchScrollRef = useRef<HTMLElement | null>(null);
  const originalSignaturesBySpread = useMemo(
    () => Object.fromEntries(localSpreads.map((spread) => [spread.id, getItemSignature(getOrderedItems(spread))])),
    [localSpreads]
  );
  const originalTextSignaturesBySpread = useMemo(
    () => Object.fromEntries(localSpreads.map((spread) => [spread.id, getTextItemSignature(spread.textItems)])),
    [localSpreads]
  );
  const changedSpreadIds = useMemo(
    () =>
      localSpreads
        .filter((spread) => {
          const photoSignatureChanged = getItemSignature(draftItemsBySpread[spread.id] ?? getOrderedItems(spread)) !== originalSignaturesBySpread[spread.id];
          const textSignatureChanged = getTextItemSignature(draftTextItemsBySpread[spread.id] ?? spread.textItems) !== originalTextSignaturesBySpread[spread.id];

          return photoSignatureChanged || textSignatureChanged;
        })
        .map((spread) => spread.id),
    [draftItemsBySpread, draftTextItemsBySpread, localSpreads, originalSignaturesBySpread, originalTextSignaturesBySpread]
  );
  const usedPhotoIds = useMemo(
    () => [
      ...new Set(
        Object.values(draftItemsBySpread)
          .flat()
          .map((item) => item.photo.id)
      )
    ],
    [draftItemsBySpread]
  );
  const usedPhotoIdSet = useMemo(() => new Set(usedPhotoIds), [usedPhotoIds]);
  const activeSpread = orderedSpreads.find((spread) => spread.id === activeSpreadId) ?? orderedSpreads[0] ?? null;
  const layoutModalSpread = layoutModalSpreadId ? (orderedSpreads.find((spread) => spread.id === layoutModalSpreadId) ?? null) : null;
  const activeDraftItems = activeSpread ? (draftItemsBySpread[activeSpread.id] ?? getOrderedItems(activeSpread)) : [];
  const activeSlotIndex = activeSpread ? (selectedSlotBySpread[activeSpread.id] ?? activeDraftItems[0]?.slotIndex ?? 0) : 0;
  const activeSlotItem = activeDraftItems.find((item) => item.slotIndex === activeSlotIndex) ?? null;
  const activeTextItems = activeSpread ? (draftTextItemsBySpread[activeSpread.id] ?? activeSpread.textItems) : [];
  const activeSelectedTextItemId = activeSpread ? (selectedTextItemIdBySpread[activeSpread.id] ?? null) : null;
  const activeSelectedTextItem = activeTextItems.find((item) => item.id === activeSelectedTextItemId) ?? null;
  const filteredPhotos = useMemo(() => {
    const normalizedQuery = photoQuery.trim().toLowerCase();
    const searchedPhotos = normalizedQuery ? sourcePhotos.filter((photo) => photo.filename.toLowerCase().includes(normalizedQuery)) : sourcePhotos;

    if (!showUnusedOnly) {
      return searchedPhotos;
    }

    return searchedPhotos.filter((photo) => !usedPhotoIdSet.has(photo.id) || photo.id === activeSlotItem?.photo.id);
  }, [activeSlotItem?.photo.id, photoQuery, showUnusedOnly, sourcePhotos, usedPhotoIdSet]);
  const sourceUploadGalleryId = canUploadSourceImages ? sourceGalleryId : null;
  const sourcePhotoLabel = canUploadSourceImages ? "albumkép" : "forráskép";

  useEffect(() => {
    setLocalSpreads(spreads);
  }, [spreads]);

  useEffect(() => {
    setDraftItemsBySpread(createDraftMap(spreads));
    setDraftSlotFramesBySpread({});
  }, [spreads]);

  useEffect(() => {
    setDraftTextItemsBySpread(createTextDraftMap(spreads));
    setSelectedTextItemIdBySpread((current) => {
      const next = { ...current };

      for (const spread of spreads) {
        if (next[spread.id] === undefined) {
          next[spread.id] = null;
        }
      }

      return next;
    });
  }, [spreads]);

  useEffect(() => {
    if (initialEditorOpen) {
      setIsEditorOpen(true);
    }
  }, [initialEditorOpen]);

  useEffect(() => {
    if (!initialActiveSpreadId || !orderedSpreads.some((spread) => spread.id === initialActiveSpreadId)) {
      return;
    }

    setActiveSpreadId(initialActiveSpreadId);
  }, [initialActiveSpreadId, orderedSpreads]);

  useEffect(() => {
    workbenchZoomRef.current = workbenchZoom;
  }, [workbenchZoom]);

  useEffect(() => {
    if (orderedSpreads.length === 0) {
      setActiveSpreadId("");
      return;
    }

    if (!orderedSpreads.some((spread) => spread.id === activeSpreadId)) {
      setActiveSpreadId(orderedSpreads[0].id);
    }

    setSelectedSlotBySpread((current) => {
      const next = { ...current };

      for (const spread of orderedSpreads) {
        const firstSlotIndex = getOrderedItems(spread)[0]?.slotIndex ?? 0;

        if (next[spread.id] === undefined) {
          next[spread.id] = firstSlotIndex;
        }
      }

      return next;
    });
  }, [activeSpreadId, orderedSpreads]);

  useEffect(() => {
    if (!isEditorOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function closeOnEscape(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isEditableTarget = target?.matches("input, textarea, select, [contenteditable='true']") ?? false;

      if (!isEditableTarget && !event.metaKey && !event.ctrlKey && !event.altKey && event.key.toLowerCase() === "t") {
        event.preventDefault();
        setIsTextToolActive(true);
        return;
      }

      if (!isEditableTarget && !event.metaKey && !event.ctrlKey && !event.altKey && event.key.toLowerCase() === "v") {
        event.preventDefault();
        setIsTextToolActive(false);
        return;
      }

      if (!isEditableTarget && (event.key === "Backspace" || event.key === "Delete") && selectedTextItemIdBySpread[activeSpreadId]) {
        event.preventDefault();
        deleteTextItem(activeSpreadId, selectedTextItemIdBySpread[activeSpreadId]!);
        return;
      }

      if (event.key === "Escape") {
        if (isCreateLayoutModalOpen) {
          setIsCreateLayoutModalOpen(false);
          return;
        }

        if (layoutModalSpreadId) {
          setLayoutModalSpreadId(null);
          return;
        }

        if (isTextToolActive) {
          setIsTextToolActive(false);
          return;
        }

        if (selectedTextItemIdBySpread[activeSpreadId]) {
          setSelectedTextItemForSpread(activeSpreadId, null);
          return;
        }

        setIsEditorOpen(false);
      }
    }

    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [activeSpreadId, isCreateLayoutModalOpen, isEditorOpen, isTextToolActive, layoutModalSpreadId, selectedTextItemIdBySpread]);

  useEffect(() => {
    const element = workbenchScrollRef.current;

    if (!element || !isEditorOpen) {
      return;
    }

    let gestureStartZoom = workbenchZoomRef.current;

    function handleGestureStart(event: Event) {
      event.preventDefault();
      gestureStartZoom = workbenchZoomRef.current;
    }

    function handleGestureChange(event: Event) {
      event.preventDefault();
      const gestureEvent = event as Event & { scale?: number };
      const scale = Number.isFinite(gestureEvent.scale) ? gestureEvent.scale ?? 1 : 1;

      setWorkbenchZoom(clampWorkbenchZoom(gestureStartZoom * scale));
    }

    function handleGestureEnd(event: Event) {
      event.preventDefault();
    }

    element.addEventListener("gesturestart", handleGestureStart);
    element.addEventListener("gesturechange", handleGestureChange);
    element.addEventListener("gestureend", handleGestureEnd);

    return () => {
      element.removeEventListener("gesturestart", handleGestureStart);
      element.removeEventListener("gesturechange", handleGestureChange);
      element.removeEventListener("gestureend", handleGestureEnd);
    };
  }, [isEditorOpen]);

  const adjustWorkbenchZoom = useCallback((delta: number) => {
    setWorkbenchZoom((current) => clampWorkbenchZoom(current + delta));
  }, []);

  const resetWorkbenchZoom = useCallback(() => {
    setWorkbenchZoom(1);
  }, []);

  const handleWorkbenchWheel = useCallback((event: WheelEvent<HTMLElement>) => {
    if (!event.ctrlKey && !event.metaKey) {
      return;
    }

    event.preventDefault();
    const direction = event.deltaY > 0 ? -1 : 1;
    const intensity = Math.min(0.18, Math.max(0.035, Math.abs(event.deltaY) / 700));

    setWorkbenchZoom((current) => clampWorkbenchZoom(current + direction * intensity));
  }, []);

  function setActiveSpreadAndSlot(spreadId: string, slotIndex?: number) {
    setActiveSpreadId(spreadId);

    if (slotIndex !== undefined) {
      setSelectedSlotBySpread((current) => ({
        ...current,
        [spreadId]: slotIndex
      }));
    }
  }

  function updateSpreadDropTarget(event: DragEvent<HTMLDivElement>, spreadId: string) {
    if (!draggedSpreadId || draggedSpreadId === spreadId || isReorderingSpreads) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const bounds = event.currentTarget.getBoundingClientRect();
    const position = event.clientY < bounds.top + bounds.height / 2 ? "before" : "after";

    setSpreadDropTarget((current) =>
      current?.spreadId === spreadId && current.position === position ? current : { spreadId, position }
    );
  }

  function reorderSpread(droppedOnSpreadId: string, position: "before" | "after") {
    if (!draggedSpreadId || draggedSpreadId === droppedOnSpreadId || isReorderingSpreads) {
      setDraggedSpreadId(null);
      setSpreadDropTarget(null);
      return;
    }

    const previousSpreads = orderedSpreads;
    const draggedSpread = previousSpreads.find((spread) => spread.id === draggedSpreadId);

    if (!draggedSpread) {
      setDraggedSpreadId(null);
      setSpreadDropTarget(null);
      return;
    }

    const remainingSpreads = previousSpreads.filter((spread) => spread.id !== draggedSpread.id);
    const targetIndex = remainingSpreads.findIndex((spread) => spread.id === droppedOnSpreadId);

    if (targetIndex < 0) {
      setDraggedSpreadId(null);
      setSpreadDropTarget(null);
      return;
    }

    const insertionIndex = position === "after" ? targetIndex + 1 : targetIndex;
    const nextSpreads = normalizeSpreadOrder([
      ...remainingSpreads.slice(0, insertionIndex),
      draggedSpread,
      ...remainingSpreads.slice(insertionIndex)
    ]);

    setLocalSpreads(nextSpreads);
    setDraggedSpreadId(null);
    setSpreadDropTarget(null);
    setSpreadOrderError(null);
    setIsReorderingSpreads(true);

    void (async () => {
      try {
        await reorderAlbumDesignSpreadsInlineAction(customerId, designId, nextSpreads.map((spread) => spread.id));
      } catch (error) {
        console.error("Failed to reorder album spreads", error);
        setLocalSpreads(previousSpreads);
        setSpreadOrderError("Nem sikerült elmenteni az oldalpárok sorrendjét. Próbáld újra.");
      } finally {
        setIsReorderingSpreads(false);
      }
    })();
  }

  function replaceSpreadSlotPhoto(spreadId: string, slotIndex: number, photo: FavoritePhoto) {
    const targetSpread = orderedSpreads.find((spread) => spread.id === spreadId);

    if (!targetSpread) {
      return;
    }

    const layout = getTemplate(targetSpread.layoutKey);
    const slot = draftSlotFramesBySpread[targetSpread.id]?.[slotIndex] ?? layout.slots[slotIndex];

    if (!slot) {
      return;
    }

    setActiveSpreadAndSlot(targetSpread.id, slotIndex);
    setDraftItemsBySpread((current) => ({
      ...current,
      [targetSpread.id]: (() => {
        const currentItems = current[targetSpread.id] ?? getOrderedItems(targetSpread);
        const hasSlotItem = currentItems.some((item) => item.slotIndex === slotIndex);
        const nextItems = hasSlotItem
          ? currentItems.map((item) =>
              item.slotIndex === slotIndex
                ? {
                    ...item,
                    photo,
                    cropX: 50,
                    cropY: 50
                  }
                : item
            )
          : [
              ...currentItems,
              {
                id: `draft-${targetSpread.id}-${slotIndex}`,
                slotIndex,
                x: slot.x,
                y: slot.y,
                width: slot.width,
                height: slot.height,
                cropX: 50,
                cropY: 50,
                photo
              }
            ];

        return nextItems.sort((left, right) => left.slotIndex - right.slotIndex);
      })()
    }));
  }

  function replaceActiveSlotPhoto(photo: FavoritePhoto) {
    if (!activeSpread) {
      return;
    }

    replaceSpreadSlotPhoto(activeSpread.id, activeSlotIndex, photo);
  }

  function replaceSpreadSlotPhotoById(spreadId: string, slotIndex: number, photoId: string) {
    const photo = sourcePhotos.find((sourcePhoto) => sourcePhoto.id === photoId);

    if (!photo) {
      return;
    }

    replaceSpreadSlotPhoto(spreadId, slotIndex, photo);
  }

  function updateSpreadSlotFrames(spreadId: string, updater: (frames: Record<number, SlotFrame>) => Record<number, SlotFrame>) {
    setDraftSlotFramesBySpread((current) => ({
      ...current,
      [spreadId]: updater(current[spreadId] ?? {})
    }));
  }

  function setSelectedTextItemForSpread(spreadId: string, textItemId: string | null) {
    setSelectedTextItemIdBySpread((current) => ({
      ...current,
      [spreadId]: textItemId
    }));
  }

  function updateSpreadTextItems(spreadId: string, updater: (items: SpreadTextItem[]) => SpreadTextItem[]) {
    const targetSpread = orderedSpreads.find((spread) => spread.id === spreadId);

    if (!targetSpread) {
      return;
    }

    setDraftTextItemsBySpread((current) => ({
      ...current,
      [spreadId]: updater(current[spreadId] ?? targetSpread.textItems)
    }));
  }

  function addTextItemToSpread(spreadId: string, position: { x: number; y: number } = { x: 30, y: 42 }) {
    const targetSpread = orderedSpreads.find((spread) => spread.id === spreadId);

    if (!targetSpread) {
      return;
    }

    const textItem: SpreadTextItem = {
      id: `draft-text-${spreadId}-${Date.now()}`,
      text: "",
      x: Math.min(97, Math.max(0, position.x)),
      y: Math.min(88, Math.max(0, position.y)),
      width: Math.max(3, Math.min(40, 100 - position.x)),
      height: 12,
      fontFamily: "playfair",
      fontSize: 7,
      lineHeight: 1.05,
      color: "#191919",
      textAlign: "left",
      sortOrder: (draftTextItemsBySpread[spreadId] ?? targetSpread.textItems).length
    };

    updateSpreadTextItems(spreadId, (items) => [...items, textItem]);
    setActiveSpreadId(spreadId);
    setSelectedTextItemForSpread(spreadId, textItem.id);
  }

  function updateActiveSelectedTextItem(patch: Partial<SpreadTextItem>) {
    if (!activeSpread || !activeSelectedTextItem) {
      return;
    }

    updateSpreadTextItems(activeSpread.id, (items) =>
      items.map((item) => (item.id === activeSelectedTextItem.id ? { ...item, ...patch } : item))
    );
  }

  function deleteTextItem(spreadId: string, textItemId: string) {
    updateSpreadTextItems(spreadId, (items) => items.filter((item) => item.id !== textItemId));
    setSelectedTextItemForSpread(spreadId, null);
  }

  function openCreateSpreadModalWithAutosave() {
    if (isCreatingSpread || isSavingBeforeCreate) {
      return;
    }

    setCreateSpreadError(null);

    if (changedSpreadIds.length === 0) {
      setIsCreateLayoutModalOpen(true);
      return;
    }

    const saveForm = saveAllFormRef.current;

    if (!saveForm) {
      setCreateSpreadError("Nem sikerült elindítani az automatikus mentést. Próbáld újra.");
      return;
    }

    const spreadIdsToSave = [...changedSpreadIds];
    const savedDrafts = new Map(
      spreadIdsToSave.map((spreadId) => [
        spreadId,
        {
          items: [...(draftItemsBySpread[spreadId] ?? [])],
          textItems: [...(draftTextItemsBySpread[spreadId] ?? [])]
        }
      ])
    );
    const formData = new FormData(saveForm);

    setIsSavingBeforeCreate(true);
    void (async () => {
      try {
        await saveAlbumDesignSpreadDraftsInlineAction(customerId, designId, formData);
        setLocalSpreads((current) =>
          current.map((spread) => {
            const savedDraft = savedDrafts.get(spread.id);

            return savedDraft
              ? {
                  ...spread,
                  items: savedDraft.items,
                  textItems: savedDraft.textItems
                }
              : spread;
          })
        );
        setDraftItemsBySpread((current) => {
          const next = { ...current };

          for (const [spreadId, savedDraft] of savedDrafts) {
            next[spreadId] = savedDraft.items;
          }

          return next;
        });
        setDraftTextItemsBySpread((current) => {
          const next = { ...current };

          for (const [spreadId, savedDraft] of savedDrafts) {
            next[spreadId] = savedDraft.textItems;
          }

          return next;
        });
        setDraftSlotFramesBySpread((current) => {
          const next = { ...current };

          for (const spreadId of spreadIdsToSave) {
            delete next[spreadId];
          }

          return next;
        });
        setIsCreateLayoutModalOpen(true);
      } catch (error) {
        console.error("Failed to autosave album spreads before creating a spread", error);
        setCreateSpreadError("Nem sikerült az automatikus mentés. Az oldalpár hozzáadása előtt próbáld újra.");
      } finally {
        setIsSavingBeforeCreate(false);
      }
    })();
  }

  const createInlineSpread = useCallback((layoutKey: string) => {
    if (isCreatingSpread) {
      return;
    }

    setCreateSpreadError(null);
    setIsCreatingSpread(true);
    void (async () => {
      try {
        const spread = await createEmptyAlbumDesignSpreadInlineAction(customerId, designId, layoutKey);

        setLocalSpreads((current) => [...current.filter((item) => item.id !== spread.id), spread]);
        setDraftItemsBySpread((current) => ({
          ...current,
          [spread.id]: []
        }));
        setDraftTextItemsBySpread((current) => ({
          ...current,
          [spread.id]: []
        }));
        setSelectedSlotBySpread((current) => ({
          ...current,
          [spread.id]: 0
        }));
        setSelectedTextItemIdBySpread((current) => ({
          ...current,
          [spread.id]: null
        }));
        setActiveSpreadId(spread.id);
        setIsCreateLayoutModalOpen(false);
        setLayoutModalSpreadId(null);
      } catch (error) {
        console.error("Failed to create inline album spread", error);
        setCreateSpreadError("Nem sikerült létrehozni az oldalpárt. Próbáld újra.");
      } finally {
        setIsCreatingSpread(false);
      }
    })();
  }, [customerId, designId, isCreatingSpread]);

  function submitCreateSpread(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const layoutKey = formData.get("layoutKey");

    if (typeof layoutKey !== "string" || !layoutKey) {
      setCreateSpreadError("Válassz layoutot az új oldalpárhoz.");
      return;
    }

    createInlineSpread(layoutKey);
  }

  return (
    <div className="mt-5">
      <div className="rounded-lg border border-ink/10 bg-white p-4">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-graphite/55">Album szerkesztő</p>
            <h4 className="mt-1 text-lg font-semibold text-ink">Teljes szélességű szerkesztő</h4>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-graphite/70">
              {orderedSpreads.length} oldalpár · {sourcePhotos.length} {sourcePhotoLabel}. Oldalpárt hozzáadni, layoutot cserélni, képet mozgatni és menteni csak a teljes munkanézetben lehet.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setIsEditorOpen(true)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-medium text-white transition hover:bg-graphite"
            >
              <Maximize2 size={16} />
              Szerkesztő megnyitása
            </button>
          </div>
        </div>

        {changedSpreadIds.length > 0 ? (
          <div className="mt-3 rounded-md border border-brass/30 bg-brass/10 px-3 py-2 text-sm text-ink">
            {changedSpreadIds.length} oldalpáron van nem mentett módosítás. Nyisd meg a teljes szerkesztőt a mentéshez.
          </div>
        ) : null}
      </div>

      {isEditorOpen ? (
        <div className="fixed inset-0 z-[80] bg-ink/50">
          <div className="flex h-[100dvh] w-screen flex-col bg-paper text-ink">
            <header className="shrink-0 border-b border-white/10 bg-graphite px-4 py-3 text-white shadow-soft">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/55">Album szerkesztő</p>
                  <h3 className="mt-1 truncate text-lg font-semibold">Teljes szélességű munkanézet</h3>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm text-white/70">
                  <span>{orderedSpreads.length} oldalpár</span>
                  <span>·</span>
                  <span>{usedPhotoIds.length}/{sourcePhotos.length} kép használva</span>
                  {activeSpread ? (
                    <>
                      <span>·</span>
                      <span>Aktív: {activeSpread.title ?? `Oldalpár ${activeSpread.sortOrder}`} / Slot {activeSlotIndex + 1}</span>
                    </>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <div className="inline-flex h-9 items-center rounded-md border border-white/15 bg-white/10 p-0.5">
                    <button
                      type="button"
                      onClick={() => setIsTextToolActive(false)}
                      className={`inline-flex size-8 items-center justify-center rounded transition ${
                        !isTextToolActive ? "bg-white text-ink" : "text-white hover:bg-white/15"
                      }`}
                      aria-pressed={!isTextToolActive}
                      aria-label="Kijelölés és mozgatás"
                      title="Kijelölés és mozgatás (V)"
                    >
                      <MousePointer2 size={17} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsTextToolActive(true)}
                      className={`inline-flex size-8 items-center justify-center rounded transition ${
                        isTextToolActive ? "bg-white text-ink" : "text-white hover:bg-white/15"
                      }`}
                      aria-pressed={isTextToolActive}
                      aria-label="Szöveg eszköz"
                      title={isTextToolActive ? "Szöveg eszköz aktív – kattints a vászonra" : "Szöveg eszköz (T)"}
                    >
                      <Type size={17} />
                    </button>
                  </div>
                  {activeSelectedTextItem ? (
                    <div className="flex h-9 items-center gap-1 rounded-md border border-white/15 bg-white/10 p-0.5 text-white">
                      <select
                        value={activeSelectedTextItem.fontFamily}
                        onChange={(event) => updateActiveSelectedTextItem({ fontFamily: event.target.value })}
                        className="h-8 w-28 rounded border-0 bg-white px-2 text-xs font-medium text-ink outline-none"
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
                        value={activeSelectedTextItem.fontSize}
                        onChange={(event) => updateActiveSelectedTextItem({ fontSize: Number.parseFloat(event.target.value) || activeSelectedTextItem.fontSize })}
                        className="h-8 w-14 rounded border-0 bg-white px-2 text-xs font-medium text-ink outline-none"
                        title="Betűméret"
                        aria-label="Betűméret"
                      />
                      <input
                        type="number"
                        min="0.8"
                        max="2.5"
                        step="0.05"
                        value={activeSelectedTextItem.lineHeight}
                        onChange={(event) => updateActiveSelectedTextItem({ lineHeight: Number.parseFloat(event.target.value) || activeSelectedTextItem.lineHeight })}
                        className="h-8 w-14 rounded border-0 bg-white px-2 text-xs font-medium text-ink outline-none"
                        title="Sormagasság"
                        aria-label="Sormagasság"
                      />
                      <input
                        type="color"
                        value={activeSelectedTextItem.color}
                        onChange={(event) => updateActiveSelectedTextItem({ color: event.target.value })}
                        className="size-8 rounded border-0 bg-white p-1"
                        title="Szövegszín"
                        aria-label="Szövegszín"
                      />
                      {[
                        { value: "left", icon: AlignLeft, label: "Balra igazítás" },
                        { value: "center", icon: AlignCenter, label: "Középre igazítás" },
                        { value: "right", icon: AlignRight, label: "Jobbra igazítás" }
                      ].map((option) => {
                        const Icon = option.icon;

                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => updateActiveSelectedTextItem({ textAlign: option.value })}
                            className={`inline-flex size-8 items-center justify-center rounded transition ${
                              activeSelectedTextItem.textAlign === option.value ? "bg-white text-ink" : "text-white/75 hover:bg-white/15 hover:text-white"
                            }`}
                            title={option.label}
                            aria-label={option.label}
                          >
                            <Icon size={15} />
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => deleteTextItem(activeSpread!.id, activeSelectedTextItem.id)}
                        className="inline-flex size-8 items-center justify-center rounded text-red-200 transition hover:bg-red-500/20 hover:text-red-100"
                        title="Szöveg törlése"
                        aria-label="Szöveg törlése"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ) : null}
                  <div className="inline-flex h-9 items-center rounded-md border border-white/15 bg-white/10 p-0.5 text-sm font-medium text-white">
                    <button
                      type="button"
                      onClick={() => adjustWorkbenchZoom(-WORKBENCH_ZOOM_STEP)}
                      disabled={workbenchZoom <= MIN_WORKBENCH_ZOOM}
                      className="inline-flex size-8 items-center justify-center rounded transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-35"
                      aria-label="Kicsinyítés"
                    >
                      <ZoomOut size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={resetWorkbenchZoom}
                      className="inline-flex h-8 min-w-12 items-center justify-center rounded px-2 text-xs tabular-nums text-white/85 transition hover:bg-white/15"
                      aria-label="Zoom visszaállítása"
                    >
                      {formatWorkbenchZoom(workbenchZoom)}
                    </button>
                    <button
                      type="button"
                      onClick={() => adjustWorkbenchZoom(WORKBENCH_ZOOM_STEP)}
                      disabled={workbenchZoom >= MAX_WORKBENCH_ZOOM}
                      className="inline-flex size-8 items-center justify-center rounded transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-35"
                      aria-label="Nagyítás"
                    >
                      <ZoomIn size={15} />
                    </button>
                  </div>
                  <form ref={saveAllFormRef} action={saveAlbumDesignSpreadDraftsAction.bind(null, customerId, designId)}>
                    {changedSpreadIds.map((spreadId) => (
                      <SpreadDraftInputs
                        key={spreadId}
                        spreadId={spreadId}
                        items={draftItemsBySpread[spreadId] ?? []}
                        textItems={draftTextItemsBySpread[spreadId] ?? []}
                      />
                    ))}
                    <FormSubmitButton
                      variant="secondary"
                      className="!h-9 !px-3 border-white/20 bg-white text-sm text-ink shadow-none hover:bg-white/90 disabled:bg-white/60"
                      pendingLabel="Minden módosítás mentése..."
                      disabled={changedSpreadIds.length === 0 || isSavingBeforeCreate}
                      title={changedSpreadIds.length > 0 ? `${changedSpreadIds.length} módosított oldalpár mentése` : "Minden módosítás el van mentve"}
                    >
                      <Save size={14} />
                      {changedSpreadIds.length > 0 ? `Mentés (${changedSpreadIds.length})` : "Minden mentve"}
                    </FormSubmitButton>
                  </form>
                  <form method="post" action={`/admin/album-designs/${designId}/export`}>
                    {orderedSpreads.map((spread) => (
                      <SpreadDraftInputs
                        key={`export-${spread.id}`}
                        spreadId={spread.id}
                        items={draftItemsBySpread[spread.id] ?? []}
                        textItems={draftTextItemsBySpread[spread.id] ?? []}
                      />
                    ))}
                    <button
                      type="submit"
                      className="inline-flex size-9 items-center justify-center rounded-md border border-white/15 bg-white/10 text-white transition hover:bg-white/15"
                      aria-label="Összes oldalpár exportálása"
                      title="Összes export"
                    >
                      <Download size={18} />
                    </button>
                  </form>
                  <button
                    type="button"
                    onClick={() => setIsEditorOpen(false)}
                    className="inline-flex size-9 items-center justify-center rounded-md border border-red-300/25 bg-red-500/10 text-red-200 transition hover:border-red-200/50 hover:bg-red-500/20 hover:text-red-100"
                    aria-label="Szerkesztő bezárása"
                    title="Bezárás"
                  >
                    <X size={19} />
                  </button>
                </div>
              </div>
            </header>

            <div className="grid min-h-0 flex-1 bg-[#e8e7e2] lg:grid-cols-[230px_minmax(0,1fr)]">
              <aside className="hidden min-h-0 border-r border-ink/10 bg-white/80 p-3 lg:block">
                <p className="px-2 text-xs font-medium uppercase tracking-[0.16em] text-graphite/55">Oldalpárok</p>
                <div className="mt-3 max-h-[calc(100dvh-270px)] space-y-2 overflow-auto pr-1">
                  {orderedSpreads.map((spread) => {
                    const isActive = spread.id === activeSpread?.id;
                    const template = getTemplate(spread.layoutKey);
                    const showDropBefore = spreadDropTarget?.spreadId === spread.id && spreadDropTarget.position === "before";
                    const showDropAfter = spreadDropTarget?.spreadId === spread.id && spreadDropTarget.position === "after";

                    return (
                      <div
                        key={`spread-nav-${spread.id}`}
                        draggable={!isReorderingSpreads}
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", spread.id);
                          setDraggedSpreadId(spread.id);
                          setSpreadOrderError(null);
                        }}
                        onDragOver={(event) => updateSpreadDropTarget(event, spread.id)}
                        onDrop={(event) => {
                          event.preventDefault();
                          const position = spreadDropTarget?.spreadId === spread.id ? spreadDropTarget.position : "before";
                          reorderSpread(spread.id, position);
                        }}
                        onDragEnd={() => {
                          setDraggedSpreadId(null);
                          setSpreadDropTarget(null);
                        }}
                        className={`relative ${isReorderingSpreads ? "cursor-wait" : "cursor-grab active:cursor-grabbing"}`}
                      >
                        {showDropBefore ? <span className="pointer-events-none absolute -top-[5px] left-1 right-1 z-10 h-0.5 rounded-full bg-brass" /> : null}
                        <button
                          type="button"
                          onClick={() => setActiveSpreadAndSlot(spread.id, selectedSlotBySpread[spread.id] ?? getOrderedItems(spread)[0]?.slotIndex ?? 0)}
                          className={`flex w-full items-center gap-2 rounded-md border px-2 py-2 text-left text-sm transition ${
                            isActive ? "border-ink bg-ink text-white" : "border-ink/10 bg-white text-graphite hover:border-ink/25 hover:text-ink"
                          } ${draggedSpreadId === spread.id ? "opacity-45" : ""}`}
                        >
                          <GripVertical size={16} className={`shrink-0 ${isActive ? "text-white/50" : "text-graphite/35"}`} aria-hidden="true" />
                          <span className="min-w-0">
                            <span className="block font-semibold">{spread.title ?? `Oldalpár ${spread.sortOrder}`}</span>
                            <span className={`mt-1 block text-xs ${isActive ? "text-white/65" : "text-graphite/55"}`}>
                              {template.name} · {spread.items.length} kép
                            </span>
                          </span>
                        </button>
                        {showDropAfter ? <span className="pointer-events-none absolute -bottom-[5px] left-1 right-1 z-10 h-0.5 rounded-full bg-brass" /> : null}
                      </div>
                    );
                  })}
                </div>
                {isReorderingSpreads ? <p className="mt-2 px-2 text-xs text-graphite/55">Sorrend mentése...</p> : null}
                {spreadOrderError ? <p className="mt-2 px-2 text-xs leading-5 text-red-600">{spreadOrderError}</p> : null}
                <SidebarSpreadCreateForm
                  isCreating={isCreatingSpread || isSavingBeforeCreate}
                  errorMessage={createSpreadError}
                  onCreateSpread={openCreateSpreadModalWithAutosave}
                  pendingLabel={isSavingBeforeCreate ? "Automatikus mentés..." : "Létrehozás..."}
                />
              </aside>

              <main
                ref={workbenchScrollRef}
                onWheel={handleWorkbenchWheel}
                className="min-h-0 overflow-auto px-3 py-4 lg:px-5"
              >
                <div
                  className="mx-auto max-w-[1500px] origin-top space-y-4 pb-6 transition-[filter]"
                  style={{ zoom: workbenchZoom } as CSSProperties}
                >
                  {sourceUploadGalleryId ? (
                    <section
                      className={`rounded-lg border bg-white p-4 shadow-sm ${
                        sourcePhotos.length === 0 ? "border-brass/35" : "border-ink/10"
                      }`}
                    >
                      <details open={sourcePhotos.length === 0}>
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-md px-1 py-1 [&::-webkit-details-marker]:hidden">
                          <div className="flex min-w-0 items-start gap-3">
                            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-paper text-ink">
                              <UploadCloud size={17} />
                            </span>
                            <span className="min-w-0">
                              <span className="block text-base font-semibold text-ink">Album képkészlet</span>
                              <span className="mt-1 block text-sm leading-5 text-graphite/65">
                                Tölts fel képeket közvetlenül ehhez az albumtervhez. Nem jön létre külön publikus galéria.
                              </span>
                            </span>
                          </div>
                          <span className="shrink-0 rounded-full bg-ink/5 px-2.5 py-1 text-xs font-medium text-graphite">
                            {sourcePhotos.length} kép
                          </span>
                        </summary>
                        <div className="mt-4 border-t border-ink/10 pt-4">
                          <PhotoUploadForm
                            galleryId={sourceUploadGalleryId}
                            galleryMode={GALLERY_MODE_ALBUM_SOURCE}
                            defaultDeliveryStage={PHOTO_DELIVERY_STAGE_FINAL}
                            deliveryStageMode="fixed"
                            framed={false}
                            title="Képek feltöltése az albumhoz"
                            description="Ezek a képek csak ennek az albumtervnek a képkészletében jelennek meg. Feltöltés után alul, a képsávban választhatók."
                          />
                        </div>
                      </details>
                    </section>
                  ) : null}

                  {orderedSpreads.length === 0 ? (
                    <section className="rounded-lg border border-dashed border-ink/15 bg-white p-8 text-center shadow-sm">
                      <p className="text-lg font-semibold text-ink">Még nincs oldalpár</p>
                      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-graphite/65">
                        {canUploadSourceImages && sourcePhotos.length === 0
                          ? "Tölts fel képeket az Album képkészlet blokkban, vagy válassz layoutot egy új, üres oldalpárhoz."
                          : "Válassz layoutot az új oldalpárhoz, majd töltsd fel képekkel ebben a teljes munkanézetben."}
                      </p>
                      <div className="mx-auto mt-4 max-w-sm lg:hidden">
                        <SidebarSpreadCreateForm
                          isCreating={isCreatingSpread || isSavingBeforeCreate}
                          errorMessage={createSpreadError}
                          onCreateSpread={openCreateSpreadModalWithAutosave}
                          pendingLabel={isSavingBeforeCreate ? "Automatikus mentés..." : "Létrehozás..."}
                        />
                      </div>
                      <p className="mt-4 hidden text-sm text-graphite/60 lg:block">
                        Bal oldalt az Oldalpár hozzáadása gombbal kezdheted.
                      </p>
                    </section>
                  ) : null}

                  {orderedSpreads.map((spread) => {
                    const template = getTemplate(spread.layoutKey);
                    const draftItems = draftItemsBySpread[spread.id] ?? getOrderedItems(spread);
                    const draftTextItems = draftTextItemsBySpread[spread.id] ?? spread.textItems;
                    const hasChanges = changedSpreadIds.includes(spread.id);
                    const isActive = spread.id === activeSpread?.id;
                    const selectedSlotIndex = selectedSlotBySpread[spread.id] ?? draftItems[0]?.slotIndex ?? 0;
                    const selectedTextItemId = selectedTextItemIdBySpread[spread.id] ?? null;

                    return (
                      <section
                        key={spread.id}
                        className={`rounded-lg border bg-white p-4 shadow-sm transition ${
                          isActive ? "border-ink shadow-[0_0_0_3px_rgba(25,25,25,0.08)]" : "border-ink/10"
                        }`}
                        onClick={() => setActiveSpreadId(spread.id)}
                      >
                        <div className="flex flex-col justify-between gap-3 border-b border-ink/10 pb-3 lg:flex-row lg:items-start">
                          <div className="min-w-0">
                            <p className="text-lg font-semibold text-ink">{spread.title ?? `Oldalpár ${spread.sortOrder}`}</p>
                            <p className="mt-0.5 text-xs text-graphite/60">
                              {template.name} · {spread.items.length} kép · {draftTextItems.length} szöveg
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {isActive ? (
                                <span className="inline-flex rounded-full bg-ink px-2.5 py-1 text-xs font-medium text-white">
                                  Aktív oldalpár
                                </span>
                              ) : null}
                              {hasChanges ? (
                                <span className="inline-flex rounded-full bg-brass/10 px-2.5 py-1 text-xs font-medium text-brass">
                                  Nem mentett módosítás
                                </span>
                              ) : null}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <form method="post" action={`/admin/album-design-spreads/${spread.id}/export`}>
                              <SpreadDraftInputs spreadId={spread.id} items={draftItems} textItems={draftTextItems} />
                              <button
                                type="submit"
                                className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-ink/15 bg-white px-3 text-sm font-medium text-ink transition hover:border-ink/30"
                              >
                                <Download size={15} />
                                JPG export
                              </button>
                            </form>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveSpreadId(spread.id);
                                setLayoutModalSpreadId(spread.id);
                              }}
                              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-ink/15 bg-white px-3 text-sm font-medium text-ink transition hover:border-ink/30"
                            >
                              <Grid3X3 size={15} />
                              Layout cseréje
                            </button>
                            <form action={regenerateAlbumDesignSpreadLayoutAction.bind(null, customerId, designId, spread.id)}>
                              <FormSubmitButton
                                variant="secondary"
                                className="h-9 px-3"
                                disabled={spread.items.length === 0}
                                pendingLabel="Újragenerálás..."
                              >
                                <Shuffle size={15} />
                                Újragenerálás
                              </FormSubmitButton>
                            </form>
                            <form action={deleteAlbumDesignSpreadAction.bind(null, customerId, designId, spread.id)}>
                              <ConfirmSubmitButton
                                message="Biztosan törlöd ezt az oldalpárt?"
                                variant="danger"
                                className="h-9 px-3"
                              >
                                <Trash2 size={15} />
                                Törlés
                              </ConfirmSubmitButton>
                            </form>
                          </div>
                        </div>

                        <AlbumSpreadSlotEditor
                          spread={spread}
                          draftItems={draftItems}
                          onDraftItemsChange={(updater) =>
                            setDraftItemsBySpread((current) => ({
                              ...current,
                              [spread.id]: updater(current[spread.id] ?? getOrderedItems(spread))
                            }))
                          }
                          draftSlotFrames={draftSlotFramesBySpread[spread.id] ?? {}}
                          onDraftSlotFramesChange={(updater) => updateSpreadSlotFrames(spread.id, updater)}
                          selectedSlotIndex={selectedSlotIndex}
                          onSelectedSlotIndexChange={(slotIndex) => setActiveSpreadAndSlot(spread.id, slotIndex)}
                          onFocusSpread={() => setActiveSpreadId(spread.id)}
                          onPhotoDropToSlot={(slotIndex, photoId) => replaceSpreadSlotPhotoById(spread.id, slotIndex, photoId)}
                          textItems={draftTextItems}
                          selectedTextItemId={selectedTextItemId}
                          onSelectedTextItemIdChange={(textItemId) => setSelectedTextItemForSpread(spread.id, textItemId)}
                          onTextItemsChange={(updater) => updateSpreadTextItems(spread.id, updater)}
                          isTextToolActive={isTextToolActive}
                          onActivateTextTool={() => setIsTextToolActive(true)}
                          onCreateTextItem={(position) => addTextItemToSpread(spread.id, position)}
                          hasChanges={hasChanges}
                        />
                      </section>
                    );
                  })}
                </div>
              </main>
            </div>

            {isCreateLayoutModalOpen ? (
              <div className="fixed inset-0 z-[95] flex items-center justify-center bg-ink/60 px-4 py-6">
                <div className="flex max-h-[88dvh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-ink/10 bg-white shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
                  <div className="flex flex-col gap-3 border-b border-ink/10 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-[0.16em] text-graphite/55">Új oldalpár</p>
                      <h4 className="mt-1 text-xl font-semibold text-ink">Válassz layoutot</h4>
                      <p className="mt-1 text-sm text-graphite/65">
                        A jóváhagyás után az új oldalpár rögtön ezzel a slotelrendezéssel jelenik meg.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsCreateLayoutModalOpen(false)}
                      className="inline-flex size-10 shrink-0 items-center justify-center rounded-md border border-ink/10 bg-white text-ink transition hover:border-ink/30"
                      aria-label="Layout választó bezárása"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <form onSubmit={submitCreateSpread} className="flex min-h-0 flex-col">
                    <div className="max-h-[62dvh] overflow-auto px-5 py-4">
                      <AlbumLayoutRadioGrid defaultLayoutKey={ALBUM_LAYOUT_TEMPLATES[1]?.key ?? ALBUM_LAYOUT_TEMPLATES[0].key} className="" />
                    </div>
                    <div className="flex flex-col-reverse gap-2 border-t border-ink/10 bg-paper px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                      {createSpreadError ? <p className="text-sm text-red-600">{createSpreadError}</p> : <span />}
                      <div className="flex flex-col-reverse gap-2 sm:flex-row">
                        <button
                          type="button"
                          onClick={() => setIsCreateLayoutModalOpen(false)}
                          disabled={isCreatingSpread}
                          className="inline-flex h-10 items-center justify-center rounded-md border border-ink/10 bg-white px-4 text-sm font-medium text-ink transition hover:border-ink/30 disabled:opacity-50"
                        >
                          Mégse
                        </button>
                        <button
                          type="submit"
                          disabled={isCreatingSpread}
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-medium text-white transition hover:bg-graphite disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Plus size={15} />
                          {isCreatingSpread ? "Létrehozás..." : "Oldalpár létrehozása"}
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            ) : null}

            {layoutModalSpread ? (
              <div className="fixed inset-0 z-[95] flex items-center justify-center bg-ink/60 px-4 py-6">
                <div className="flex max-h-[88dvh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-ink/10 bg-white shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
                  <div className="flex flex-col gap-3 border-b border-ink/10 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-[0.16em] text-graphite/55">Template választás</p>
                      <h4 className="mt-1 text-xl font-semibold text-ink">Layout cseréje</h4>
                      <p className="mt-1 text-sm text-graphite/65">
                        {layoutModalSpread.title ?? `Oldalpár ${layoutModalSpread.sortOrder}`} · a meglévő képek megmaradnak, ameddig az új layout slotjai engedik.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setLayoutModalSpreadId(null)}
                      className="inline-flex size-10 shrink-0 items-center justify-center rounded-md border border-ink/10 bg-white text-ink transition hover:border-ink/30"
                      aria-label="Layout választó bezárása"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <form action={updateAlbumDesignSpreadLayoutOnlyAction.bind(null, customerId, designId, layoutModalSpread.id)} className="flex min-h-0 flex-col">
                    <div className="max-h-[62dvh] overflow-auto px-5 py-4">
                      <AlbumLayoutRadioGrid defaultLayoutKey={layoutModalSpread.layoutKey} className="" />
                    </div>
                    <div className="flex flex-col-reverse gap-2 border-t border-ink/10 bg-paper px-5 py-4 sm:flex-row sm:justify-end">
                      <button
                        type="button"
                        onClick={() => setLayoutModalSpreadId(null)}
                        className="inline-flex h-10 items-center justify-center rounded-md border border-ink/10 bg-white px-4 text-sm font-medium text-ink transition hover:border-ink/30"
                      >
                        Mégse
                      </button>
                      <FormSubmitButton className="h-10 px-4" pendingLabel="Mentés...">
                        <Grid3X3 size={15} />
                        Layout mentése
                      </FormSubmitButton>
                    </div>
                  </form>
                </div>
              </div>
            ) : null}

            <footer className="shrink-0 border-t border-white/10 bg-graphite px-4 py-3 text-white shadow-[0_-8px_24px_rgba(0,0,0,0.16)]">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <Images size={16} />
                    Képek az aktív slothoz
                  </p>
                  <p className="mt-1 text-xs text-white/60">
                    {activeSpread ? `${activeSpread.title ?? `Oldalpár ${activeSpread.sortOrder}`} · Slot ${activeSlotIndex + 1}` : "Nincs aktív oldalpár"}
                    {activeSlotItem ? ` · ${activeSlotItem.photo.filename}` : ""}
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-[minmax(220px,360px)_auto]">
                  <div className="relative">
                    <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                    <input
                      value={photoQuery}
                      onChange={(event) => setPhotoQuery(event.target.value)}
                      placeholder="Keresés fájlnév alapján"
                      className="h-10 w-full rounded-md border border-white/15 bg-white/10 pl-9 pr-3 text-sm text-white outline-none transition placeholder:text-white/45 focus:border-white/40"
                    />
                  </div>
                  <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-white/15 bg-white/10 px-3 text-sm font-medium text-white transition hover:bg-white/15">
                    <input
                      type="checkbox"
                      checked={showUnusedOnly}
                      onChange={(event) => setShowUnusedOnly(event.target.checked)}
                      className="size-4 accent-white"
                    />
                    Csak szabad képek
                  </label>
                </div>
              </div>

              <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
                {filteredPhotos.map((photo) => {
                  const isCurrent = activeSlotItem?.photo.id === photo.id;
                  const isUsed = usedPhotoIdSet.has(photo.id);
                  const trayCardClass = isCurrent
                    ? "border-white bg-white text-ink ring-2 ring-white/45"
                    : isUsed
                      ? "border-red-300/55 bg-red-500/20 text-red-50 hover:border-red-200/80 hover:bg-red-500/30"
                      : "border-emerald-300/55 bg-emerald-500/20 text-emerald-50 hover:border-emerald-200/80 hover:bg-emerald-500/30";
                  const trayStatusClass = isCurrent
                    ? "bg-ink text-white"
                    : isUsed
                      ? "bg-red-100 text-red-700"
                      : "bg-emerald-100 text-emerald-800";

                  return (
                    <button
                      key={`global-tray-${activeSpread?.id ?? "none"}-${activeSlotIndex}-${photo.id}`}
                      type="button"
                      draggable={Boolean(activeSpread)}
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = "copy";
                        event.dataTransfer.setData("application/x-spetly-album-photo-id", photo.id);
                        event.dataTransfer.setData("text/plain", photo.id);
                        setDraggedPhotoId(photo.id);
                      }}
                      onDragEnd={() => setDraggedPhotoId(null)}
                      onClick={() => replaceActiveSlotPhoto(photo)}
                      disabled={!activeSpread}
                      className={`group w-28 shrink-0 overflow-hidden rounded-md border text-left transition ${trayCardClass} ${
                        draggedPhotoId === photo.id ? "scale-[0.98] opacity-70 ring-2 ring-white/50" : ""
                      } cursor-grab active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      <span className="relative block aspect-[4/3] bg-ink/30">
                        <Image
                          src={photo.thumbnailUrl || photo.imageUrl}
                          alt={photo.filename}
                          fill
                          unoptimized
                          sizes="112px"
                          className="object-cover transition group-hover:scale-[1.02]"
                        />
                      </span>
                      <span className="block truncate px-2 py-1.5 text-xs font-medium">{photo.filename}</span>
                      <span className="block px-2 pb-2">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${trayStatusClass}`}>
                          {isCurrent ? "Aktuális" : isUsed ? "Foglalt" : "Szabad"}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {sourcePhotos.length === 0 ? (
                <div className="mt-3 rounded-md border border-white/10 bg-white/10 px-3 py-3 text-sm text-white/70">
                  {canUploadSourceImages
                    ? "Tölts fel képeket fent az Album képkészlet blokkban. Feltöltés után itt jelennek meg az aktív slothoz választható fotók."
                    : "Nincs elérhető forráskép ehhez az albumtervhez."}
                </div>
              ) : null}

              {sourcePhotos.length > 0 && filteredPhotos.length === 0 ? (
                <div className="mt-3 rounded-md border border-white/10 bg-white/10 px-3 py-3 text-sm text-white/70">
                  Nincs találat erre a keresésre.
                </div>
              ) : null}
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  );
}
