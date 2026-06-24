import { notFound } from "next/navigation";
import { Camera, ShieldCheck } from "lucide-react";
import { ClientGalleryReview } from "@/components/client-gallery-review";
import { prisma } from "@/lib/prisma";
import {
  PHOTO_DELIVERY_STAGE_RAW,
  PROOFING_STATUS_IN_PROGRESS,
  PROOFING_STATUS_NOT_OPENED,
  isProofingGallery
} from "@/lib/proofing";
import { normalizeCustomerLanguage } from "@/lib/customer-language";

export default async function ClientGalleryReviewPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string; lang?: string }>;
}) {
  const [{ slug }, { token, lang }] = await Promise.all([params, searchParams]);

  if (!token) {
    notFound();
  }

  const gallery = await prisma.gallery.findFirst({
    where: {
      slug,
      clientAccessToken: token
    },
    include: {
      customer: {
        select: { preferredLanguage: true }
      },
      photos: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
      }
    }
  });

  if (!gallery) {
    notFound();
  }

  if (isProofingGallery(gallery.galleryMode) && gallery.proofingStatus === PROOFING_STATUS_NOT_OPENED) {
    await prisma.gallery.update({
      where: { id: gallery.id },
      data: {
        proofingStatus: PROOFING_STATUS_IN_PROGRESS,
        proofingStatusUpdatedAt: new Date()
      }
    });
  }
  const visiblePhotos = isProofingGallery(gallery.galleryMode)
    ? gallery.photos.filter((photo) => photo.deliveryStage === PHOTO_DELIVERY_STAGE_RAW)
    : gallery.photos;
  const language = normalizeCustomerLanguage(lang ?? gallery.customer?.preferredLanguage);

  return (
    <main className="min-h-screen bg-paper">
      <header className="border-b border-ink/10 bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-5 py-8 lg:px-8">
          <div className="flex items-center gap-2 text-sm uppercase tracking-[0.24em] text-brass">
            <ShieldCheck size={16} />
            Kundenbereich
          </div>
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h1 className="text-4xl font-semibold text-ink">{gallery.title}</h1>
              <p className="mt-3 max-w-2xl text-graphite/70">
                Hier legt ihr fest, welche Fotos Familie und Gäste in der öffentlichen Galerie sehen und herunterladen können. Geht die Auswahl in Ruhe durch und speichert sie am Ende.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-md bg-paper px-4 py-3 text-sm text-graphite">
              <Camera size={16} />
              {visiblePhotos.length} Fotos
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-7xl px-5 pb-32 pt-8 lg:px-8">
        <ClientGalleryReview
          galleryId={gallery.id}
          publicSlug={gallery.slug}
          title={gallery.title}
          token={token}
          language={language}
          photos={visiblePhotos}
        />
      </section>
    </main>
  );
}
