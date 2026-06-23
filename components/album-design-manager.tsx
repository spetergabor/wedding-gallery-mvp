import Image from "next/image";
import { Grid3X3, LayoutTemplate, Plus, Send, Shuffle, Trash2 } from "lucide-react";
import { AlbumDesignWorkbench } from "@/components/album-design-workbench";
import { Button } from "@/components/button";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import {
  createAlbumDesignAction,
  createAutoAlbumDesignSpreadAction,
  createAlbumDesignSpreadAction,
  deleteAlbumDesignAction,
  exportAlbumDesignToReviewAction
} from "@/lib/album-design-actions";
import { ALBUM_LAYOUT_TEMPLATES, ALBUM_SPREAD_BACKGROUND, getAlbumLayoutPreviewSlotInsetPx } from "@/lib/album-design-templates";

const maxAlbumLayoutPhotoCount = Math.max(...ALBUM_LAYOUT_TEMPLATES.map((template) => template.photoCount));

type FavoritePhoto = {
  id: string;
  filename: string;
  imageUrl: string;
  thumbnailUrl: string;
};

type FavoriteList = {
  id: string;
  name: string;
  email: string;
  submittedAt: Date | null;
  gallery: {
    title: string;
  };
  _count: {
    items: number;
  };
  items: Array<{
    photo: FavoritePhoto;
  }>;
};

type AlbumDesign = {
  id: string;
  title: string;
  status: string;
  createdAt: Date;
  favoriteList: {
    id: string;
    name: string;
    email: string;
    submittedAt: Date | null;
    gallery: {
      title: string;
    };
    items: Array<{
      photo: FavoritePhoto;
    }>;
    _count: {
      items: number;
    };
  } | null;
  spreads: Array<{
    id: string;
    title: string | null;
    layoutKey: string;
    sortOrder: number;
    items: Array<{
      id: string;
      slotIndex: number;
      x: number;
      y: number;
      width: number;
      height: number;
      cropX: number;
      cropY: number;
      photo: FavoritePhoto;
    }>;
  }>;
};

