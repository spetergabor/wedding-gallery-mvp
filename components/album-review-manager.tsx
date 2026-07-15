import Image from "next/image";
import { CheckCircle2, ExternalLink, FolderKanban, ImagePlus, MessageSquare, Plus, Trash2 } from "lucide-react";
import { AlbumSpreadUploadForm } from "@/components/album-spread-upload-form";
import { FormSubmitButton } from "@/components/form-submit-button";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import {
  createAlbumReviewAction,
  deleteAlbumReviewAction,
  deleteAlbumReviewSpreadAction,
  updateAlbumReviewProjectAction
} from "@/lib/album-review-actions";
import { APP_TIME_ZONE } from "@/lib/date-format";

type AlbumProjectOption = {
  id: string;
  title: string;
};

type AlbumReview = {
  id: string;
  projectId: string | null;
  title: string;
  status: string;
  accessToken: string;
  createdAt: Date;
  spreads: Array<{
    id: string;
    title: string | null;
    filename: string;
    imageUrl: string;
    sortOrder: number;
    approvedAt: Date | null;
    comments: Array<{
      id: string;
      x: number;
      y: number;
      text: string;
      createdAt: Date;
    }>;
  }>;
};

const statusLabels: Record<string, string> = {
  draft: "Előkészítés",
  ready: "Ellenőrzésre kész",
  in_review: "Ügyfél ellenőrzi",
  approved: "Jóváhagyva",
  archived: "Archivált"
};

function formatDate(date: Date) {
  return date.toLocaleString("hu-HU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: APP_TIME_ZONE
  });
}

function compareAlbumSpreadFilenames(left: AlbumReview["spreads"][number], right: AlbumReview["spreads"][number]) {
  return left.filename.localeCompare(right.filename, "hu", { numeric: true, sensitivity: "base" }) || left.sortOrder - right.sortOrder;
}

function displayAlbumSpreadTitle(title: string | null, index: number) {
  return !title || /^Oldalpár \d+$/i.test(title) ? `Oldalpár ${index + 1}` : title;
}

function albumLink(token: string) {
  return `/album/${token}`;
}

