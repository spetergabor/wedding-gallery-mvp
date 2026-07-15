"use client";

import Image from "next/image";
import { Download, Grid3X3, Images, Maximize2, Plus, Save, Search, Shuffle, Trash2, X, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type WheelEvent } from "react";
import { AlbumSpreadSlotEditor } from "@/components/album-spread-slot-editor";
import { FormSubmitButton } from "@/components/form-submit-button";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import {
  createEmptyAlbumDesignSpreadInlineAction,
  deleteAlbumDesignSpreadAction,
  regenerateAlbumDesignSpreadLayoutAction,
  saveAlbumDesignSpreadDraftsAction,
  updateAlbumDesignSpreadLayoutOnlyAction
} from "@/lib/album-design-actions";
import { ALBUM_LAYOUT_TEMPLATES, ALBUM_SPREAD_BACKGROUND, getAlbumLayoutPreviewSlotInsetPx } from "@/lib/album-design-templates";

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

type AlbumSpread = {
  id: string;
  title: string | null;
  layoutKey: string;
  sortOrder: number;
  items: SpreadItem[];
};

const MIN_WORKBENCH_ZOOM = 0.55;
const MAX_WORKBENCH_ZOOM = 1.8;
const WORKBENCH_ZOOM_STEP = 0.1;

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
  return items.map((item) => `${item.photo.id}:${formatCropPosition(item.cropX)}:${formatCropPosition(item.cropY)}`).join("|");
}

function createDraftMap(spreads: AlbumSpread[]) {
  return Object.fromEntries(spreads.map((spread) => [spread.id, getOrderedItems(spread)]));
}

