import Link from "next/link";
import { ArrowRight, ExternalLink, ImagePlus, LayoutTemplate, Upload, X } from "lucide-react";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { deleteAlbumDesignAction } from "@/lib/album-design-actions";
import { deleteAlbumReviewAction } from "@/lib/album-review-actions";

type AlbumDashboardDesign = {
  id: string;
  title: string;
  status: string;
  spreads: Array<{
    id: string;
    items: Array<unknown>;
  }>;
};

type AlbumDashboardReview = {
  id: string;
  customerId: string;
  title: string;
  status: string;
  accessToken: string;
  spreads: Array<{
    id: string;
    approvedAt: Date | null;
    comments: Array<{ id: string }>;
  }>;
};

const designStatusLabels: Record<string, string> = {
  draft: "Tervezés alatt",
  ready: "Exportálható",
  exported: "Ellenőrző készült",
  archived: "Archivált"
};

const reviewStatusLabels: Record<string, string> = {
  draft: "Előkészítés",
  ready: "Ellenőrzésre kész",
  in_review: "Ügyfél ellenőrzi",
  approved: "Jóváhagyva",
  archived: "Archivált"
};

function albumWorkflowHref(customerId: string | null | undefined, params: Record<string, string>) {
  const searchParams = new URLSearchParams(customerId ? { tab: "album", ...params } : params);
  return customerId ? `/admin/clients/${customerId}?${searchParams.toString()}` : `/admin/albums?${searchParams.toString()}`;
}

