import { notFound } from "next/navigation";
import { Camera, ShieldCheck } from "lucide-react";
import { ClientGalleryReview } from "@/components/client-gallery-review";
import { prisma } from "@/lib/prisma";

function clientDisplayUrl(photo: {
  imageUrl: string;
  thumbnailUrl: string;
  previewUrl: string;
  mediaType: string;
}) {
  if (photo.mediaType === "video") {
    return "";
  }

  if (photo.previewUrl && photo.previewUrl !== photo.imageUrl) {
    return photo.previewUrl;
  }

  if (photo.thumbnailUrl && photo.thumbnailUrl !== photo.imageUrl) {
    return photo.thumbnailUrl;
  }

  return "";
}

export default async function ClientGalleryReviewPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const [{ slug }, { token }] = await Promise.all([params, searchParams]);

  if (!token) {
    notFound();
  }

  const gallery = await prisma.gallery.findFirst({
    where: {
      slug,
      clientAccessToken: token
    },
    include: {
      photos: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
      }
    }
  });

  if (!gallery) {
    notFound();
  }

  const clientPhotos = gallery.photos.map((photo) => ({
    id: photo.id,
    filename: photo.filename,
    displayUrl: clientDisplayUrl(photo),
    mediaType: photo.mediaType,
    processingStatus: photo.processingStatus,
    isClientHidden: photo.isClientHidden
  }));

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
                Hier könnt ihr Fotos ausblenden, die nicht in der öffentlichen Galerie gezeigt werden sollen.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-md bg-paper px-4 py-3 text-sm text-graphite">
              <Camera size={16} />
              {gallery.photos.length} Fotos
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-7xl px-5 py-8 lg:px-8">
        <ClientGalleryReview
          galleryId={gallery.id}
          publicSlug={gallery.slug}
          title={gallery.title}
          token={token}
          photos={clientPhotos}
          watermarkEnabled={gallery.clientWatermarkEnabled}
          watermarkText={gallery.clientWatermarkText || gallery.title}
        />
      </section>
    </main>
  );
}
