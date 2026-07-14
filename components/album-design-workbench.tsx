"use client";

import Image from "next/image";
import { Download, Grid3X3, Images, Maximize2, Plus, RefreshCcw, Save, Search, Shuffle, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AlbumSpreadSlotEditor } from "@/components/album-spread-slot-editor";
import { FormSubmitButton } from "@/components/form-submit-button";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import {
  createEmptyAlbumDesignSpreadAction,
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

function AlbumLayoutRadioGrid({ defaultLayoutKey }: { defaultLayoutKey?: string }) {
  const fallbackLayoutKey = defaultLayoutKey ?? ALBUM_LAYOUT_TEMPLATES[1]?.key ?? ALBUM_LAYOUT_TEMPLATES[0].key;

  return (
    <div className="grid max-h-72 gap-2 overflow-auto pr-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
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
  customerId,
  designId
}: {
  customerId: string | null;
  designId: string;
}) {
  return (
    <form action={createEmptyAlbumDesignSpreadAction.bind(null, customerId, designId)} className="mt-3">
      <FormSubmitButton variant="secondary" className="h-11 w-full justify-center border-dashed bg-white px-3" pendingLabel="Létrehozás...">
        <Plus size={16} />
        Oldalpár hozzáadása
      </FormSubmitButton>
    </form>
  );
}

export function AlbumDesignWorkbench({
  customerId,
  designId,
  spreads,
  sourcePhotos,
  initialEditorOpen = false
}: {
  customerId: string | null;
  designId: string;
  spreads: AlbumSpread[];
  sourcePhotos: FavoritePhoto[];
  initialEditorOpen?: boolean;
}) {
  const orderedSpreads = useMemo(() => [...spreads].sort((left, right) => left.sortOrder - right.sortOrder), [spreads]);
  const [isEditorOpen, setIsEditorOpen] = useState(initialEditorOpen);
  const [draftItemsBySpread, setDraftItemsBySpread] = useState<Record<string, SpreadItem[]>>(() => createDraftMap(spreads));
  const [activeSpreadId, setActiveSpreadId] = useState(() => orderedSpreads[0]?.id ?? "");
  const [selectedSlotBySpread, setSelectedSlotBySpread] = useState<Record<string, number>>(() =>
    Object.fromEntries(spreads.map((spread) => [spread.id, getOrderedItems(spread)[0]?.slotIndex ?? 0]))
  );
  const [photoQuery, setPhotoQuery] = useState("");
  const [showUnusedOnly, setShowUnusedOnly] = useState(false);
  const originalSignaturesBySpread = useMemo(
    () => Object.fromEntries(spreads.map((spread) => [spread.id, getItemSignature(getOrderedItems(spread))])),
    [spreads]
  );
  const changedSpreadIds = useMemo(
    () =>
      spreads
        .filter((spread) => getItemSignature(draftItemsBySpread[spread.id] ?? getOrderedItems(spread)) !== originalSignaturesBySpread[spread.id])
        .map((spread) => spread.id),
    [draftItemsBySpread, originalSignaturesBySpread, spreads]
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
  const activeDraftItems = activeSpread ? (draftItemsBySpread[activeSpread.id] ?? getOrderedItems(activeSpread)) : [];
  const activeSlotIndex = activeSpread ? (selectedSlotBySpread[activeSpread.id] ?? activeDraftItems[0]?.slotIndex ?? 0) : 0;
  const activeSlotItem = activeDraftItems.find((item) => item.slotIndex === activeSlotIndex) ?? activeDraftItems[0] ?? null;
  const filteredPhotos = useMemo(() => {
    const normalizedQuery = photoQuery.trim().toLowerCase();
    const searchedPhotos = normalizedQuery ? sourcePhotos.filter((photo) => photo.filename.toLowerCase().includes(normalizedQuery)) : sourcePhotos;

    if (!showUnusedOnly) {
      return searchedPhotos;
    }

    return searchedPhotos.filter((photo) => !usedPhotoIdSet.has(photo.id) || photo.id === activeSlotItem?.photo.id);
  }, [activeSlotItem?.photo.id, photoQuery, showUnusedOnly, sourcePhotos, usedPhotoIdSet]);

  useEffect(() => {
    setDraftItemsBySpread(createDraftMap(spreads));
  }, [spreads]);

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
        setIsEditorOpen(false);
      }
    }

    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isEditorOpen]);

  function setActiveSpreadAndSlot(spreadId: string, slotIndex?: number) {
    setActiveSpreadId(spreadId);

    if (slotIndex !== undefined) {
      setSelectedSlotBySpread((current) => ({
        ...current,
        [spreadId]: slotIndex
      }));
    }
  }

  function replaceActiveSlotPhoto(photo: FavoritePhoto) {
    if (!activeSpread) {
      return;
    }

    const layout = getTemplate(activeSpread.layoutKey);
    const slot = layout.slots[activeSlotIndex];

    if (!slot) {
      return;
    }

    setDraftItemsBySpread((current) => ({
      ...current,
      [activeSpread.id]: (() => {
        const currentItems = current[activeSpread.id] ?? getOrderedItems(activeSpread);
        const hasSlotItem = currentItems.some((item) => item.slotIndex === activeSlotIndex);
        const nextItems = hasSlotItem
          ? currentItems.map((item) =>
              item.slotIndex === activeSlotIndex
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
                id: `draft-${activeSpread.id}-${activeSlotIndex}`,
                slotIndex: activeSlotIndex,
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

  if (spreads.length === 0) {
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
                  {changedSpreadIds.length > 0 ? (
                    <form action={saveAlbumDesignSpreadDraftsAction.bind(null, customerId, designId)}>
                      {changedSpreadIds.map((spreadId) => (
                        <SpreadDraftInputs key={spreadId} spreadId={spreadId} items={draftItemsBySpread[spreadId] ?? []} />
                      ))}
                      <FormSubmitButton className="h-10 bg-white px-3 text-ink hover:bg-white/90" pendingLabel="Mentés...">
                        <Save size={15} />
                        Összes mentése
                      </FormSubmitButton>
                    </form>
                  ) : null}
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
                  customerId={customerId}
                  designId={designId}
                />
              </aside>

              <main className="min-h-0 overflow-auto px-3 py-4 lg:px-5">
                <div className="mx-auto max-w-[1500px] space-y-4 pb-6">
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
                        onClick={() => setActiveSpreadAndSlot(spread.id, selectedSlotIndex)}
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
                          hasChanges={hasChanges}
                        />

                        <details className="mt-4 rounded-md border border-ink/10 bg-paper">
                          <summary className="flex cursor-pointer items-center gap-2 px-3 py-3 text-sm font-medium text-ink">
                            <RefreshCcw size={15} />
                            Layout cseréje
                          </summary>
                          <form action={updateAlbumDesignSpreadLayoutOnlyAction.bind(null, customerId, designId, spread.id)} className="border-t border-ink/10 p-3">
                            <p className="mb-3 text-xs text-graphite/60">
                              Csak az oldalpár szerkezetét cseréli. A már beállított képeket a rendszer megtartja, ameddig az új layout slotjai engedik.
                            </p>
                            <AlbumLayoutRadioGrid defaultLayoutKey={spread.layoutKey} />
                            <FormSubmitButton className="mt-3 w-full" pendingLabel="Mentés...">
                              <Grid3X3 size={15} />
                              Layout mentése
                            </FormSubmitButton>
                          </form>
                        </details>
                      </section>
                    );
                  })}
                </div>
              </main>
            </div>

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

                  return (
                    <button
                      key={`global-tray-${activeSpread?.id ?? "none"}-${activeSlotIndex}-${photo.id}`}
                      type="button"
                      onClick={() => replaceActiveSlotPhoto(photo)}
                      disabled={!activeSpread}
                      className={`group w-28 shrink-0 overflow-hidden rounded-md border text-left transition ${
                        isCurrent
                          ? "border-white bg-white text-ink"
                          : "border-white/15 bg-white/10 text-white hover:border-white/50 hover:bg-white/15"
                      } disabled:cursor-not-allowed disabled:opacity-50`}
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
                      <span className={`block px-2 pb-2 text-[11px] ${isCurrent ? "text-ink/60" : "text-white/55"}`}>
                        {isCurrent ? "Aktuális" : isUsed ? "Használva" : "Szabad"}
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