export function AlbumOverviewDashboard({
  customerId,
  designs,
  reviews
}: {
  customerId?: string | null;
  designs: AlbumDashboardDesign[];
  reviews: AlbumDashboardReview[];
}) {
  const totalSpreads =
    designs.reduce((total, design) => total + design.spreads.length, 0) +
    reviews.reduce((total, review) => total + review.spreads.length, 0);
  const totalComments = reviews.reduce(
    (total, review) => total + review.spreads.reduce((spreadTotal, spread) => spreadTotal + spread.comments.length, 0),
    0
  );
  const hasAlbums = designs.length > 0 || reviews.length > 0;

  return (
    <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
      <div className="border-b border-ink/10 pb-5">
        <div>
          <div className="flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-brass">
            <ImagePlus size={15} />
            Albumok
          </div>
          <h2 className="mt-2 text-xl font-semibold text-ink">Album központ</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-graphite/70">
            Innen indítasz új album munkát, és itt éred el az összes meglévő Spetly albumot vagy feltöltött ellenőrzőt.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        <Link
          href={albumWorkflowHref(customerId, { albumMode: "editor", albumWorkspace: "new" })}
          className="group rounded-lg border border-ink/10 bg-ink p-5 text-white transition hover:bg-ink/90"
        >
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-white/10">
              <LayoutTemplate size={19} />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/55">Online album</p>
              <h3 className="mt-1 text-lg font-semibold">Spetlyben tervezem</h3>
              <p className="mt-1 text-sm leading-6 text-white/70">
                Válassz képeket meglévő galériából, favorite listából vagy saját feltöltésből, majd szerkeszd az oldalpárokat.
              </p>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-medium">
                Új online album
                <ArrowRight size={15} className="transition group-hover:translate-x-0.5" />
              </span>
            </div>
          </div>
        </Link>

        <Link
          href={albumWorkflowHref(customerId, { albumMode: "upload" })}
          className="group rounded-lg border border-ink/10 bg-paper p-5 transition hover:border-ink/25 hover:bg-white"
        >
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-white text-ink shadow-sm">
              <Upload size={19} />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-brass">Külső albumterv</p>
              <h3 className="mt-1 text-lg font-semibold text-ink">Kész oldalpárokat töltök fel</h3>
              <p className="mt-1 text-sm leading-6 text-graphite/70">
                SmartAlbumsból vagy más programból exportált JPG oldalpárokhoz készítesz ügyfél ellenőrző linket.
              </p>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-brass">
                Új ellenőrző
                <ArrowRight size={15} className="transition group-hover:translate-x-0.5" />
              </span>
            </div>
          </div>
        </Link>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-md bg-paper p-4">
          <p className="text-2xl font-semibold text-ink">{designs.length + reviews.length}</p>
          <p className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-graphite/55">Album munka</p>
        </div>
        <div className="rounded-md bg-paper p-4">
          <p className="text-2xl font-semibold text-ink">{totalSpreads}</p>
          <p className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-graphite/55">Oldalpár</p>
        </div>
        <div className="rounded-md bg-paper p-4">
          <p className="text-2xl font-semibold text-ink">{totalComments}</p>
          <p className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-graphite/55">Ügyfél címke</p>
        </div>
      </div>

      {!hasAlbums ? (
        <div className="mt-5 rounded-md border border-dashed border-ink/15 bg-paper px-4 py-5">
          <p className="text-sm font-medium text-ink">{customerId ? "Még nincs album ehhez az ügyfélhez." : "Még nincs album munka."}</p>
          <p className="mt-1 text-sm text-graphite/70">Válaszd ki felül, hogy online tervezel albumot, vagy kész oldalpárokat töltesz fel ellenőrzésre.</p>
        </div>
      ) : (
        <div className="mt-6">
          <div className="mb-3 flex flex-col justify-between gap-2 border-t border-ink/10 pt-5 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-graphite/55">Meglévő album munkák</p>
              <h3 className="mt-1 text-base font-semibold text-ink">{designs.length + reviews.length} album munka</h3>
            </div>
            <p className="text-sm text-graphite/60">Megnyitás után csak az adott album munkafelülete látszik.</p>
          </div>
          <div className="grid gap-3">
            {designs.map((design) => {
              const usedImages = design.spreads.reduce((total, spread) => total + spread.items.length, 0);

              return (
                <div
                  key={design.id}
                  className="rounded-lg border border-ink/10 bg-paper p-4 transition hover:border-ink/25 hover:bg-white"
                >
                  <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-brass/10 px-2.5 py-1 text-xs font-medium text-brass">Online album</span>
                        <span className="rounded-full bg-ink/5 px-2.5 py-1 text-xs font-medium text-graphite">
                          {designStatusLabels[design.status] ?? design.status}
                        </span>
                      </div>
                      <h3 className="mt-3 truncate text-lg font-semibold text-ink">{design.title}</h3>
                      <p className="mt-1 text-sm text-graphite/70">
                        {design.spreads.length} oldalpár · {usedImages} kép használva
                      </p>
                    </div>
                    <div className="flex items-center gap-2 sm:justify-end">
                      <Link
                        href={albumWorkflowHref(customerId, {
                          albumMode: "editor",
                          albumWorkspace: "projects",
                          albumDesignId: design.id,
                          albumEditor: "1"
                        })}
                        className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md bg-ink px-4 text-sm font-medium text-white transition hover:bg-ink/90"
                      >
                        Szerkesztés
                        <ArrowRight size={14} />
                      </Link>
                      <form action={deleteAlbumDesignAction.bind(null, customerId ?? null, design.id)}>
                        <ConfirmSubmitButton
                          message="Biztosan törlöd ezt az online albumot? Az összes hozzá tartozó tervezett oldalpár is törlődik."
                          variant="danger"
                          className="flex size-10 items-center justify-center p-0"
                          title="Online album törlése"
                          aria-label="Online album törlése"
                        >
                          <X size={17} />
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                  </div>
                </div>
              );
            })}

            {reviews.map((review) => {
              const approvedCount = review.spreads.filter((spread) => spread.approvedAt).length;
              const commentCount = review.spreads.reduce((total, spread) => total + spread.comments.length, 0);

              return (
                <div key={review.id} className="rounded-lg border border-ink/10 bg-paper p-4">
                  <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-ink px-2.5 py-1 text-xs font-medium text-white">Feltöltött ellenőrző</span>
                        <span className="rounded-full bg-ink/5 px-2.5 py-1 text-xs font-medium text-graphite">
                          {reviewStatusLabels[review.status] ?? review.status}
                        </span>
                      </div>
                      <h3 className="mt-3 truncate text-lg font-semibold text-ink">{review.title}</h3>
                      <p className="mt-1 text-sm text-graphite/70">
                        {review.spreads.length} oldalpár · {approvedCount}/{review.spreads.length} rendben · {commentCount} címke
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <a
                        href={`/album/${review.accessToken}`}
                        target="_blank"
                        className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md border border-ink/15 bg-white px-4 text-sm font-medium text-ink transition hover:border-ink/30"
                      >
                        <ExternalLink size={14} />
                        Ügyfél link
                      </a>
                      <Link
                        href={`${albumWorkflowHref(customerId, { albumMode: "upload" })}#album-review-${review.id}`}
                        className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md bg-ink px-4 text-sm font-medium text-white transition hover:bg-ink/90"
                      >
                        Kezelés
                        <ArrowRight size={14} />
                      </Link>
                      <form action={deleteAlbumReviewAction.bind(null, customerId ?? review.customerId, review.id)}>
                        <ConfirmSubmitButton
                          message="Biztosan törlöd ezt az album ellenőrzőt? Az összes oldalpár és ügyfél címke is törlődik."
                          variant="danger"
                          className="flex size-10 items-center justify-center p-0"
                          title="Album ellenőrző törlése"
                          aria-label="Album ellenőrző törlése"
                        >
                          <X size={17} />
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
