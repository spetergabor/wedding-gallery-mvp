import { notFound } from "next/navigation";
import { AlbumReviewBoard } from "@/components/album-review-board";
import { ensureAlbumReviewApprovalSchema } from "@/lib/album-review-actions";
import { normalizeCustomerLanguage } from "@/lib/customer-language";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AlbumReviewPage({
  params
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  await ensureAlbumReviewApprovalSchema();
  const review = await prisma.albumReview.findUnique({
    where: { accessToken: token },
    include: {
      customer: {
        select: {
          coupleName: true,
          preferredLanguage: true
        }
      },
      spreads: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          comments: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              spreadId: true,
              x: true,
              y: true,
              text: true,
              createdAt: true
            }
          }
        }
      }
    }
  });

  if (!review) {
    notFound();
  }

  if (review.status === "draft" || review.status === "ready") {
    await prisma.albumReview.update({
      where: { id: review.id },
      data: { status: "in_review" }
    });
  }

  const spreads = review.spreads.map((spread) => ({
    id: spread.id,
    title: spread.title,
    filename: spread.filename,
    imageUrl: spread.imageUrl,
    sortOrder: spread.sortOrder,
    approvedAt: spread.approvedAt?.toISOString() ?? null,
    comments: spread.comments.map((comment) => ({
      ...comment,
      createdAt: comment.createdAt.toISOString()
    }))
  }));
  const language = normalizeCustomerLanguage(review.customer.preferredLanguage);
  const copy =
    language === "hu"
      ? {
          area: "Album ellenőrzés",
          intro: "Kattintsatok közvetlenül az albumterv egyik pontjára, ha megjegyzést szeretnétek írni. Így a képcsere, javítás vagy kérés pontosan az adott oldalpárhoz kerül.",
          empty: "Ehhez az albumhoz még nincs feltöltött oldalpár."
        }
      : {
          area: "Albumfreigabe",
          intro: "Klicken Sie direkt auf eine Stelle im Albumlayout, um dort eine Notiz zu platzieren. So können Bildwechsel, Korrekturen oder Wünsche eindeutig markiert werden.",
          empty: "Für dieses Album wurden noch keine Seiten hochgeladen."
        };

  return (
    <main className="min-h-screen bg-paper text-ink">
      <header className="border-b border-ink/10 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <p className="text-sm uppercase tracking-[0.24em] text-brass">{copy.area}</p>
          <h1 className="mt-3 text-4xl font-semibold">{review.title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-graphite/70">
            {copy.intro}
          </p>
          <p className="mt-4 text-sm font-medium text-graphite">{review.customer.coupleName}</p>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8">
        {spreads.length === 0 ? (
          <div className="rounded-lg border border-ink/10 bg-white p-6 text-sm text-graphite/70 shadow-soft">
            {copy.empty}
          </div>
        ) : (
          <AlbumReviewBoard token={token} spreads={spreads} language={language} />
        )}
      </div>
    </main>
  );
}
