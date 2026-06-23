"use client";

import Image from "next/image";
import { Download, Grid3X3, RefreshCcw, Shuffle, Trash2 } from "lucide-react";
import { AlbumSpreadSlotEditor } from "@/components/album-spread-slot-editor";
import { Button } from "@/components/button";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import {
  deleteAlbumDesignSpreadAction,
  regenerateAlbumDesignSpreadLayoutAction,
  updateAlbumDesignSpreadAction
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

export function AlbumDesignWorkbench({
  customerId,
  designId,
  spreads,
  sourcePhotos
}: {
  customerId: string;
  designId: string;
  spreads: AlbumSpread[];
  sourcePhotos: FavoritePhoto[];
}) {
  if (spreads.length === 0) {
    return null;
  }

  return (
    <div className="mt-5 space-y-5">
      {spreads.map((spread) => {
        const template = getTemplate(spread.layoutKey);

        return (
          <div key={spread.id} className="rounded-lg border border-ink/10 bg-white p-4 shadow-sm">
            <div className="flex flex-col justify-between gap-3 border-b border-ink/10 pb-3 lg:flex-row lg:items-start">
              <div className="min-w-0">
                <p className="text-lg font-semibold text-ink">{spread.title ?? `Oldalpár ${spread.sortOrder}`}</p>
                <p className="mt-0.5 text-xs text-graphite/60">
                  {template.name} · {spread.items.length} kép
                </p>
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
                  <Button type="submit" variant="secondary" className="h-9 px-3" disabled={spread.items.length === 0}>
                    <Shuffle size={15} />
                    Újragenerálás
                  </Button>
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

            <AlbumSpreadSlotEditor customerId={customerId} designId={designId} spread={spread} photos={sourcePhotos} />

            <details className="mt-4 rounded-md border border-ink/10 bg-paper">
              <summary className="flex cursor-pointer items-center gap-2 px-3 py-3 text-sm font-medium text-ink">
                <RefreshCcw size={15} />
                Layout és képkészlet cseréje
              </summary>
              <form action={updateAlbumDesignSpreadAction.bind(null, customerId, designId, spread.id)} className="border-t border-ink/10 p-3">
                <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-graphite/70">Layout</p>
                    <div className="mt-2">
                      <AlbumLayoutRadioGrid defaultLayoutKey={spread.layoutKey} />
                    </div>
                    <Button type="submit" className="mt-3 w-full">
                      <Grid3X3 size={15} />
                      Layout mentése
                    </Button>
                  </div>
                  <div>
                    <p className="text-xs text-graphite/60">
                      Válaszd ki az új layoutnak megfelelő pontos képszámot. A képek a kijelölés sorrendjében kerülnek a slotokba.
                    </p>
                    <div className="mt-2 grid max-h-80 gap-2 overflow-auto pr-1 sm:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3">
                      {sourcePhotos.map((photo) => {
                        const isSelected = spread.items.some((item) => item.photo.id === photo.id);

                        return (
                          <label key={`${spread.id}-${photo.id}`} className="group relative block cursor-pointer overflow-hidden rounded-md border border-ink/10 bg-mist">
                            <input
                              name="photoIds"
                              value={photo.id}
                              type="checkbox"
                              defaultChecked={isSelected}
                              className="peer absolute left-2 top-2 z-10 size-4 accent-ink"
                            />
                            <span className="relative block aspect-[4/3]">
                              <Image
                                src={photo.thumbnailUrl || photo.imageUrl}
                                alt={photo.filename}
                                fill
                                unoptimized
                                sizes="140px"
                                className="object-cover transition group-hover:scale-[1.02]"
                              />
                            </span>
                            <span className="block truncate bg-white px-2 py-1.5 text-xs text-graphite peer-checked:bg-ink peer-checked:text-white">
                              {photo.filename}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </form>
            </details>
          </div>
        );
      })}
    </div>
  );
}
