"use client";

import Image from "next/image";
import { ImageIcon, MousePointer2 } from "lucide-react";
import { useMemo, useState } from "react";
import { updateAlbumDesignSpreadSlotAction } from "@/lib/album-design-actions";

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

  return (
    <div className="mt-3 rounded-md border border-ink/10 bg-paper p-3">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-ink">
            <MousePointer2 size={15} />
            Gyors slotcsere
          </p>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-graphite">
          Aktív slot: {selectedSlotIndex + 1}
        </span>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_260px]">
        <div className="relative aspect-[2/1] overflow-hidden rounded-md border border-ink/10 bg-mist">
          <div className="absolute left-1/2 top-0 z-20 h-full w-px bg-white/80 shadow-sm" />
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
                  left: `${item.x}%`,
                  top: `${item.y}%`,
                  width: `${item.width}%`,
                  height: `${item.height}%`
                }}
                aria-label={`${item.slotIndex + 1}. slot kiválasztása`}
              >
                <Image
                  src={item.photo.thumbnailUrl || item.photo.imageUrl}
                  alt={item.photo.filename}
                  fill
                  unoptimized
                  sizes="(min-width: 1280px) 460px, 100vw"
                  className="object-cover"
                />
                <span className={`absolute left-2 top-2 rounded-md px-2 py-1 text-xs font-semibold ${isSelected ? "bg-ink text-white" : "bg-white/90 text-ink"}`}>
                  {item.slotIndex + 1}
                </span>
              </button>
            );
          })}
        </div>

        <div className="rounded-md border border-ink/10 bg-white p-3">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-graphite/60">Kiválasztott slot</p>
          <p className="mt-1 truncate text-sm font-medium text-ink">{selectedItem?.photo.filename ?? "Nincs kép"}</p>
          <div className="mt-3 grid max-h-72 gap-2 overflow-auto pr-1 sm:grid-cols-2 xl:grid-cols-1">
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
        </div>
      </div>
    </div>
  );
}
