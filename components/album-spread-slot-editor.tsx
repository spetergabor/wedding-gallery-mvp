"use client";

import Image from "next/image";
import { ImageIcon, MousePointer2 } from "lucide-react";
import { useMemo, useState } from "react";
import { updateAlbumDesignSpreadSlotAction } from "@/lib/album-design-actions";
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
  const [selectedSlotIndex, setSelectedSlotIndex] = useState(orderedItems[0]?.slotIndex ?? 0);
  const selectedItem = orderedItems.find((item) => item.slotIndex === selectedSlotIndex) ?? orderedItems[0] ?? null;
  const slotInset = ALBUM_SPREAD_PREVIEW_SLOT_INSET_PX;

  return (
    <div className="mt-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-md border border-ink/10 bg-paper p-3">
          <div className="mb-3 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <p className="flex items-center gap-2 text-sm font-medium text-ink">
              <MousePointer2 size={15} />
              Oldalpár vászon
            </p>
            <div className="flex flex-wrap gap-2">
              {orderedItems.map((item) => {
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
            {orderedItems.map((item) => {
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
          <div className="rounded-md bg-white px-3 py-2">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-graphite/60">Aktív slot {selectedSlotIndex + 1}</p>
            <p className="mt-1 truncate text-sm font-medium text-ink">{selectedItem?.photo.filename ?? "Nincs kép"}</p>
          </div>
          <div className="mt-3 grid max-h-[520px] gap-2 overflow-auto pr-1 sm:grid-cols-2 xl:grid-cols-1">
            {photos.map((photo) => {
              const isCurrent = selectedItem?.photo.id === photo.id;

              return (
                <form key={`${spread.id}-slot-${selectedSlotIndex}-${photo.id}`} action={updateAlbumDesignSpreadSlotAction.bind(null, customerId, designId, spread.id)}>
                  <input type="hidden" name="slotIndex" value={selectedSlotIndex} />
                  <input type="hidden" name="photoId" value={photo.id} />
                  <button
                    type="submit"
                    className={`grid w-full grid-cols-[64px_minmax(0,1fr)] items-center gap-2 rounded-md border p-1 text-left transition ${
                      isCurrent ? "border-ink bg-ink text-white" : "border-ink/10 bg-paper text-graphite hover:border-brass hover:bg-brass/10"
                    }`}
                    disabled={isCurrent}
                  >
                    <span className="relative block aspect-[4/3] overflow-hidden rounded bg-mist">
                      <Image
                        src={photo.thumbnailUrl || photo.imageUrl}
                        alt={photo.filename}
                        fill
                        unoptimized
                        sizes="64px"
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
                </form>
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
