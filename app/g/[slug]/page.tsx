import { notFound } from "next/navigation";
import Image from "next/image";
import { Lock } from "lucide-react";
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

  const settings = await prisma.siteSettings.findFirst({
    where: {
      OR: [
        ...(gallery.adminId ? [{ adminId: gallery.adminId }] : []),
        ...(gallery.adminId ? [] : [{ id: "default" }])
      ]
    },
    select: { businessName: true, logoUrl: true }
  });

  const canView = await canViewGallery(slug, gallery.password);
  const visiblePhotos = gallery.photos.filter((photo) => !photo.isClientHidden);
  const coverPhoto =
    visiblePhotos.find((photo) => photo.id === gallery.coverPhotoId && photo.mediaType !== "video") ??
    visiblePhotos.find((photo) => photo.mediaType !== "video") ??
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
      <header className="relative min-h-[92vh] overflow-hidden bg-paper text-ink">
        <div className="absolute inset-0 overflow-hidden bg-ink">
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
          <div className="absolute inset-0 bg-ink/25" />
        </div>
        <div className="absolute inset-x-0 bottom-0 h-[70vh] bg-[linear-gradient(to_bottom,rgba(248,247,244,0)_0%,rgba(248,247,244,0.52)_34%,rgba(248,247,244,0.92)_58%,#f8f7f4_82%,#f8f7f4_100%)]" />
        <div className="relative mx-auto flex min-h-[92vh] w-full max-w-5xl flex-col items-center justify-end px-5 pb-16 pt-32 text-center lg:pb-20">
          <div className="flex w-full flex-col items-center">
            {settings?.logoUrl ? (
              <Image
                src={settings.logoUrl}
                alt={settings.businessName || "Logo"}
                width={190}
                height={90}
                unoptimized
                className="mb-5 max-h-20 w-auto object-contain"
              />
            ) : settings?.businessName ? (
              <p className="font-playfair mb-5 text-lg tracking-[0.18em] text-ink/75">
                {settings.businessName}
              </p>
            ) : null}
            <h1 className="font-playfair text-5xl font-semibold leading-tight text-ink sm:text-6xl md:text-7xl lg:text-8xl">
              {gallery.title}
            </h1>
            <p className="font-playfair mt-4 text-xl text-ink/75 md:text-2xl">{heroMeta}</p>
            <p className="mt-3 text-sm font-medium uppercase tracking-[0.24em] text-graphite/70">
              {visiblePhotos.length} Medien
            </p>
            <div className="mt-7 flex justify-center">
              <SocialShareButtons path={`/g/${gallery.slug}`} title={gallery.title} variant="card" />
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-7xl px-5 pb-28 lg:px-8">
        {visiblePhotos.length > 0 ? (
          <PublicGallery
            galleryId={gallery.id}
            title={gallery.title}
            photos={visiblePhotos}
            downloadsEnabled={gallery.downloadsEnabled}
          />
        ) : (
          <div className="rounded-lg border border-ink/10 bg-white px-5 py-16 text-center text-sm text-graphite/70">
            Diese Galerie enthält noch keine Fotos.
          </div>
        )}
      </section>
    </main>
  );
}
