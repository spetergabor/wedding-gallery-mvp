import { notFound } from "next/navigation";
import Link from "next/link";
import { after } from "next/server";
import { Camera, Download, ExternalLink, Heart, KeyRound, MapPin, Settings } from "lucide-react";
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
import { ProofingStatusPanel } from "@/components/proofing-status-panel";
import { StatCard } from "@/components/stat-card";
import { UploadSessionLog } from "@/components/upload-session-log";
import { ViewLocationMap } from "@/components/view-location-map";
import { ViewLog } from "@/components/view-log";
import { ZipPreparationStatus } from "@/components/zip-preparation-status";
import { requireAdmin } from "@/lib/auth";
import { generateClientAccessLinkAction } from "@/lib/gallery-actions";
import { kickGalleryZipJob } from "@/lib/jobs";
import { prisma } from "@/lib/prisma";
import { isProofingGallery, proofingStatusLabel } from "@/lib/proofing";
import { createViewLocationPoints } from "@/lib/view-location-points";

type GalleryTab = "photos" | "client" | "views" | "downloads" | "settings";
type DownloadPackage = {
  id: string;
  status: string;
  updatedAt: Date;
};

const STALE_ZIP_PROCESSING_MS = 15 * 60 * 1000;

const galleryTabs: Array<{
  key: GalleryTab;
  label: string;
  icon: typeof Camera;
}> = [
  { key: "photos", label: "Fotók", icon: Camera },
  { key: "client", label: "Ügyfél válogatás", icon: Heart },
  { key: "views", label: "Megtekintések", icon: MapPin },
  { key: "downloads", label: "Letöltések", icon: Download },
  { key: "settings", label: "Beállítások", icon: Settings }
];

function getActiveTab(flags: {
  activated?: string;
  archived?: string;
  clientLink?: string;
  clientRestored?: string;
  error?: string;
  saved?: string;
  tab?: string;
}): GalleryTab {
  if (galleryTabs.some((tab) => tab.key === flags.tab)) {
    return flags.tab as GalleryTab;
  }

  if (flags.clientLink || flags.clientRestored) {
    return "client";
  }

  if (flags.saved || flags.archived || flags.activated || flags.error) {
    return "settings";
  }

  return "photos";
}

function queueZipPackageKick(galleryId: string, packages: DownloadPackage[]) {
  const now = Date.now();
  const packageToKick = packages.find(
    (downloadPackage) =>
      downloadPackage.status === "pending" ||
      (downloadPackage.status === "processing" && now - downloadPackage.updatedAt.getTime() > STALE_ZIP_PROCESSING_MS)
  );

  if (!packageToKick) {
    return;
  }

  after(async () => {
    await kickGalleryZipJob({
      galleryId,
      packageId: packageToKick.id
    });
  });
}

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
    proofingStatus?: string;
    saved?: string;
    tab?: string;
  }>;
}) {
  const admin = await requireAdmin();

  const { id } = await params;
  const flags = await searchParams;
  const gallery = await prisma.gallery.findFirst({
    where: {
      id,
      ...(admin.role === "super_admin" ? {} : { adminId: admin.id })
    },
    include: {
      downloads: { orderBy: { createdAt: "desc" } },
      downloadPackages: {
        orderBy: { createdAt: "desc" },
        take: 120
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
  const activeTab = getActiveTab(flags);
  const locationPoints = createViewLocationPoints(gallery.views);
  const proofingGallery = isProofingGallery(gallery.galleryMode);
  const galleryModeLabel = proofingGallery ? "Nyers válogatás" : "Teljes galéria";

  if (activeTab === "downloads") {
    queueZipPackageKick(gallery.id, gallery.downloadPackages);
  }

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
        {flags.proofingStatus ? <Alert title="Ügyfélválogató státusz frissítve." variant="success" /> : null}
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

      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-6">
          <StatCard label="Fotók" value={gallery.photos.length} detail="Feltöltött képek száma" />
          <StatCard label="Típus" value={galleryModeLabel} detail={proofingGallery ? proofingStatusLabel(gallery.proofingStatus) : "Kész galéria átadásra"} />
          <StatCard label="Megtekintések" value={gallery._count.views} detail={`Legutóbbi: ${latestLocation}`} />
          <StatCard label="Kedvenc listák" value={gallery._count.favoriteLists} detail="Emailhez mentett válogatások" />
          <StatCard label="Elrejtve" value={hiddenByClientCount} detail="Ügyfél által publikusból kivéve" />
          <StatCard label="Állapot" value={gallery.isActive ? "Aktív" : "Archivált"} detail="Publikus elérhetőség" />
        </div>

        <div className="rounded-lg border border-ink/10 bg-white p-2 shadow-soft">
          <nav className="grid gap-2 md:grid-cols-5" aria-label="Galéria részletek">
            {galleryTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;

              return (
                <Link
                  key={tab.key}
                  href={`/admin/galleries/${gallery.id}?tab=${tab.key}`}
                  className={`flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition ${
                    isActive ? "bg-ink text-white shadow-sm" : "text-graphite hover:bg-ink/5 hover:text-ink"
                  }`}
                >
                  <Icon size={16} />
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {activeTab === "photos" ? (
          <div className="space-y-8">
            <PhotoUploadForm galleryId={gallery.id} />
            <UploadSessionLog sessions={gallery.uploadSessions} />
            <PhotoManager coverPhotoId={gallery.coverPhotoId} galleryId={gallery.id} photos={gallery.photos} />
          </div>
        ) : null}

        {activeTab === "client" ? (
          <div className="max-w-4xl space-y-6">
            {proofingGallery ? (
              <ProofingStatusPanel
                galleryId={gallery.id}
                status={gallery.proofingStatus}
                updatedAt={gallery.proofingStatusUpdatedAt}
              />
            ) : null}
            <FavoriteListsLog lists={gallery.favoriteLists} />
          </div>
        ) : null}

        {activeTab === "views" ? (
          <div className="space-y-6">
            <ViewLog views={gallery.views} />
            <ViewLocationMap
              points={locationPoints}
              title="Album megtekintések térképe"
              description="Összesített helyszínek kizárólag ennek a galériának a publikus megnyitásaiból. Görgetéssel vagy csippentéssel nagyítható."
            />
          </div>
        ) : null}

        {activeTab === "downloads" ? (
          <div className="max-w-3xl space-y-6">
            <ZipPreparationStatus packages={gallery.downloadPackages} photoCount={gallery.photos.length} />
            <DownloadLog downloads={gallery.downloads} packages={gallery.downloadPackages.slice(0, 8)} />
          </div>
        ) : null}

        {activeTab === "settings" ? (
          <div className="space-y-8">
            <GalleryForm gallery={gallery} />
            <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div>
                  <div className="flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-brass">
                    <KeyRound size={15} />
                    Ügyfél kezelő
                  </div>
                  <h2 className="mt-2 text-xl font-semibold text-ink">Privát kezelő link az ügyfélnek</h2>
                  <p className="mt-1 text-sm text-graphite/70">
                    {proofingGallery
                      ? "Nyers válogatásnál ezen követhető az ügyfél kiválasztási folyamata."
                      : "Ezen a linken az ügyfél elrejtheti azokat a képeket, amelyeket nem szeretne a publikus galériában látni."}
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
          </div>
        ) : null}
      </div>
    </AdminShell>
  );
}
