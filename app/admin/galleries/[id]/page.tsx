import { notFound } from "next/navigation";
import { ExternalLink, KeyRound } from "lucide-react";
import { Alert } from "@/components/alert";
import { AdminShell } from "@/components/admin-shell";
import { Button, ButtonLink } from "@/components/button";
import { CopyClientLinkButton } from "@/components/copy-client-link-button";
import { CopyPublicLinkButton } from "@/components/copy-public-link-button";
import { DownloadLog } from "@/components/download-log";
import { FavoriteListsLog } from "@/components/favorite-lists-log";
import { GalleryDangerZone } from "@/components/gallery-danger-zone";
import { GalleryForm } from "@/components/gallery-form";
import { PhotoManager } from "@/components/photo-manager";
import { PhotoUploadForm } from "@/components/photo-upload-form";
import { StatCard } from "@/components/stat-card";
import { UploadSessionLog } from "@/components/upload-session-log";
import { ViewLog } from "@/components/view-log";
import { requireAdmin } from "@/lib/auth";
import { generateClientAccessLinkAction } from "@/lib/gallery-actions";
import { prisma } from "@/lib/prisma";

export default async function GalleryDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    activated?: string;
    archived?: string;
    coverSet?: string;
    clientLink?: string;
    clientRestored?: string;
    error?: string;
    ordered?: string;
    photoAdded?: string;
    photoError?: string;
    saved?: string;
  }>;
}) {
  await requireAdmin();

  const { id } = await params;
  const flags = await searchParams;
  const gallery = await prisma.gallery.findUnique({
    where: { id },
    include: {
      downloads: { orderBy: { createdAt: "desc" } },
      downloadPackages: {
        orderBy: { createdAt: "desc" },
        take: 5
      },
      favoriteLists: {
        orderBy: [{ submittedAt: "desc" }, { updatedAt: "desc" }],
        include: {
          items: {
            orderBy: { createdAt: "asc" },
            include: {
              photo: {
                select: {
                  id: true,
                  filename: true,
                  thumbnailUrl: true
                }
              }
            }
          }
        }
      },
      photos: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      uploadSessions: {
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          items: {
            where: { status: "failed" },
            orderBy: { updatedAt: "desc" },
            take: 25,
            select: {
              id: true,
              filename: true,
              status: true,
              errorMessage: true
            }
          }
        }
      },
      views: {
        orderBy: { createdAt: "desc" },
        take: 25
      },
      _count: {
        select: {
          favoriteLists: true,
          views: true
        }
      }
    }
  });

  if (!gallery) {
    notFound();
  }

  const latestView = gallery.views[0];
  const latestLocation = latestView
    ? [latestView.city, latestView.region, latestView.country].filter(Boolean).join(", ") || "Ismeretlen hely"
    : "Nincs adat";
  const hiddenByClientCount = gallery.photos.filter((photo) => photo.isClientHidden).length;

  return (
    <AdminShell>
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-brass">Galéria</p>
          <h1 className="mt-2 text-4xl font-semibold text-ink">{gallery.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <p className="text-sm text-graphite/70">/g/{gallery.slug}</p>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${gallery.isActive ? "bg-sage/15 text-sage" : "bg-ink/5 text-graphite"}`}>
              {gallery.isActive ? "Aktív" : "Archivált"}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <CopyPublicLinkButton slug={gallery.slug} />
          <ButtonLink href={`/g/${gallery.slug}`} variant="secondary">
            <ExternalLink size={16} />
            Publikus nézet
          </ButtonLink>
        </div>
      </div>

      <div className="mb-5 space-y-3">
        {flags.saved ? <Alert title="Galéria mentve." variant="success" /> : null}
        {flags.photoAdded ? <Alert title="Fotók feltöltve." variant="success" /> : null}
        {flags.coverSet ? <Alert title="Borítókép beállítva." variant="success" /> : null}
        {flags.clientLink ? <Alert title="Ügyfél kezelő link elkészítve." variant="success" /> : null}
        {flags.clientRestored ? <Alert title="Fotó visszaállítva a publikus galériába." variant="success" /> : null}
        {flags.ordered ? <Alert title="Fotósorrend frissítve." variant="success" /> : null}
        {flags.archived ? <Alert title="Galéria archiválva." variant="success">A publikus link most nem elérhető.</Alert> : null}
        {flags.activated ? <Alert title="Galéria aktiválva." variant="success">A publikus link újra elérhető.</Alert> : null}
        {flags.error === "slug" ? (
          <Alert title="Ez a slug már foglalt." variant="error">Adj meg egy egyedi publikus linket.</Alert>
        ) : null}
        {flags.error === "missing" ? <Alert title="Hiányzó kötelező mező." variant="error" /> : null}
        {flags.photoError === "missing" ? <Alert title="Nem választottál ki fotót." variant="error" /> : null}
        {flags.photoError === "storage" ? (
          <Alert title="A feltöltés nem sikerült." variant="error">
            Ellenőrizd az R2 bucket nevét, endpointját és a hozzáférési kulcsokat Vercelben.
          </Alert>
        ) : null}
      </div>

      <div className="space-y-8">
        <div className="grid gap-4 md:grid-cols-5">
          <StatCard label="Fotók" value={gallery.photos.length} detail="Feltöltött képek száma" />
          <StatCard label="Megtekintések" value={gallery._count.views} detail={`Legutóbbi: ${latestLocation}`} />
          <StatCard label="Kedvenc listák" value={gallery._count.favoriteLists} detail="Emailhez mentett válogatások" />
          <StatCard label="Elrejtve" value={hiddenByClientCount} detail="Ügyfél által publikusból kivéve" />
          <StatCard label="Állapot" value={gallery.isActive ? "Aktív" : "Archivált"} detail="Publikus elérhetőség" />
        </div>

        <GalleryForm gallery={gallery} />
        <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <div className="flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-brass">
                <KeyRound size={15} />
                Ügyfél kezelő
              </div>
              <h2 className="mt-2 text-xl font-semibold text-ink">Privát kezelő link a párnak</h2>
              <p className="mt-1 text-sm text-graphite/70">
                Ezen a linken a pár elrejtheti azokat a képeket, amelyeket nem szeretne a publikus galériában látni.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              {gallery.clientAccessToken ? (
                <CopyClientLinkButton slug={gallery.slug} token={gallery.clientAccessToken} />
              ) : (
                <form action={generateClientAccessLinkAction.bind(null, gallery.id)}>
                  <Button type="submit" variant="secondary">
                    <KeyRound size={16} />
                    Ügyfél link generálása
                  </Button>
                </form>
              )}
            </div>
          </div>
        </section>
        <GalleryDangerZone galleryId={gallery.id} isActive={gallery.isActive} />
        <PhotoUploadForm galleryId={gallery.id} />
        <UploadSessionLog sessions={gallery.uploadSessions} />
        <div className="grid items-start gap-6 xl:grid-cols-[1.4fr_1fr]">
          <ViewLog views={gallery.views} />
          <div className="space-y-6">
            <FavoriteListsLog lists={gallery.favoriteLists} />
            <DownloadLog downloads={gallery.downloads} packages={gallery.downloadPackages} />
          </div>
        </div>
        <PhotoManager coverPhotoId={gallery.coverPhotoId} galleryId={gallery.id} photos={gallery.photos} />
      </div>
    </AdminShell>
  );
}
