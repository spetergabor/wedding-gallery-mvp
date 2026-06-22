import Image from "next/image";
import { Grid3X3, Images, LayoutTemplate, Plus } from "lucide-react";
import { Button } from "@/components/button";
import { createAlbumDesignAction, createAlbumDesignSpreadAction } from "@/lib/album-design-actions";
import { ALBUM_LAYOUT_TEMPLATES } from "@/lib/album-design-templates";

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

function TemplatePreview({ layoutKey }: { layoutKey: string }) {
  const template = ALBUM_LAYOUT_TEMPLATES.find((item) => item.key === layoutKey) ?? ALBUM_LAYOUT_TEMPLATES[0];

  return (
    <div className="relative aspect-[2/1] overflow-hidden rounded-md border border-ink/10 bg-white">
      <div className="absolute left-1/2 top-0 h-full w-px bg-ink/20" />
      {template.slots.map((slot, index) => (
        <div
          key={`${template.key}-${index}`}
          className="absolute border border-brass/50 bg-brass/15"
          style={{
            left: `${slot.x}%`,
            top: `${slot.y}%`,
            width: `${slot.width}%`,
            height: `${slot.height}%`
          }}
        />
      ))}
    </div>
  );
}

function SpreadPreview({ spread }: { spread: AlbumDesign["spreads"][number] }) {
  return (
    <div className="relative aspect-[2/1] overflow-hidden rounded-md border border-ink/10 bg-mist">
      <div className="absolute left-1/2 top-0 z-10 h-full w-px bg-white/80 shadow-sm" />
      {spread.items.map((item) => (
        <div
          key={item.id}
          className="absolute overflow-hidden border border-white bg-white"
          style={{
            left: `${item.x}%`,
            top: `${item.y}%`,
            width: `${item.width}%`,
            height: `${item.height}%`
          }}
        >
          <Image
            src={item.photo.thumbnailUrl || item.photo.imageUrl}
            alt={item.photo.filename}
            fill
            unoptimized
            sizes="(min-width: 1024px) 320px, 100vw"
            className="object-cover"
          />
        </div>
      ))}
    </div>
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
                  </div>
                </div>

                {design.favoriteList ? (
                  <form action={createAlbumDesignSpreadAction.bind(null, customerId, design.id)} className="mt-5 rounded-md border border-ink/10 bg-white p-4">
                    <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
                      <div>
                        <label className="block text-sm font-medium text-graphite">Layout template</label>
                        <select
                          name="layoutKey"
                          className="mt-2 h-11 w-full rounded-md border border-ink/15 bg-paper px-3 text-sm text-ink outline-none transition focus:border-ink/50"
                          defaultValue={ALBUM_LAYOUT_TEMPLATES[1]?.key ?? ALBUM_LAYOUT_TEMPLATES[0].key}
                        >
                          {ALBUM_LAYOUT_TEMPLATES.map((template) => (
                            <option key={template.key} value={template.key}>
                              {template.name} · {template.photoCount} kép
                            </option>
                          ))}
                        </select>
                        <div className="mt-3 grid gap-2">
                          {ALBUM_LAYOUT_TEMPLATES.map((template) => (
                            <div key={template.key}>
                              <TemplatePreview layoutKey={template.key} />
                              <p className="mt-1 text-xs text-graphite/60">{template.name}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-graphite">Képek kiválasztása</p>
                            <p className="mt-1 text-xs text-graphite/60">
                              Válassz pontosan annyi képet, amennyit a layout kér. Ebben az első verzióban a képek a slotok sorrendjében kerülnek be.
                            </p>
                          </div>
                          <Button type="submit">
                            <Grid3X3 size={16} />
                            Oldalpár létrehozása
                          </Button>
                        </div>

                        <div className="mt-3 grid max-h-[520px] gap-2 overflow-auto pr-1 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
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
                      </div>
                    </div>
                  </form>
                ) : null}

                {design.spreads.length > 0 ? (
                  <div className="mt-5 grid gap-4 lg:grid-cols-2">
                    {design.spreads.map((spread) => (
                      <div key={spread.id} className="rounded-md border border-ink/10 bg-white p-3">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium text-ink">{spread.title ?? `Oldalpár ${spread.sortOrder}`}</p>
                            <p className="mt-0.5 text-xs text-graphite/60">
                              {spread.layoutKey} · {spread.items.length} kép
                            </p>
                          </div>
                          <Images size={16} className="text-brass" />
                        </div>
                        <SpreadPreview spread={spread} />
                      </div>
                    ))}
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
