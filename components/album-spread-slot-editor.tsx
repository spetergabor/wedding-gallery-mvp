"use client";

import Image from "next/image";
import { ImageIcon, MousePointer2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { saveAlbumDesignSpreadSlotDraftAction } from "@/lib/album-design-actions";
import { ALBUM_SPREAD_BACKGROUND, ALBUM_SPREAD_PREVIEW_SLOT_INSET_PX } from "@/lib/album-design-templates";

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
  photo: FavoritePhoto;
};

type EditableSpread = {
  id: string;
  title: string | null;
  sortOrder: number;
  items: SpreadItem[];
};

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
  const originalPhotoIds = useMemo(() => orderedItems.map((item) => item.photo.id).join("|"), [orderedItems]);
  const [draftItems, setDraftItems] = useState(orderedItems);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState(orderedItems[0]?.slotIndex ?? 0);
  const selectedItem = draftItems.find((item) => item.slotIndex === selectedSlotIndex) ?? draftItems[0] ?? null;
  const draftPhotoIds = draftItems.map((item) => item.photo.id).join("|");
  const hasChanges = draftPhotoIds !== originalPhotoIds;
  const slotInset = ALBUM_SPREAD_PREVIEW_SLOT_INSET_PX;

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
              photo
            }
          : item
      )
    );
  }

  function resetDraft() {
    setDraftItems(orderedItems);
    setSelectedSlotIndex(orderedItems[0]?.slotIndex ?? 0);
  }

  return (
    <div className="mt-4">
      <div className="space-y-4">
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
                    className={`h-8 rounded-md border px-3 text-xs font-medium transition ${
                      isSelected ? "border-ink bg-ink text-white" : "border-ink/10 bg-white text-graphite hover:border-brass hover:text-ink"
                    }`}
                  >
                    Slot {item.slotIndex + 1}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="relative aspect-[2/1] overflow-hidden rounded-md border border-ink/10" style={{ backgroundColor: ALBUM_SPREAD_BACKGROUND }}>
            {draftItems.map((item) => {
              const isSelected = item.slotIndex === selectedSlotIndex;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedSlotIndex(item.slotIndex)}
                  className={`absolute overflow-hidden border bg-white transition ${
                    isSelected ? "z-10 border-ink shadow-[0_0_0_3px_rgba(25,25,25,0.18)]" : "border-white hover:border-brass"
                  }`}
                  style={{
                    left: `calc(${item.x}% + ${slotInset}px)`,
                    top: `calc(${item.y}% + ${slotInset}px)`,
                    width: `calc(${item.width}% - ${slotInset * 2}px)`,
                    height: `calc(${item.height}% - ${slotInset * 2}px)`
                  }}
                  aria-label={`${item.slotIndex + 1}. slot kiválasztása`}
                >
                  <Image
                    src={item.photo.thumbnailUrl || item.photo.imageUrl}
                    alt={item.photo.filename}
                    fill
                    unoptimized
                    sizes="(min-width: 1280px) 760px, 100vw"
                    className="object-cover"
                  />
                  <span className={`absolute left-2 top-2 rounded-md px-2 py-1 text-xs font-semibold ${isSelected ? "bg-ink text-white" : "bg-white/90 text-ink"}`}>
                    {item.slotIndex + 1}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="rounded-md border border-ink/10 bg-paper p-3">
          <div className="flex flex-col justify-between gap-3 rounded-md bg-white px-3 py-2 sm:flex-row sm:items-center">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-graphite/60">Aktív slot {selectedSlotIndex + 1}</p>
              <p className="mt-1 truncate text-sm font-medium text-ink">{selectedItem?.photo.filename ?? "Nincs kép"}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs text-graphite/60">{hasChanges ? "Nem mentett módosítások." : "Válassz képet az aktív slot cseréjéhez."}</p>
              <button
                type="button"
                onClick={resetDraft}
                disabled={!hasChanges}
                className="h-8 rounded-md border border-ink/15 bg-white px-3 text-xs font-medium text-ink transition hover:border-ink/30 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Visszaállítás
              </button>
              <form action={saveAlbumDesignSpreadSlotDraftAction.bind(null, customerId, designId, spread.id)}>
                {draftItems.map((item) => (
                  <input key={`slot-draft-${item.slotIndex}`} type="hidden" name="slotPhotoIds" value={item.photo.id} />
                ))}
                <button
                  type="submit"
                  disabled={!hasChanges}
                  className="h-8 rounded-md bg-ink px-3 text-xs font-medium text-white transition hover:bg-graphite disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Módosítások mentése
                </button>
              </form>
            </div>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {photos.map((photo) => {
              const isCurrent = selectedItem?.photo.id === photo.id;

              return (
                <button
                  key={`${spread.id}-slot-${selectedSlotIndex}-${photo.id}`}
                  type="button"
                  onClick={() => replaceSelectedSlotPhoto(photo)}
                  className={`grid w-[220px] shrink-0 grid-cols-[86px_minmax(0,1fr)] items-center gap-2 rounded-md border p-1.5 text-left transition ${
                    isCurrent ? "border-ink bg-ink text-white" : "border-ink/10 bg-paper text-graphite hover:border-brass hover:bg-brass/10"
                  }`}
                >
                  <span className="relative block aspect-[4/3] overflow-hidden rounded bg-mist">
                    <Image
                      src={photo.thumbnailUrl || photo.imageUrl}
                      alt={photo.filename}
                      fill
                      unoptimized
                      sizes="86px"
                      className="object-cover"
                    />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-medium">{photo.filename}</span>
                    <span className={`mt-0.5 block text-[11px] ${isCurrent ? "text-white/70" : "text-graphite/60"}`}>
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
        </aside>
      </div>
    </div>
  );
}
