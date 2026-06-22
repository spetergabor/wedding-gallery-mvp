import Image from "next/image";
import { ExternalLink, ImagePlus, MessageSquare, Plus } from "lucide-react";
import { Button } from "@/components/button";
import { createAlbumReviewAction, uploadAlbumReviewSpreadsAction } from "@/lib/album-review-actions";

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
    timeStyle: "short"
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
            Album ellenőrző
          </div>
          <h2 className="mt-2 text-xl font-semibold text-ink">Album oldalpárok ellenőrzése</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-graphite/70">
            Tölts fel album oldalpár képeket. Az ügyfél a privát linken bárhova kattinthat a képen, és címkés megjegyzést írhat képcseréhez vagy javításhoz.
          </p>
        </div>
        <form action={createAlbumReviewAction.bind(null, customerId)} className="flex min-w-72 gap-2">
          <input
            name="title"
            placeholder="pl. Album v1"
            className="h-11 min-w-0 flex-1 rounded-md border border-ink/15 bg-paper px-3 text-sm text-ink outline-none transition focus:border-ink/50"
          />
          <Button type="submit">
            <Plus size={16} />
            Új
          </Button>
        </form>
      </div>

      {reviews.length === 0 ? (
        <div className="mt-5 rounded-md bg-paper px-4 py-4">
          <p className="text-sm font-medium text-ink">Még nincs album ellenőrző ehhez az ügyfélhez</p>
          <p className="mt-1 text-sm text-graphite/70">Hozd létre az első album ellenőrzőt, majd töltsd fel az oldalpár képeket.</p>
        </div>
      ) : (
        <div className="mt-5 space-y-6">
          {reviews.map((review) => {
            const commentCount = review.spreads.reduce((total, spread) => total + spread.comments.length, 0);

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
                    </div>
                    <p className="mt-1 text-sm text-graphite/70">Létrehozva: {formatDate(review.createdAt)}</p>
                    <a
                      href={albumLink(review.accessToken)}
                      target="_blank"
                      className="mt-3 inline-flex h-10 items-center justify-center gap-2 rounded-md border border-ink/15 bg-white px-3 text-sm font-medium text-ink transition hover:border-ink/30"
                    >
                      <ExternalLink size={15} />
                      Ügyfél album link megnyitása
                    </a>
                  </div>
                  <form action={uploadAlbumReviewSpreadsAction.bind(null, customerId, review.id)} className="rounded-md border border-ink/10 bg-white p-3">
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-graphite">Oldalpár képek feltöltése</span>
                      <input
                        name="albumSpreads"
                        type="file"
                        accept="image/*"
                        multiple
                        required
                        className="block w-full rounded-md border border-ink/15 bg-paper px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-ink file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
                      />
                    </label>
                    <Button type="submit" className="mt-3 w-full">
                      <ImagePlus size={16} />
                      Feltöltés
                    </Button>
                  </form>
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
                          <p className="font-medium text-ink">{spread.title ?? `Oldalpár ${spread.sortOrder}`}</p>
                          <p className="mt-1 truncate text-sm text-graphite/70">{spread.filename}</p>
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
