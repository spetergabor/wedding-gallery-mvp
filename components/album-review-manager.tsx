import Image from "next/image";
import { CheckCircle2, ExternalLink, ImagePlus, MessageSquare, Plus, Trash2 } from "lucide-react";
import { AlbumSpreadUploadForm } from "@/components/album-spread-upload-form";
import { FormSubmitButton } from "@/components/form-submit-button";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { createAlbumReviewAction, deleteAlbumReviewAction, deleteAlbumReviewSpreadAction } from "@/lib/album-review-actions";
import { APP_TIME_ZONE } from "@/lib/date-format";

type AlbumReview = {
  id: string;
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

function albumLink(token: string) {
  return `/album/${token}`;
}

export function AlbumReviewManager({
  customerId,
  reviews
}: {
  customerId: string;
  reviews: AlbumReview[];
}) {
  return (
    <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
      <div className="flex flex-col justify-between gap-4 border-b border-ink/10 pb-5 md:flex-row md:items-start">
        <div>
          <div className="flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-brass">
            <ImagePlus size={15} />
            Egyéni albumterv
          </div>
          <h2 className="mt-2 text-xl font-semibold text-ink">Külső oldalpár képek feltöltése</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-graphite/70">
            Tölts fel SmartAlbumsból vagy más programból exportált JPG oldalpárokat. Az ügyfél a privát linken bárhova kattinthat a képen, és címkés megjegyzést írhat képcseréhez vagy javításhoz.
          </p>
        </div>
        <form action={createAlbumReviewAction.bind(null, customerId)} className="flex min-w-72 gap-2">
          <input
            name="title"
            placeholder="pl. Album v1"
            className="h-11 min-w-0 flex-1 rounded-md border border-ink/15 bg-paper px-3 text-sm text-ink outline-none transition focus:border-ink/50"
          />
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
            const commentCount = review.spreads.reduce((total, spread) => total + spread.comments.length, 0);
            const approvedCount = review.spreads.filter((spread) => spread.approvedAt).length;

            return (
              <article key={review.id} className="rounded-lg border border-ink/10 bg-paper p-4">
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-ink">{review.title}</h3>
                      <span className="rounded-full bg-brass/10 px-2.5 py-1 text-xs font-medium text-brass">
                        {statusLabels[review.status] ?? review.status}
                      </span>
                      <span className="rounded-full bg-ink/5 px-2.5 py-1 text-xs font-medium text-graphite">
                        {review.spreads.length} oldalpár · {commentCount} címke
                      </span>
                      {review.spreads.length > 0 ? (
                        <span className="rounded-full bg-brass/10 px-2.5 py-1 text-xs font-medium text-brass">
                          {approvedCount}/{review.spreads.length} rendben
                        </span>
                      ) : null}
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
                  </div>
                  <AlbumSpreadUploadForm customerId={customerId} reviewId={review.id} />
                </div>

                {review.spreads.length > 0 ? (
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    {review.spreads.map((spread) => (
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
                                <p className="font-medium text-ink">{spread.title ?? `Oldalpár ${spread.sortOrder}`}</p>
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