function formatDate(date: Date | null) {
  if (!date) {
    return "még nincs leadva";
  }

  return date.toLocaleString("hu-HU", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function statusLabel(status: string) {
  if (status === "draft") {
    return "Tervezés alatt";
  }

  if (status === "approved") {
    return "Jóváhagyva";
  }

  return status;
}

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

function AlbumSpreadCreateForm({
  customerId,
  designId,
  sourcePhotos,
  title = "Új oldalpár"
}: {
  customerId: string;
  designId: string;
  sourcePhotos: FavoritePhoto[];
  title?: string;
}) {
  return (
    <form action={createAlbumDesignSpreadAction.bind(null, customerId, designId)} className="rounded-md border border-ink/10 bg-white p-4">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
          <div>
            <p className="text-sm font-medium text-ink">{title}</p>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-graphite/60">
              Jelölj ki 1-{maxAlbumLayoutPhotoCount} képet, majd generálj belőlük automatikus oldalpárt. Ha a kompozíció nem jó, az oldalpárnál az Újragenerálás gombbal másik verziót kapsz.
            </p>
          </div>
          <Button type="submit" formAction={createAutoAlbumDesignSpreadAction.bind(null, customerId, designId)} className="shrink-0">
            <Shuffle size={16} />
            Automatikus oldalpár
          </Button>
        </div>

        <div className="grid max-h-[520px] gap-2 overflow-auto pr-1 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
          {sourcePhotos.map((photo) => (
            <label key={photo.id} className="group relative block cursor-pointer overflow-hidden rounded-md border border-ink/10 bg-mist">
              <input name="photoIds" value={photo.id} type="checkbox" className="peer absolute left-2 top-2 z-10 size-4 accent-ink" />
              <span className="relative block aspect-[4/3]">
                <Image
                  src={photo.thumbnailUrl || photo.imageUrl}
                  alt={photo.filename}
                  fill
                  unoptimized
                  sizes="160px"
                  className="object-cover transition group-hover:scale-[1.02]"
                />
              </span>
              <span className="block truncate bg-white px-2 py-1.5 text-xs text-graphite peer-checked:bg-ink peer-checked:text-white">
                {photo.filename}
              </span>
            </label>
          ))}
        </div>

        <details className="rounded-md border border-ink/10 bg-paper">
          <summary className="flex cursor-pointer items-center gap-2 px-3 py-3 text-sm font-medium text-ink">
            <Grid3X3 size={15} />
            Kézi layout választása
          </summary>
          <div className="border-t border-ink/10 p-3">
            <AlbumLayoutRadioGrid />
            <Button type="submit" variant="secondary" className="mt-3">
              <Grid3X3 size={16} />
              Kézi layout létrehozása
            </Button>
          </div>
        </details>
      </div>
    </form>
  );
}

export function AlbumDesignManager({
  customerId,
  favoriteLists,
  designs
}: {
  customerId: string;
  favoriteLists: FavoriteList[];
  designs: AlbumDesign[];
}) {
  return (
    <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
      <div className="flex flex-col justify-between gap-4 border-b border-ink/10 pb-5 lg:flex-row lg:items-start">
        <div>
          <div className="flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-brass">
            <LayoutTemplate size={15} />
            Albumtervező
          </div>
          <h2 className="mt-2 text-xl font-semibold text-ink">Template alapú oldalpár tervezés</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-graphite/70">
            Favorite listából válassz képeket, majd egy 60x30 arányú oldalpár template automatikusan elrendezi őket.
          </p>
        </div>

        <form action={createAlbumDesignAction.bind(null, customerId)} className="grid min-w-80 gap-2 rounded-md border border-ink/10 bg-paper p-3">
          <input
            name="title"
            placeholder="pl. Dalma album v1"
            className="h-11 rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50"
          />
          <select
            name="favoriteListId"
            required
            className="h-11 rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50"
            defaultValue=""
          >
            <option value="" disabled>
              Favorite list kiválasztása
            </option>
            {favoriteLists.map((list) => (
              <option key={list.id} value={list.id}>
                {list.gallery.title} · {list.name} · {list._count.items} kép
              </option>
            ))}
          </select>
          <Button type="submit" disabled={favoriteLists.length === 0}>
            <Plus size={16} />
            Új albumterv
          </Button>
        </form>
      </div>

      {favoriteLists.length === 0 ? (
        <div className="mt-5 rounded-md bg-paper px-4 py-4">
          <p className="text-sm font-medium text-ink">Nincs még használható favorite list</p>
          <p className="mt-1 text-sm text-graphite/70">
            Először legyen egy galériában ügyfél által kiválasztott vagy leadott lista, abból tudunk albumtervet építeni.
          </p>
        </div>
      ) : null}

      {designs.length === 0 ? (
        <div className="mt-5 rounded-md bg-paper px-4 py-4">
          <p className="text-sm font-medium text-ink">Még nincs albumterv ehhez az ügyfélhez</p>
          <p className="mt-1 text-sm text-graphite/70">Hozz létre egy albumtervet valamelyik favorite listából.</p>
        </div>
      ) : (
        <div className="mt-5 space-y-6">
          {designs.map((design) => {
            const sourcePhotos = design.favoriteList?.items.map((item) => item.photo) ?? [];

            return (
              <article key={design.id} className="rounded-lg border border-ink/10 bg-paper p-4">
                <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-ink">{design.title}</h3>
                      <span className="rounded-full bg-brass/10 px-2.5 py-1 text-xs font-medium text-brass">
                        {statusLabel(design.status)}
                      </span>
                      <span className="rounded-full bg-ink/5 px-2.5 py-1 text-xs font-medium text-graphite">
                        {design.spreads.length} oldalpár
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-graphite/70">
                      Forrás: {design.favoriteList ? `${design.favoriteList.gallery.title} · ${design.favoriteList.name}` : "hiányzó lista"}
                    </p>
                    {design.favoriteList ? (
                      <p className="mt-1 text-sm text-graphite/60">
                        {design.favoriteList.email} · {design.favoriteList._count.items} kép · Leadva: {formatDate(design.favoriteList.submittedAt)}
                      </p>
                    ) : null}
                    {design.spreads.length > 0 ? (
                      <p className="mt-2 text-sm font-medium text-ink/80">
                        Minden oldalpár teljes szélességben látszik, a képcserét az adott oldalpár alatt nyithatod meg.
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {design.spreads.length > 0 ? (
                      <form action={exportAlbumDesignToReviewAction.bind(null, customerId, design.id)}>
                        <ConfirmSubmitButton
                          title="Album ellenőrző létrehozása"
                          message="Létrehozunk egy új album ellenőrzőt az albumterv JPG oldalpárjaiból. Mehet?"
                          className="h-10 px-3"
                        >
                          <Send size={15} />
                          Ellenőrzőbe küldés
                        </ConfirmSubmitButton>
                      </form>
                    ) : null}
                    <form action={deleteAlbumDesignAction.bind(null, customerId, design.id)}>
                      <ConfirmSubmitButton
                        title="Albumterv törlése"
                        message="Biztosan törlöd ezt az albumtervet? Az összes hozzá tartozó tervezett oldalpár is törlődik."
                        variant="danger"
                        className="h-10 px-3"
                      >
                        <Trash2 size={15} />
                        Albumterv törlése
                      </ConfirmSubmitButton>
                    </form>
                  </div>
                </div>

                {design.favoriteList && design.spreads.length === 0 ? (
                  <div className="mt-5">
                    <AlbumSpreadCreateForm customerId={customerId} designId={design.id} sourcePhotos={sourcePhotos} />
                  </div>
                ) : null}

                {design.spreads.length > 0 ? (
                  <div>
                    <AlbumDesignWorkbench customerId={customerId} designId={design.id} spreads={design.spreads} sourcePhotos={sourcePhotos} />
                    {design.favoriteList ? (
                      <details className="mt-4 rounded-lg border border-dashed border-ink/20 bg-white">
                        <summary className="flex cursor-pointer items-center justify-center gap-2 px-4 py-4 text-sm font-medium text-ink transition hover:bg-paper">
                          <Plus size={16} />
                          További oldalpár létrehozása
                        </summary>
                        <div className="border-t border-ink/10 p-4">
                          <AlbumSpreadCreateForm
                            customerId={customerId}
                            designId={design.id}
                            sourcePhotos={sourcePhotos}
                            title="További oldalpár"
                          />
                        </div>
                      </details>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
