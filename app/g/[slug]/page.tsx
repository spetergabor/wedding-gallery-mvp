import { notFound } from "next/navigation";
import Image from "next/image";
import { Camera, Lock } from "lucide-react";
import { GalleryViewTracker } from "@/components/gallery-view-tracker";
import { PublicGallery } from "@/components/public-gallery";
import { SocialShareButtons } from "@/components/social-share-buttons";
import { prisma } from "@/lib/prisma";
import { canViewGallery, unlockGalleryAction } from "@/lib/public-actions";
import { Button } from "@/components/button";

function formatEventDate(date: Date | null) {
  if (!date) {
    return "Private Galerie";
  }

  return new Intl.DateTimeFormat("de-AT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);
}

export default async function PublicGalleryPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug } = await params;
  const flags = await searchParams;
  const gallery = await prisma.gallery.findUnique({
    where: { slug },
    include: { photos: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } }
  });

  if (!gallery || !gallery.isActive) {
    notFound();
  }

  const canView = await canViewGallery(slug, gallery.password);
  const visiblePhotos = gallery.photos.filter((photo) => !photo.isClientHidden);
  const coverPhoto =
    visiblePhotos.find((photo) => photo.id === gallery.coverPhotoId) ??
    visiblePhotos[0] ??
    null;
  const heroMeta = formatEventDate(gallery.eventDate);

  if (!canView) {
    return (
      <main className="grid min-h-screen place-items-center bg-paper px-5">
        <section className="w-full max-w-md rounded-lg border border-ink/10 bg-white p-7 text-center shadow-soft">
          <div className="mx-auto flex size-12 items-center justify-center rounded-md bg-ink text-white">
            <Lock size={20} />
          </div>
          <h1 className="mt-5 text-2xl font-semibold text-ink">{gallery.title}</h1>
          <p className="mt-2 text-sm text-graphite/70">Diese Galerie ist passwortgeschützt.</p>

          {flags.error ? (
            <div className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Das Galerie-Passwort ist nicht korrekt.
            </div>
          ) : null}

          <form action={unlockGalleryAction.bind(null, slug)} className="mt-6 space-y-4">
            <input
              name="password"
              type="password"
              required
              placeholder="Galerie-Passwort"
              className="h-12 w-full rounded-md border border-ink/15 bg-paper px-3 text-left outline-none transition focus:border-ink/50"
            />
            <Button type="submit" className="w-full">Galerie öffnen</Button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-paper">
      <GalleryViewTracker galleryId={gallery.id} />
      <header className="relative min-h-[72vh] overflow-hidden bg-ink text-white">
        {coverPhoto ? (
          <Image
            src={coverPhoto.previewUrl || coverPhoto.imageUrl}
            alt={gallery.title}
            fill
            priority
            quality={100}
            unoptimized
            className="object-cover"
            sizes="100vw"
          />
        ) : (
          <div className="absolute inset-0 bg-graphite" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-ink/35 via-ink/20 to-ink/70" />
        <div className="relative mx-auto flex min-h-[72vh] w-full max-w-7xl flex-col justify-end px-5 pb-14 pt-24 lg:px-8">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-sm uppercase tracking-[0.24em] text-white/80">
              <Camera size={16} />
              {heroMeta}
            </div>
            <h1 className="mt-5 text-5xl font-semibold text-white sm:text-6xl md:text-7xl">
              {gallery.title}
            </h1>
            <p className="mt-5 text-sm text-white/75">{visiblePhotos.length} Fotos</p>
            <div className="mt-6">
              <SocialShareButtons path={`/g/${gallery.slug}`} title={gallery.title} />
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto mt-8 w-full max-w-7xl px-5 pb-28 lg:px-8">
        {visiblePhotos.length > 0 ? (
          <PublicGallery galleryId={gallery.id} title={gallery.title} photos={visiblePhotos} />
        ) : (
          <div className="rounded-lg border border-ink/10 bg-white px-5 py-16 text-center text-sm text-graphite/70">
            Diese Galerie enthält noch keine Fotos.
          </div>
        )}
      </section>
    </main>
  );
}