export function AlbumReviewManager({
  customerId,
  reviews,
  projects
}: {
  customerId: string;
  reviews: AlbumReview[];
  projects: AlbumProjectOption[];
}) {
  const projectById = new Map(projects.map((project) => [project.id, project]));

  return (
    <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
      <div className="flex flex-col justify-between gap-4 border-b border-ink/10 pb-5 md:flex-row md:items-start">
        <div>
          <div className="flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-brass">
            <ImagePlus size={15} />
            Feltöltött ellenőrzők
          </div>
          <h2 className="mt-2 text-xl font-semibold text-ink">Külső albumtervek kezelése</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-graphite/70">
            Hozz létre ellenőrzőt SmartAlbumsból vagy más programból exportált JPG oldalpárokhoz. A meglévő ellenőrzők felül, az album áttekintőben is elérhetők.
          </p>
        </div>
        <form action={createAlbumReviewAction.bind(null, customerId)} className="grid min-w-72 gap-2 rounded-md border border-ink/10 bg-paper p-3">
          <input
            name="title"
            placeholder="pl. Album v1"
            className="h-11 rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50"
          />
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
          <FormSubmitButton>
            <Plus size={16} />
            Új ellenőrző
          </FormSubmitButton>
        </form>
      </div>

      {reviews.length === 0 ? (
        <div className="mt-5 rounded-md bg-paper px-4 py-4">
          <p className="text-sm font-medium text-ink">Még nincs album ellenőrző ehhez az ügyfélhez</p>
          <p className="mt-1 text-sm text-graphite/70">Hozz létre egy ellenőrzőt, majd töltsd fel a külső programból exportált oldalpár JPG-ket.</p>
        </div>
      ) : (
        <div className="mt-5 space-y-6">
          {reviews.map((review) => {
            const orderedSpreads = [...review.spreads].sort(compareAlbumSpreadFilenames);
            const commentCount = orderedSpreads.reduce((total, spread) => total + spread.comments.length, 0);
            const approvedCount = orderedSpreads.filter((spread) => spread.approvedAt).length;
            const linkedProject = review.projectId ? projectById.get(review.projectId) : null;

            return (
              <article id={`album-review-${review.id}`} key={review.id} className="scroll-mt-28 rounded-lg border border-ink/10 bg-paper p-4">
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-ink">{review.title}</h3>
                      <span className="rounded-full bg-brass/10 px-2.5 py-1 text-xs font-medium text-brass">
                        {statusLabels[review.status] ?? review.status}
                      </span>
                      <span className="rounded-full bg-ink/5 px-2.5 py-1 text-xs font-medium text-graphite">
                        {orderedSpreads.length} oldalpár · {commentCount} címke
                      </span>
                      {orderedSpreads.length > 0 ? (
                        <span className="rounded-full bg-brass/10 px-2.5 py-1 text-xs font-medium text-brass">
                          {approvedCount}/{orderedSpreads.length} rendben
                        </span>
                      ) : null}
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
                    <p className="mt-1 text-sm text-graphite/70">Létrehozva: {formatDate(review.createdAt)}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <a
                        href={albumLink(review.accessToken)}
                        target="_blank"
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-ink/15 bg-white px-3 text-sm font-medium text-ink transition hover:border-ink/30"
                      >
                        <ExternalLink size={15} />
                        Ügyfél album link megnyitása
                      </a>
                      <form action={deleteAlbumReviewAction.bind(null, customerId, review.id)}>
                        <ConfirmSubmitButton
                          title="Album ellenőrző törlése"
                          message="Biztosan törlöd ezt az album ellenőrzőt? Az összes oldalpár és ügyfél címke is törlődik."
                          variant="danger"
                          className="h-10 px-3"
                        >
                          <Trash2 size={15} />
                          Ellenőrző törlése
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                    <form action={updateAlbumReviewProjectAction.bind(null, customerId, review.id)} className="mt-3 flex max-w-xl flex-col gap-2 sm:flex-row">
                      <select
                        name="projectId"
                        defaultValue={review.projectId ?? ""}
                        className="h-10 min-w-0 flex-1 rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50"
                      >
                        <option value="">Nincs projekthez kapcsolva</option>
                        {projects.map((project) => (
                          <option key={project.id} value={project.id}>
                            {project.title}
                          </option>
                        ))}
                      </select>
                      <FormSubmitButton variant="secondary" className="h-10 px-3" pendingLabel="Mentés...">
                        Projekt mentése
                      </FormSubmitButton>
                    </form>
                  </div>
                  <AlbumSpreadUploadForm customerId={customerId} reviewId={review.id} />
                </div>

                {orderedSpreads.length > 0 ? (
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    {orderedSpreads.map((spread, spreadIndex) => (
                      <div key={spread.id} className="overflow-hidden rounded-md border border-ink/10 bg-white">
                        <div className="relative aspect-[3/2] bg-mist">
                          <Image
                            src={spread.imageUrl}
                            alt={spread.title ?? spread.filename}
                            fill
                            unoptimized
                            sizes="(min-width: 1024px) 50vw, 100vw"
                            className="object-contain"
                          />
                          {spread.comments.map((comment, index) => (
                            <div
                              key={comment.id}
                              className="absolute max-w-[70%] -translate-x-2 -translate-y-2 rounded-md bg-ink px-2 py-1 text-xs font-medium text-white shadow-soft"
                              style={{ left: `${comment.x}%`, top: `${comment.y}%` }}
                            >
                              {index + 1}. {comment.text}
                            </div>
                          ))}
                        </div>
                        <div className="p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium text-ink">{displayAlbumSpreadTitle(spread.title, spreadIndex)}</p>
                                {spread.approvedAt ? (
                                  <span className="inline-flex items-center gap-1.5 rounded-full bg-brass/10 px-2.5 py-1 text-xs font-medium text-brass">
                                    <CheckCircle2 size={13} />
                                    Ügyfél szerint rendben
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-1 truncate text-sm text-graphite/70">{spread.filename}</p>
                            </div>
                            <form action={deleteAlbumReviewSpreadAction.bind(null, customerId, review.id, spread.id)} className="shrink-0">
                              <ConfirmSubmitButton
                                title="Oldalpár törlése"
                                message="Biztosan törlöd ezt az album oldalpárt? A hozzá tartozó ügyfél címkék is törlődnek."
                                variant="danger"
                                className="h-9 px-3"
                              >
                                <Trash2 size={15} />
                                Törlés
                              </ConfirmSubmitButton>
                            </form>
                          </div>
                          {spread.comments.length > 0 ? (
                            <div className="mt-3 space-y-2">
                              {spread.comments.map((comment, index) => (
                                <div key={comment.id} className="flex gap-2 rounded-md bg-paper px-3 py-2 text-sm text-graphite">
                                  <MessageSquare size={15} className="mt-0.5 shrink-0 text-brass" />
                                  <span>
                                    <span className="font-medium text-ink">{index + 1}.</span> {comment.text}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
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
