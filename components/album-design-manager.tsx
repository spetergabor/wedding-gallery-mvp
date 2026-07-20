import Link from "next/link";
import { ArrowLeft, FolderKanban, LayoutTemplate, Plus, Send, Trash2 } from "lucide-react";
import { AlbumDesignWorkbench } from "@/components/album-design-workbench";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { FormSubmitButton } from "@/components/form-submit-button";
import { PhotoUploadForm } from "@/components/photo-upload-form";
import {
  createAlbumDesignAction,
  deleteAlbumDesignAction,
  exportAlbumDesignToReviewAction,
  updateAlbumDesignAssignmentAction
} from "@/lib/album-design-actions";
import { APP_TIME_ZONE } from "@/lib/date-format";
import { GALLERY_MODE_ALBUM_SOURCE, PHOTO_DELIVERY_STAGE_FINAL } from "@/lib/proofing";

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

type SourceGalleryOption = {
  id: string;
  title: string;
  customerName?: string | null;
  photoCount: number;
};

type AlbumProjectOption = {
  id: string;
  customerId?: string;
  customerName?: string;
  title: string;
};

type AlbumCustomerOption = {
  id: string;
  coupleName: string;
};

type AlbumDesign = {
  id: string;
  customerId: string | null;
  projectId: string | null;
  sourceGalleryId: string | null;
  title: string;
  status: string;
  createdAt: Date;
  customer?: {
    id: string;
    coupleName: string;
  } | null;
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
  sourceGallery: {
    id: string;
    title: string;
    galleryMode: string;
    photos: FavoritePhoto[];
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
    timeStyle: "short",
    timeZone: APP_TIME_ZONE
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

export function AlbumDesignManager({
  customerId,
  favoriteLists,
  sourceGalleries = [],
  designs,
  projects,
  customers = [],
  workspaceView = "projects",
  activeDesignId = null,
  initialEditorOpen = false,
  activeSpreadId = null
}: {
  customerId: string | null;
  favoriteLists: FavoriteList[];
  sourceGalleries?: SourceGalleryOption[];
  designs: AlbumDesign[];
  projects: AlbumProjectOption[];
  customers?: AlbumCustomerOption[];
  workspaceView?: "projects" | "new";
  activeDesignId?: string | null;
  initialEditorOpen?: boolean;
  activeSpreadId?: string | null;
}) {
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const standaloneMode = !customerId;
  const activeWorkspaceView = workspaceView === "new" ? "new" : "projects";
  const isCreationView = activeWorkspaceView === "new";
  const selectedDesign = activeDesignId ? (designs.find((design) => design.id === activeDesignId) ?? null) : null;
  const workspaceBaseHref = standaloneMode ? "/admin/albums?albumMode=editor" : `/admin/clients/${customerId}?tab=album&albumMode=editor`;
  const workspaceHref = (view: "projects" | "new", designId?: string) => {
    const separator = workspaceBaseHref.includes("?") ? "&" : "?";
    const params = [`albumWorkspace=${view}`];

    if (designId) {
      params.push(`albumDesignId=${designId}`);
    }

    return `${workspaceBaseHref}${separator}${params.join("&")}`;
  };
  const managerTitle = isCreationView ? "Új online album" : "Online albumok";
  const managerDescription = standaloneMode
    ? isCreationView
      ? "Adj nevet, válassz képforrást, majd mentsd el. Utána a szerkesztőben csak az adott album munkafelülete marad."
      : "Itt látod a Spetlyben készített albumterveidet. Nyisd meg a megfelelőt szerkesztéshez vagy ügyfélhez rendeléshez."
    : isCreationView
      ? "Adj nevet, válassz képforrást, majd mentsd el. Utána a szerkesztőben már csak az adott albumon dolgozol."
      : "Itt látod az ügyfél Spetlyben készített albumterveit. Nyisd meg a megfelelőt szerkesztéshez vagy ellenőrző készítéséhez.";

  return (
    <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
      <div className="border-b border-ink/10 pb-5">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div>
            <div className="flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-brass">
              <LayoutTemplate size={15} />
              Albumtervező
            </div>
            <h2 className="mt-2 text-xl font-semibold text-ink">{managerTitle}</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-graphite/70">{managerDescription}</p>
          </div>
          <Link
            href={isCreationView ? workspaceHref("projects", selectedDesign?.id) : workspaceHref("new")}
            className="inline-flex h-10 w-fit items-center justify-center gap-2 rounded-md border border-ink/15 bg-white px-3 text-sm font-medium text-ink transition hover:border-ink/30"
          >
            {isCreationView ? (
              <>
                <ArrowLeft size={15} />
                Meglévő online albumok
              </>
            ) : (
              <>
                <Plus size={15} />
                Új online album
              </>
            )}
          </Link>
        </div>

        {activeWorkspaceView === "new" ? (
        <form
          action={createAlbumDesignAction.bind(null, customerId)}
          className="mt-5 rounded-lg border border-ink/10 bg-paper p-4"
        >
          <p className="text-sm font-semibold text-ink">Új album indítása</p>
          <div className={`mt-3 grid gap-3 ${standaloneMode ? "lg:grid-cols-[1.2fr_1.4fr_auto]" : "lg:grid-cols-[1fr_1.25fr_1fr_auto]"}`}>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium uppercase tracking-[0.14em] text-graphite/55">1. Név</span>
              <input
                name="title"
                placeholder="pl. Dalma album v1"
                className="h-11 rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50"
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium uppercase tracking-[0.14em] text-graphite/55">2. Képforrás</span>
              <select
                name="sourceId"
                className="h-11 rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50"
                defaultValue=""
              >
                <option value="">Saját képeket töltök fel</option>
                {sourceGalleries.length > 0 ? (
                  <optgroup label="Meglévő teljes galériák">
                    {sourceGalleries.map((gallery) => (
                      <option key={gallery.id} value={`gallery:${gallery.id}`}>
                        {gallery.customerName ? `${gallery.customerName} · ` : ""}
                        {gallery.title} · {gallery.photoCount} média
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                {favoriteLists.length > 0 ? (
                  <optgroup label="Favorite listák">
                    {favoriteLists.map((list) => (
                      <option key={list.id} value={`favorite:${list.id}`}>
                        {list.gallery.title} · {list.name} · {list._count.items} kép
                      </option>
                    ))}
                  </optgroup>
                ) : null}
              </select>
            </label>
            {!standaloneMode ? (
              <label className="grid gap-1.5">
                <span className="text-xs font-medium uppercase tracking-[0.14em] text-graphite/55">3. Projekt</span>
                <select
                  name="projectId"
                  className="h-11 rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50"
                  defaultValue=""
                >
                  <option value="">Nincs projekthez kapcsolva</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.title}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <div className="grid gap-1.5">
              <span className="text-xs font-medium uppercase tracking-[0.14em] text-graphite/55">{standaloneMode ? "3." : "4."} Mentés</span>
              <FormSubmitButton className="h-11" pendingLabel="Létrehozás...">
                <Plus size={16} />
                Új albumterv
              </FormSubmitButton>
            </div>
          </div>
        </form>
        ) : null}
      </div>

      {activeWorkspaceView === "new" && favoriteLists.length === 0 && sourceGalleries.length === 0 ? (
        <div className="mt-5 rounded-md bg-paper px-4 py-4">
          <p className="text-sm font-medium text-ink">Nincs még választható meglévő képforrás</p>
          <p className="mt-1 text-sm text-graphite/70">
            Ettől még létre tudsz hozni albumtervet: válaszd a saját képek feltöltését, és dolgozz közvetlenül az albumtervezőből.
          </p>
        </div>
      ) : null}

      {activeWorkspaceView === "projects" ? designs.length === 0 ? (
        <div className="mt-5 rounded-md bg-paper px-4 py-4">
          <p className="text-sm font-medium text-ink">{standaloneMode ? "Még nincs önálló albumterv" : "Még nincs albumterv ehhez az ügyfélhez"}</p>
          <p className="mt-1 text-sm text-graphite/70">
            {standaloneMode
              ? "Indíts új online albumot, és hozz létre albumtervet saját képekből, meglévő galériából vagy favorite listából."
              : "Indíts új online albumot, és hozz létre albumtervet saját képekből, meglévő galériából vagy favorite listából."}
          </p>
        </div>
      ) : (
        <div className="mt-6">
          <div className="mb-3 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-graphite/55">Mentett album projektek</p>
              <h3 className="mt-1 text-base font-semibold text-ink">{designs.length} albumterv</h3>
            </div>
            <p className="text-sm text-graphite/60">Az albumtervek alapból csukva maradnak, a munkanézetet a Megnyitás után éred el.</p>
          </div>
          <div className="space-y-4">
          {designs.map((design, designIndex) => {
            const sourcePhotos = design.favoriteList?.items.map((item) => item.photo) ?? design.sourceGallery?.photos ?? [];
            const usesUploadedSource = design.sourceGallery?.galleryMode === GALLERY_MODE_ALBUM_SOURCE;
            const usesExistingGallerySource = !design.favoriteList && Boolean(design.sourceGallery) && !usesUploadedSource;
            const linkedProject = design.projectId ? projectById.get(design.projectId) : null;
            const linkedCustomer = design.customer ?? (linkedProject?.customerId ? customers.find((customer) => customer.id === linkedProject.customerId) : null);
            const sourceLabel = design.favoriteList
              ? `${design.favoriteList.gallery.title} · ${design.favoriteList.name}`
              : usesUploadedSource
                ? "saját album képek"
                : usesExistingGallerySource
                  ? design.sourceGallery?.title ?? "meglévő galéria"
                  : "hiányzó forrás";
            const sourceBadge = design.favoriteList
              ? `Favorite lista · ${design.favoriteList._count.items} kép`
              : usesUploadedSource
                ? `Saját feltöltés · ${sourcePhotos.length} kép`
                : usesExistingGallerySource
                  ? `Meglévő galéria · ${sourcePhotos.length} kép`
                  : "Hiányzó forrás";
            const openByDefault = design.id === selectedDesign?.id;

            return (
              <details key={design.id} name="album-design-projects" open={openByDefault} className="rounded-lg border border-ink/10 bg-paper shadow-sm">
                <summary className="flex cursor-pointer list-none flex-col justify-between gap-3 px-4 py-4 transition hover:bg-white/70 lg:flex-row lg:items-start [&::-webkit-details-marker]:hidden">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-ink">{design.title}</h3>
                      <span className="rounded-full bg-brass/10 px-2.5 py-1 text-xs font-medium text-brass">
                        {statusLabel(design.status)}
                      </span>
                      <span className="rounded-full bg-ink/5 px-2.5 py-1 text-xs font-medium text-graphite">
                        {design.spreads.length} oldalpár
                      </span>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${usesExistingGallerySource ? "bg-sage/10 text-sage" : "bg-ink/5 text-graphite"}`}>
                        {sourceBadge}
                      </span>
                      {standaloneMode ? (
                        linkedCustomer ? (
                          <span className="rounded-full bg-sage/10 px-2.5 py-1 text-xs font-medium text-sage">
                            {linkedCustomer.coupleName}
                          </span>
                        ) : (
                          <span className="rounded-full bg-brass/10 px-2.5 py-1 text-xs font-medium text-brass">
                            Ügyfél nélkül
                          </span>
                        )
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-graphite/70">Forrás: {sourceLabel}</p>
                  </div>
                  <span className="inline-flex h-10 shrink-0 items-center justify-center rounded-md border border-ink/10 bg-white px-3 text-sm font-medium text-ink">
                    Megnyitás
                  </span>
                </summary>
                <div className="border-t border-ink/10 p-4">
                <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      {linkedProject ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-sage/10 px-2.5 py-1 text-xs font-medium text-sage">
                          <FolderKanban size={13} />
                          {linkedProject.title}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/5 px-2.5 py-1 text-xs font-medium text-graphite">
                          <FolderKanban size={13} />
                          Nincs projekthez kapcsolva
                        </span>
                      )}
                    </div>
                    {design.favoriteList ? (
                      <p className="mt-1 text-sm text-graphite/60">
                        {design.favoriteList.email} · {design.favoriteList._count.items} kép · Leadva: {formatDate(design.favoriteList.submittedAt)}
                      </p>
                    ) : null}
                    {sourcePhotos.length > 0 || design.spreads.length > 0 ? (
                      <p className="mt-2 text-sm font-medium text-ink/80">
                        Az album szerkesztése csak teljes szélességű munkanézetben érhető el.
                      </p>
                    ) : null}
                    <form
                      action={updateAlbumDesignAssignmentAction.bind(null, customerId, design.id)}
                      className={`mt-3 grid max-w-3xl gap-2 sm:grid-cols-2 ${
                        standaloneMode ? "xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]" : "xl:grid-cols-[minmax(0,1fr)_auto]"
                      }`}
                    >
                      {standaloneMode ? (
                        <select
                          name="customerId"
                          defaultValue={design.customerId ?? ""}
                          className="h-10 min-w-0 rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50"
                        >
                          <option value="">Nincs ügyfélhez rendelve</option>
                          {customers.map((customer) => (
                            <option key={customer.id} value={customer.id}>
                              {customer.coupleName}
                            </option>
                          ))}
                        </select>
                      ) : null}
                      <select
                        name="projectId"
                        defaultValue={design.projectId ?? ""}
                        className="h-10 min-w-0 rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50"
                      >
                        <option value="">Nincs projekthez kapcsolva</option>
                        {projects.map((project) => (
                          <option key={project.id} value={project.id}>
                            {project.customerName ? `${project.customerName} · ${project.title}` : project.title}
                          </option>
                        ))}
                      </select>
                      <FormSubmitButton variant="secondary" className="h-10 px-3" pendingLabel="Mentés...">
                        Kapcsolat mentése
                      </FormSubmitButton>
                    </form>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {design.spreads.length > 0 ? (
                      <form action={exportAlbumDesignToReviewAction.bind(null, customerId, design.id)}>
                        <ConfirmSubmitButton
                          title="Album ellenőrző létrehozása"
                          message={
                            design.customerId
                              ? "Létrehozunk egy új album ellenőrzőt az albumterv JPG oldalpárjaiból. Mehet?"
                              : "Az albumtervet előbb ügyfélhez kell rendelni."
                          }
                          className="h-10 px-3"
                          disabled={!design.customerId}
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

                {usesUploadedSource && design.sourceGallery ? (
                  <details
                    open={sourcePhotos.length === 0 && design.spreads.length === 0}
                    className="mt-5 rounded-lg border border-dashed border-ink/20 bg-white"
                  >
                    <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-4 text-sm font-medium text-ink transition hover:bg-paper">
                      <span>Forrásképek feltöltése</span>
                      <span className="rounded-full bg-ink/5 px-2.5 py-1 text-xs text-graphite">{sourcePhotos.length} kép</span>
                    </summary>
                    <div className="border-t border-ink/10 p-4">
                      <PhotoUploadForm
                        galleryId={design.sourceGallery.id}
                        galleryMode={GALLERY_MODE_ALBUM_SOURCE}
                        defaultDeliveryStage={PHOTO_DELIVERY_STAGE_FINAL}
                        deliveryStageMode="fixed"
                        framed={false}
                        title="Album forrásképek feltöltése"
                        description="Töltsd fel azokat a fotókat, amikből az album oldalpárjait szeretnéd megtervezni. Feltöltés után az oldal frissül, és a képek választhatók lesznek az oldalpárokhoz."
                      />
                    </div>
                  </details>
                ) : null}

                {sourcePhotos.length === 0 && !usesUploadedSource ? (
                  <div className="mt-5 rounded-md bg-white px-4 py-4 text-sm text-graphite/70">
                    Ehhez az albumtervhez nincs elérhető forráskép.
                  </div>
                ) : null}

                {sourcePhotos.length > 0 || design.spreads.length > 0 ? (
                  <div>
                    <AlbumDesignWorkbench
                      customerId={customerId}
                      designId={design.id}
                      spreads={design.spreads}
                      sourcePhotos={sourcePhotos}
                      initialEditorOpen={initialEditorOpen && design.id === selectedDesign?.id}
                      initialActiveSpreadId={design.id === selectedDesign?.id ? activeSpreadId : null}
                    />
                  </div>
                ) : null}
                </div>
              </details>
            );
          })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
