import Link from "next/link";
import { ArrowRight, ExternalLink, ImagePlus } from "lucide-react";

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

function clientAlbumHref(customerId: string, params: Record<string, string>) {
  const searchParams = new URLSearchParams({ tab: "album", ...params });
  return `/admin/clients/${customerId}?${searchParams.toString()}`;
}

export function AlbumOverviewDashboard({
  customerId,
  designs,
  reviews
}: {
  customerId: string;
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
          <h2 className="mt-2 text-xl font-semibold text-ink">Album áttekintés</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-graphite/70">
            Itt éred el az ügyfél összes albumtervét és ellenőrzőjét, függetlenül attól, hogy a Spetlyben készült vagy külső programból lett feltöltve.
          </p>
        </div>
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
          <p className="text-sm font-medium text-ink">Még nincs album ehhez az ügyfélhez.</p>
          <p className="mt-1 text-sm text-graphite/70">Az albumtervező vagy a feltöltött ellenőrzők munkaterületén tudsz új album munkát indítani.</p>
        </div>
      ) : (
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {designs.map((design) => {
            const usedImages = design.spreads.reduce((total, spread) => total + spread.items.length, 0);

            return (
              <Link
                key={design.id}
                href={clientAlbumHref(customerId, {
                  albumMode: "editor",
                  albumWorkspace: "projects",
                  albumDesignId: design.id,
                  albumEditor: "1"
                })}
                className="group rounded-lg border border-ink/10 bg-paper p-4 transition hover:border-ink/25 hover:bg-white"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-brass/10 px-2.5 py-1 text-xs font-medium text-brass">Spetly album</span>
                      <span className="rounded-full bg-ink/5 px-2.5 py-1 text-xs font-medium text-graphite">
                        {designStatusLabels[design.status] ?? design.status}
                      </span>
                    </div>
                    <h3 className="mt-3 truncate text-lg font-semibold text-ink">{design.title}</h3>
                    <p className="mt-1 text-sm text-graphite/70">
                      {design.spreads.length} oldalpár · {usedImages} kép használva
                    </p>
                  </div>
                  <span className="mt-1 inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-brass">
                    Szerkesztés
                    <ArrowRight size={14} className="transition group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            );
          })}

          {reviews.map((review) => {
            const approvedCount = review.spreads.filter((spread) => spread.approvedAt).length;
            const commentCount = review.spreads.reduce((total, spread) => total + spread.comments.length, 0);

            return (
              <div key={review.id} className="rounded-lg border border-ink/10 bg-paper p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-ink px-2.5 py-1 text-xs font-medium text-white">Külső ellenőrző</span>
                      <span className="rounded-full bg-ink/5 px-2.5 py-1 text-xs font-medium text-graphite">
                        {reviewStatusLabels[review.status] ?? review.status}
                      </span>
                    </div>
                    <h3 className="mt-3 truncate text-lg font-semibold text-ink">{review.title}</h3>
                    <p className="mt-1 text-sm text-graphite/70">
                      {review.spreads.length} oldalpár · {approvedCount}/{review.spreads.length} rendben · {commentCount} címke
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col">
                    <a
                      href={`/album/${review.accessToken}`}
                      target="_blank"
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-ink/15 bg-white px-3 text-sm font-medium text-ink transition hover:border-ink/30"
                    >
                      <ExternalLink size={14} />
                      Ügyfél link
                    </a>
                    <Link
                      href={`${clientAlbumHref(customerId, { albumMode: "upload" })}#album-review-${review.id}`}
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-ink px-3 text-sm font-medium text-white transition hover:bg-ink/90"
                    >
                      Kezelés
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
