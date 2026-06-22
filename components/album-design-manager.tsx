import Image from "next/image";
import { Grid3X3, LayoutTemplate, Plus, RefreshCcw, Shuffle, Trash2 } from "lucide-react";
import { AlbumSpreadSlotEditor } from "@/components/album-spread-slot-editor";
import { Button } from "@/components/button";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import {
  createAlbumDesignAction,
  createAutoAlbumDesignSpreadAction,
  createAlbumDesignSpreadAction,
  deleteAlbumDesignAction,
  deleteAlbumDesignSpreadAction,
  regenerateAlbumDesignSpreadLayoutAction,
  updateAlbumDesignSpreadAction
} from "@/lib/album-design-actions";
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
                      <p className="mt-2 text-sm font-medium text-ink">
                        Vizuális szerkesztő aktív: kattints egy képslotra, majd válassz új képet.
                      </p>
                    ) : null}
                  </div>
                  <form action={deleteAlbumDesignAction.bind(null, customerId, design.id)} className="shrink-0">
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
                              Válassz 1-6 képet. Az automatikus gomb véletlen layoutot és képsorrendet választ, a kézi gomb a bal oldali layoutot használja.
                            </p>
                          </div>
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button type="submit" formAction={createAutoAlbumDesignSpreadAction.bind(null, customerId, design.id)}>
                              <Shuffle size={16} />
                              Automatikus oldalpár
                            </Button>
                            <Button type="submit" variant="secondary">
                              <Grid3X3 size={16} />
                              Kézi layout
                            </Button>
                          </div>
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
                  <div className="mt-5 space-y-5">
                    {design.spreads.map((spread) => (
                      <div key={spread.id} className="rounded-lg border border-ink/10 bg-white p-4">
                        <div className="flex flex-col justify-between gap-3 border-b border-ink/10 pb-3 sm:flex-row sm:items-start">
                          <div>
                            <p className="text-lg font-semibold text-ink">{spread.title ?? `Oldalpár ${spread.sortOrder}`}</p>
                            <p className="mt-0.5 text-xs text-graphite/60">
                              {spread.layoutKey} · {spread.items.length} kép
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <form action={regenerateAlbumDesignSpreadLayoutAction.bind(null, customerId, design.id, spread.id)}>
                              <Button type="submit" variant="secondary" className="h-9 px-3" disabled={spread.items.length === 0}>
                                <Shuffle size={15} />
                                Újragenerálás
                              </Button>
                            </form>
                            <form action={deleteAlbumDesignSpreadAction.bind(null, customerId, design.id, spread.id)}>
                              <Button type="submit" variant="danger" className="h-9 px-3">
                                <Trash2 size={15} />
                                Törlés
                              </Button>
                            </form>
                          </div>
                        </div>
                        <AlbumSpreadSlotEditor customerId={customerId} designId={design.id} spread={spread} photos={sourcePhotos} />
                        <details className="mt-4 rounded-md border border-ink/10 bg-paper">
                          <summary className="flex cursor-pointer items-center gap-2 px-3 py-3 text-sm font-medium text-ink">
                            <RefreshCcw size={15} />
                            Layout és képkészlet cseréje
                          </summary>
                          <form action={updateAlbumDesignSpreadAction.bind(null, customerId, design.id, spread.id)} className="border-t border-ink/10 p-3">
                            <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
                              <div>
                                <label className="block text-xs font-medium uppercase tracking-[0.14em] text-graphite/70">Layout</label>
                                <select
                                  name="layoutKey"
                                  className="mt-2 h-10 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50"
                                  defaultValue={spread.layoutKey}
                                >
                                  {ALBUM_LAYOUT_TEMPLATES.map((template) => (
                                    <option key={template.key} value={template.key}>
                                      {template.name} · {template.photoCount} kép
                                    </option>
                                  ))}
                                </select>
                                <Button type="submit" className="mt-3 w-full">
                                  <RefreshCcw size={15} />
                                  Mentés
                                </Button>
                              </div>
                              <div>
                                <p className="text-xs text-graphite/60">
                                  Válaszd ki az új layoutnak megfelelő pontos képszámot. A képek a kijelölés sorrendjében kerülnek a slotokba.
                                </p>
                                <div className="mt-2 grid max-h-80 gap-2 overflow-auto pr-1 sm:grid-cols-3 2xl:grid-cols-4">
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