function SpreadDraftInputs({ spreadId, items }: { spreadId: string; items: SpreadItem[] }) {
  return (
    <>
      <input type="hidden" name="draftSpreadIds" value={spreadId} />
      {items.map((item) => (
        <span key={`all-draft-${spreadId}-${item.slotIndex}`}>
          <input type="hidden" name={`spread-${spreadId}-slotIndexes`} value={String(item.slotIndex)} />
          <input type="hidden" name={`spread-${spreadId}-slotPhotoIds`} value={item.photo.id} />
          <input type="hidden" name={`spread-${spreadId}-slotCropX`} value={formatCropPosition(item.cropX)} />
          <input type="hidden" name={`spread-${spreadId}-slotCropY`} value={formatCropPosition(item.cropY)} />
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
      {template.slots.map((slot, index) => (
        <div
          key={`${template.key}-${index}`}
          className="absolute border border-brass/50 bg-brass/15"
          style={{
            left: `calc(${slot.x}% + ${inset}px)`,
            top: `calc(${slot.y}% + ${inset}px)`,
            width: `calc(${slot.width}% - ${inset * 2}px)`,
            height: `calc(${slot.height}% - ${inset * 2}px)`
          }}
        />
      ))}
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
  onCreateSpread
}: {
  isCreating: boolean;
  errorMessage: string | null;
  onCreateSpread: () => void;
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
        {isCreating ? "Létrehozás..." : "Oldalpár hozzáadása"}
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
  initialEditorOpen = false,
  initialActiveSpreadId = null
}: {
  customerId: string | null;
  designId: string;
  spreads: AlbumSpread[];
  sourcePhotos: FavoritePhoto[];
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
  const [activeSpreadId, setActiveSpreadId] = useState(() => resolvedInitialActiveSpreadId);
  const [selectedSlotBySpread, setSelectedSlotBySpread] = useState<Record<string, number>>(() =>
    Object.fromEntries(spreads.map((spread) => [spread.id, getOrderedItems(spread)[0]?.slotIndex ?? 0]))
  );
  const [photoQuery, setPhotoQuery] = useState("");
  const [showUnusedOnly, setShowUnusedOnly] = useState(false);
  const [workbenchZoom, setWorkbenchZoom] = useState(1);
  const [layoutModalSpreadId, setLayoutModalSpreadId] = useState<string | null>(null);
  const [draggedPhotoId, setDraggedPhotoId] = useState<string | null>(null);
  const [createSpreadError, setCreateSpreadError] = useState<string | null>(null);
  const [isCreatingSpread, setIsCreatingSpread] = useState(false);
  const workbenchZoomRef = useRef(workbenchZoom);
  const workbenchScrollRef = useRef<HTMLElement | null>(null);
  const originalSignaturesBySpread = useMemo(
    () => Object.fromEntries(localSpreads.map((spread) => [spread.id, getItemSignature(getOrderedItems(spread))])),
    [localSpreads]
  );
  const changedSpreadIds = useMemo(
    () =>
      localSpreads
        .filter((spread) => getItemSignature(draftItemsBySpread[spread.id] ?? getOrderedItems(spread)) !== originalSignaturesBySpread[spread.id])
        .map((spread) => spread.id),
    [draftItemsBySpread, localSpreads, originalSignaturesBySpread]
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
  const filteredPhotos = useMemo(() => {
    const normalizedQuery = photoQuery.trim().toLowerCase();
    const searchedPhotos = normalizedQuery ? sourcePhotos.filter((photo) => photo.filename.toLowerCase().includes(normalizedQuery)) : sourcePhotos;

    if (!showUnusedOnly) {
      return searchedPhotos;
    }

    return searchedPhotos.filter((photo) => !usedPhotoIdSet.has(photo.id) || photo.id === activeSlotItem?.photo.id);
  }, [activeSlotItem?.photo.id, photoQuery, showUnusedOnly, sourcePhotos, usedPhotoIdSet]);

  useEffect(() => {
    setLocalSpreads(spreads);
  }, [spreads]);

  useEffect(() => {
    setDraftItemsBySpread(createDraftMap(spreads));
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
      if (event.key === "Escape") {
        if (layoutModalSpreadId) {
          setLayoutModalSpreadId(null);
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
  }, [isEditorOpen, layoutModalSpreadId]);

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

  function replaceSpreadSlotPhoto(spreadId: string, slotIndex: number, photo: FavoritePhoto) {
    const targetSpread = orderedSpreads.find((spread) => spread.id === spreadId);

    if (!targetSpread) {
      return;
    }

    const layout = getTemplate(targetSpread.layoutKey);
    const slot = layout.slots[slotIndex];

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

  const createInlineSpread = useCallback(() => {
    if (isCreatingSpread) {
      return;
    }

    setCreateSpreadError(null);
    setIsCreatingSpread(true);
    void (async () => {
      try {
        const spread = await createEmptyAlbumDesignSpreadInlineAction(customerId, designId);

        setLocalSpreads((current) => [...current.filter((item) => item.id !== spread.id), spread]);
        setDraftItemsBySpread((current) => ({
          ...current,
          [spread.id]: []
        }));
        setSelectedSlotBySpread((current) => ({
          ...current,
          [spread.id]: 0
        }));
        setActiveSpreadId(spread.id);
        setLayoutModalSpreadId(null);
      } catch (error) {
        console.error("Failed to create inline album spread", error);
        setCreateSpreadError("Nem sikerült létrehozni az oldalpárt. Próbáld újra.");
      } finally {
        setIsCreatingSpread(false);
      }
    })();
  }, [customerId, designId, isCreatingSpread]);

  if (orderedSpreads.length === 0) {
    return null;
  }

  return (
    <div className="mt-5">
      <div className="rounded-lg border border-ink/10 bg-white p-4">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-graphite/55">Album szerkesztő</p>
            <h4 className="mt-1 text-lg font-semibold text-ink">Teljes szélességű szerkesztő</h4>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-graphite/70">
              {orderedSpreads.length} oldalpár · {sourcePhotos.length} forráskép. A szerkesztő külön ablakban nyílik, az aktív oldalpárhoz tartozó képcsere pedig egy közös alsó sávból történik.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {changedSpreadIds.length > 0 ? (
              <form action={saveAlbumDesignSpreadDraftsAction.bind(null, customerId, designId)}>
                {changedSpreadIds.map((spreadId) => (
                  <SpreadDraftInputs key={spreadId} spreadId={spreadId} items={draftItemsBySpread[spreadId] ?? []} />
                ))}
                <FormSubmitButton variant="secondary" className="h-10 px-3" pendingLabel="Mentés...">
                  <Save size={15} />
                  Összes mentése
                </FormSubmitButton>
              </form>
            ) : null}
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
            {changedSpreadIds.length} oldalpáron van nem mentett módosítás.
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
                <div className="flex shrink-0 flex-wrap gap-2">
                  <div className="inline-flex h-10 items-center rounded-md border border-white/15 bg-white/10 p-1 text-sm font-medium text-white">
                    <button
                      type="button"
                      onClick={() => adjustWorkbenchZoom(-WORKBENCH_ZOOM_STEP)}
                      disabled={workbenchZoom <= MIN_WORKBENCH_ZOOM}
                      className="inline-flex size-8 items-center justify-center rounded-md transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-35"
                      aria-label="Kicsinyítés"
                    >
                      <ZoomOut size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={resetWorkbenchZoom}
                      className="inline-flex h-8 min-w-14 items-center justify-center rounded-md px-2 text-xs tabular-nums text-white/85 transition hover:bg-white/15"
                      aria-label="Zoom visszaállítása"
                    >
                      {formatWorkbenchZoom(workbenchZoom)}
                    </button>
                    <button
                      type="button"
                      onClick={() => adjustWorkbenchZoom(WORKBENCH_ZOOM_STEP)}
                      disabled={workbenchZoom >= MAX_WORKBENCH_ZOOM}
                      className="inline-flex size-8 items-center justify-center rounded-md transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-35"
                      aria-label="Nagyítás"
                    >
                      <ZoomIn size={16} />
                    </button>
                  </div>
                  {changedSpreadIds.length > 0 ? (
                    <form action={saveAlbumDesignSpreadDraftsAction.bind(null, customerId, designId)}>
                      {changedSpreadIds.map((spreadId) => (
                        <SpreadDraftInputs key={spreadId} spreadId={spreadId} items={draftItemsBySpread[spreadId] ?? []} />
                      ))}
                      <FormSubmitButton
                        variant="secondary"
                        className="h-10 border-white/20 bg-white px-3 text-ink shadow-none hover:bg-white/90"
                        pendingLabel="Mentés..."
                      >
                        <Save size={15} />
                        Összes mentése
                      </FormSubmitButton>
                    </form>
                  ) : null}
                  <a
                    href={`/admin/album-designs/${designId}/export`}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-white/15 bg-white/10 px-3 text-sm font-medium text-white transition hover:bg-white/15"
                  >
                    <Download size={16} />
                    Összes export
                  </a>
                  <button
                    type="button"
                    onClick={() => setIsEditorOpen(false)}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-white/15 bg-white/10 px-3 text-sm font-medium text-white transition hover:bg-white/15"
                  >
                    <X size={16} />
                    Bezárás
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

                    return (
                      <button
                        key={`spread-nav-${spread.id}`}
                        type="button"
                        onClick={() => setActiveSpreadAndSlot(spread.id, selectedSlotBySpread[spread.id] ?? getOrderedItems(spread)[0]?.slotIndex ?? 0)}
                        className={`w-full rounded-md border px-3 py-2 text-left text-sm transition ${
                          isActive ? "border-ink bg-ink text-white" : "border-ink/10 bg-white text-graphite hover:border-ink/25 hover:text-ink"
                        }`}
                      >
                        <span className="block font-semibold">{spread.title ?? `Oldalpár ${spread.sortOrder}`}</span>
                        <span className={`mt-1 block text-xs ${isActive ? "text-white/65" : "text-graphite/55"}`}>
                          {template.name} · {spread.items.length} kép
                        </span>
                      </button>
                    );
                  })}
                </div>
                <SidebarSpreadCreateForm
                  isCreating={isCreatingSpread}
                  errorMessage={createSpreadError}
                  onCreateSpread={createInlineSpread}
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
                  {orderedSpreads.map((spread) => {
                    const template = getTemplate(spread.layoutKey);
                    const draftItems = draftItemsBySpread[spread.id] ?? getOrderedItems(spread);
                    const hasChanges = changedSpreadIds.includes(spread.id);
                    const isActive = spread.id === activeSpread?.id;
                    const selectedSlotIndex = selectedSlotBySpread[spread.id] ?? draftItems[0]?.slotIndex ?? 0;

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
                              {template.name} · {spread.items.length} kép
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
                            <a
                              href={`/admin/album-design-spreads/${spread.id}/export`}
                              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-ink/15 bg-white px-3 text-sm font-medium text-ink transition hover:border-ink/30"
                            >
                              <Download size={15} />
                              JPG export
                            </a>
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
                          customerId={customerId}
                          designId={designId}
                          spread={spread}
                          draftItems={draftItems}
                          onDraftItemsChange={(updater) =>
                            setDraftItemsBySpread((current) => ({
                              ...current,
                              [spread.id]: updater(current[spread.id] ?? getOrderedItems(spread))
                            }))
                          }
                          selectedSlotIndex={selectedSlotIndex}
                          onSelectedSlotIndexChange={(slotIndex) => setActiveSpreadAndSlot(spread.id, slotIndex)}
                          onFocusSpread={() => setActiveSpreadId(spread.id)}
                          onPhotoDropToSlot={(slotIndex, photoId) => replaceSpreadSlotPhotoById(spread.id, slotIndex, photoId)}
                          hasChanges={hasChanges}
                        />
                      </section>
                    );
                  })}
                </div>
              </main>
            </div>

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
                  Nincs elérhető forráskép ehhez az albumtervhez.
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
