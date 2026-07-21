import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Camera, Check, Columns3, CreditCard, Download, ExternalLink, Heart, KeyRound, Landmark, Mail, Palette, Plus, Share2, UserRound } from "lucide-react";
import { Alert } from "@/components/alert";
import { AdminShell } from "@/components/admin-shell";
import { ButtonLink } from "@/components/button";
import { FormSubmitButton } from "@/components/form-submit-button";
import { CoverPositionControl } from "@/components/cover-position-control";
import { CopyPublicLinkButton } from "@/components/copy-public-link-button";
import { DownloadLog } from "@/components/download-log";
import { FavoriteListsLog } from "@/components/favorite-lists-log";
import { GallerySectionSortableList } from "@/components/gallery-section-sortable-list";
import { GalleryDangerZone } from "@/components/gallery-danger-zone";
import { GalleryForm } from "@/components/gallery-form";
import { GalleryTabController } from "@/components/gallery-tab-controller";
import { ManualZipUploadForm } from "@/components/manual-zip-upload-form";
import { MediaProcessingStatus } from "@/components/media-processing-status";
import { PhotoManager } from "@/components/photo-manager";
import { PhotoUploadForm } from "@/components/photo-upload-form";
import { ProofingStatusPanel } from "@/components/proofing-status-panel";
import { UploadSessionLog } from "@/components/upload-session-log";
import { ViewLocationMap } from "@/components/view-location-map";
import { ViewLog } from "@/components/view-log";
import { ZipPreparationStatus } from "@/components/zip-preparation-status";
import { requireAdmin } from "@/lib/auth";
import { adminOwnedWhere, albumDesignOwnedWhere, ownerAdminId } from "@/lib/admin-scope";
import { customerTypeLabel } from "@/lib/customer-options";
import { APP_TIME_ZONE } from "@/lib/date-format";
import { publicGalleryUrl } from "@/lib/email";
import { PUBLIC_DOWNLOAD_SCOPE } from "@/lib/download-packages";
import {
  createGallerySectionAction,
  sendFinalDeliveryEmailAction,
  sendProofingInviteAction,
  updateGalleryDesignAction,
  updateGalleryProofingStatusAction
} from "@/lib/gallery-actions";
import { prisma } from "@/lib/prisma";
import { GALLERY_DESIGN_COVER_STICKY, GALLERY_DESIGNS, normalizeGalleryDesign } from "@/lib/gallery-design";
import { galleryTextColorOrDefault } from "@/lib/gallery-appearance";
import { galleryDeliveryAllowsDownloads, galleryDeliveryLabel, galleryDeliveryUsesPayment } from "@/lib/gallery-delivery";
import { paidGalleryScope } from "@/lib/gallery-sales-shared";
import {
  GALLERY_MODE_ALBUM_SOURCE,
  PHOTO_DELIVERY_STAGE_FINAL,
  PROOFING_STATUS_DELIVERED,
  defaultPhotoDeliveryStageForGalleryMode,
  isProofingGallery
} from "@/lib/proofing";
import { createViewLocationPoints } from "@/lib/view-location-points";

type GalleryTab = "photos" | "client" | "views" | "downloads" | "appearance" | "settings";

const galleryTabs: Array<{
  key: GalleryTab;
  label: string;
  icon: "Camera" | "Heart" | "MapPin" | "Download" | "Palette" | "Settings";
}> = [
  { key: "photos", label: "Fotók", icon: "Camera" },
  { key: "client", label: "Kedvenc listák", icon: "Heart" },
  { key: "views", label: "Megtekintések", icon: "MapPin" },
  { key: "downloads", label: "Letöltések", icon: "Download" },
  { key: "appearance", label: "Megjelenés", icon: "Palette" },
  { key: "settings", label: "Beállítások", icon: "Settings" }
];

const sectionMetaClass = "text-xs font-medium uppercase tracking-[0.16em] text-graphite/65";

type ZipHandoffState = "none" | "manual_ready" | "online_ready" | "processing" | "stale";

function isCompleteZipPackageGroup(
  packages: Array<{
    id: string;
    groupId: string | null;
    partIndex: number;
    partCount: number;
    status: string;
    downloadUrl: string | null;
    r2Key: string | null;
  }>
) {
  if (packages.length === 0) {
    return false;
  }

  const expectedPartCount = Math.max(...packages.map((downloadPackage) => downloadPackage.partCount), packages.length, 1);
  const completedPartIndexes = new Set(
    packages
      .filter((downloadPackage) => downloadPackage.status === "completed" && downloadPackage.downloadUrl && downloadPackage.r2Key)
      .map((downloadPackage) => downloadPackage.partIndex)
  );

  return Array.from({ length: expectedPartCount }, (_, index) => completedPartIndexes.has(index)).every(Boolean);
}

function getZipHandoffState(
  packages: Array<{
    id: string;
    groupId: string | null;
    scope: string;
    status: string;
    partIndex: number;
    partCount: number;
    downloadUrl: string | null;
    r2Key: string | null;
    generatedAt: Date | null;
    updatedAt: Date;
  }>,
  scope = PUBLIC_DOWNLOAD_SCOPE
): { state: ZipHandoffState; detail: string | null } {
  const publicPackages = packages.filter((downloadPackage) => downloadPackage.scope === scope);
  const manualReadyPackage = publicPackages.find(
    (downloadPackage) =>
      downloadPackage.status === "completed" &&
      Boolean(downloadPackage.downloadUrl) &&
      Boolean(downloadPackage.r2Key?.includes("/downloads/manual/"))
  );

  if (manualReadyPackage) {
    const date = manualReadyPackage.generatedAt ?? manualReadyPackage.updatedAt;
    return {
      state: "manual_ready",
      detail: `Saját ZIP feltöltve: ${date.toLocaleString("hu-HU", { timeZone: APP_TIME_ZONE })}`
    };
  }

  const groups = new Map<string, typeof publicPackages>();

  for (const downloadPackage of publicPackages) {
    const key = downloadPackage.groupId ?? downloadPackage.id;
    groups.set(key, [...(groups.get(key) ?? []), downloadPackage]);
  }

  const completedGroup = Array.from(groups.values()).find(isCompleteZipPackageGroup);

  if (completedGroup) {
    const latestDate = completedGroup.reduce((latest, downloadPackage) => {
      const date = downloadPackage.generatedAt ?? downloadPackage.updatedAt;
      return date > latest ? date : latest;
    }, completedGroup[0]?.updatedAt ?? new Date(0));

    return {
      state: "online_ready",
      detail: `Online ZIP elkészült: ${latestDate.toLocaleString("hu-HU", { timeZone: APP_TIME_ZONE })}`
    };
  }

  if (publicPackages.some((downloadPackage) => downloadPackage.status === "pending" || downloadPackage.status === "processing")) {
    return {
      state: "processing",
      detail: "A ZIP készítés folyamatban van. A részletes állapot a Letöltések fülön látszik."
    };
  }

  const stalePackage = publicPackages
    .filter((downloadPackage) => downloadPackage.status === "stale")
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];

  if (stalePackage) {
    return {
      state: "stale",
      detail: `A korábbi ZIP elavult: ${stalePackage.updatedAt.toLocaleString("hu-HU", { timeZone: APP_TIME_ZONE })}`
    };
  }

  return { state: "none", detail: null };
}

function getActiveTab(flags: {
  activated?: string;
  archived?: string;
  coverPosition?: string;
  design?: string;
  deliveryEmail?: string;
  zip?: string;
  error?: string;
  mediaProcessing?: string;
  proofingInvite?: string;
  saved?: string;
  tab?: string;
}): GalleryTab {
  if (galleryTabs.some((tab) => tab.key === flags.tab)) {
    return flags.tab as GalleryTab;
  }

  if (flags.coverPosition || flags.design) {
    return "appearance";
  }

  if (flags.proofingInvite || flags.deliveryEmail) {
    return "client";
  }

  if (flags.saved || flags.archived || flags.activated || flags.error) {
    return "settings";
  }

  return "photos";
}

export default async function GalleryDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    activated?: string;
    archived?: string;
    coverPosition?: string;
    coverSet?: string;
    design?: string;
    deliveryEmail?: string;
    downloadEmail?: string;
    zip?: string;
    duplicateCleanup?: string;
    error?: string;
    mediaProcessing?: string;
    ordered?: string;
    photoAdded?: string;
    photoError?: string;
    photoSearch?: string;
    photoSet?: string;
    proofingInvite?: string;
    proofingStatus?: string;
    bulkDelete?: string;
    bulkMove?: string;
    sectionCreated?: string;
    sectionDeleted?: string;
    sectionOrdered?: string;
    sectionError?: string;
    saved?: string;
    tab?: string;
    videoThumbnail?: string;
  }>;
}) {
  const admin = await requireAdmin();

  const { id } = await params;
  const flags = await searchParams;
  const gallery = await prisma.gallery.findFirst({
    where: {
      id,
      ...adminOwnedWhere(admin)
    },
    include: {
      downloads: {
        orderBy: { createdAt: "desc" },
        include: {
          package: {
            select: {
              id: true,
              groupId: true,
              scope: true,
              status: true,
              partIndex: true,
              partCount: true,
              fileSize: true,
              downloadUrl: true,
              errorMessage: true,
              generatedAt: true,
              updatedAt: true
            }
          }
        }
      },
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
      mediaProcessingJobs: {
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          photoId: true,
          status: true,
          attempts: true,
          errorMessage: true,
          claimedAt: true,
          completedAt: true,
          updatedAt: true
        }
      },
      sections: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
      photos: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          section: {
            select: {
              id: true,
              title: true,
              slug: true
            }
          }
        }
      },
      customer: {
        select: {
          id: true,
          customerType: true,
          coupleName: true,
          primaryEmail: true,
          preferredLanguage: true
        }
      },
      project: {
        select: {
          id: true,
          customerId: true,
          title: true,
          projectType: true
        }
      },
      uploadSessions: {
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          section: {
            select: {
              id: true,
              title: true
            }
          },
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
      admin: {
        select: {
          siteSettings: {
            select: {
              publicSubdomain: true
            }
          }
        }
      }
    }
  });

  if (!gallery) {
    notFound();
  }

  if (gallery.galleryMode === GALLERY_MODE_ALBUM_SOURCE) {
    const sourceDesign = await prisma.albumDesign.findFirst({
      where: {
        sourceGalleryId: gallery.id,
        ...albumDesignOwnedWhere(admin)
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        customerId: true
      }
    });

    if (sourceDesign?.customerId) {
      redirect(
        `/admin/clients/${sourceDesign.customerId}?tab=album&albumMode=editor&albumWorkspace=projects&albumDesignId=${sourceDesign.id}&albumEditor=1`
      );
    }

    if (sourceDesign) {
      redirect(`/admin/albums?albumMode=editor&albumWorkspace=projects&albumDesignId=${sourceDesign.id}&albumEditor=1`);
    }

    redirect("/admin/albums");
  }

  const stripeIntegration = await prisma.stripeConnectIntegration.findUnique({
    where: { adminId: ownerAdminId(admin) },
    select: { chargesEnabled: true }
  });

  const customers = await prisma.customer.findMany({
    where: adminOwnedWhere(admin),
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      customerType: true,
      coupleName: true,
      primaryEmail: true,
      weddingDate: true
    }
  });
  const projects = await prisma.customerProject.findMany({
    where: {
      customer: adminOwnedWhere(admin)
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      customerId: true,
      title: true,
      projectType: true,
      eventDate: true,
      venue: true,
      customer: {
        select: {
          coupleName: true
        }
      }
    }
  });

  const activeTab = getActiveTab(flags);
  const locationPoints = createViewLocationPoints(gallery.views);
  const proofingGallery = isProofingGallery(gallery.galleryMode);
  const renderedGalleryTabs = galleryTabs.map((tab) => ({
    ...tab,
    label: tab.key === "client" ? (proofingGallery ? "Válogatás" : "Kedvenc listák") : tab.label
  }));
  const rawPhotoCount = gallery.photos.filter((photo) => photo.deliveryStage === "raw").length;
  const finalPhotoCount = gallery.photos.filter((photo) => photo.deliveryStage === "final").length;
  const selectedPhotoIds = Array.from(
    new Set(gallery.favoriteLists.flatMap((list) => list.items.map((item) => item.photo.id)))
  );
  const submittedListCount = gallery.favoriteLists.filter((list) => list.submittedAt).length;
  const paidGallery = galleryDeliveryUsesPayment(gallery.deliveryMode);
  const selectedGalleryDesign = normalizeGalleryDesign(gallery.galleryDesign);
  const selectedGalleryDesignLabel =
    GALLERY_DESIGNS.find((design) => design.key === selectedGalleryDesign)?.label ?? "Timeless";
  const selectedGalleryTextColor = galleryTextColorOrDefault(
    gallery.galleryTextColor,
    selectedGalleryDesign === GALLERY_DESIGN_COVER_STICKY ? "#ffffff" : "#111111"
  );
  const activeDownloadScope = paidGallery ? paidGalleryScope(gallery.id) : PUBLIC_DOWNLOAD_SCOPE;
  const canPrepareZip =
    (paidGallery || (gallery.downloadsEnabled && galleryDeliveryAllowsDownloads(gallery.deliveryMode))) &&
    gallery.photos.length > 0 &&
    (!proofingGallery || gallery.proofingStatus === PROOFING_STATUS_DELIVERED);
  const publicDownloadPackages = gallery.downloadPackages.filter((downloadPackage) => downloadPackage.scope === activeDownloadScope);
  const publicDownloadEntries = gallery.downloads.filter((download) => !download.package || download.package.scope === activeDownloadScope);
  const zipHandoff = getZipHandoffState(publicDownloadPackages, activeDownloadScope);
  const resumableUploadSessions = gallery.uploadSessions
    .filter((session) => session.status !== "completed" && session.totalCount > 0 && session.completedCount < session.totalCount)
    .map((session) => ({
      id: session.id,
      status: session.status,
      deliveryStage: session.deliveryStage,
      totalCount: session.totalCount,
      uploadedCount: session.uploadedCount,
      completedCount: session.completedCount,
      failedCount: session.failedCount,
      sectionId: session.sectionId,
      sectionTitle: session.section?.title ?? null,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString()
    }));
  const sectionPhotoCounts = new Map<string, number>();

  for (const photo of gallery.photos) {
    if (photo.sectionId) {
      sectionPhotoCounts.set(photo.sectionId, (sectionPhotoCounts.get(photo.sectionId) ?? 0) + 1);
    }
  }
  const coverPhoto = gallery.photos.find((photo) => photo.id === gallery.coverPhotoId) || gallery.photos[0];
  const designPreviewCoverPhoto =
    (coverPhoto?.mediaType !== "video" ? coverPhoto : null) ??
    gallery.photos.find((photo) => photo.mediaType !== "video") ??
    null;
  const coverPositionControlProps =
    coverPhoto && coverPhoto.mediaType !== "video"
      ? {
          galleryId: gallery.id,
          imageUrl: coverPhoto.previewUrl || coverPhoto.imageUrl,
          imageAlt: coverPhoto.filename,
          initialX: gallery.coverPositionX ?? 50,
          initialY: gallery.coverPositionY ?? 50
        }
      : null;
  const publicSubdomain = gallery.admin.siteSettings?.publicSubdomain ?? null;
  const galleryPublicUrl = publicGalleryUrl(gallery.slug, gallery.customer?.preferredLanguage, publicSubdomain);

  return (
    <AdminShell>
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className={sectionMetaClass}>Galéria</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">{gallery.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <p className="text-sm text-graphite/70">/g/{gallery.slug}</p>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${gallery.isActive ? "bg-sage/15 text-sage" : "bg-ink/5 text-graphite"}`}>
              {gallery.isActive ? "Aktív" : "Archivált"}
            </span>
            <span className="rounded-full bg-brass/10 px-3 py-1 text-xs font-medium text-brass">
              {galleryDeliveryLabel(gallery.deliveryMode)}
            </span>
            {gallery.customer ? (
              <Link
                href={`/admin/clients/${gallery.customer.id}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-ink/5 px-3 py-1 text-xs font-medium text-graphite hover:bg-ink/10"
              >
                <UserRound size={13} />
                {gallery.customer.coupleName} · {customerTypeLabel(gallery.customer.customerType)}
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
                <UserRound size={13} />
                Nincs ügyfélhez rendelve
              </span>
            )}
            {gallery.project ? (
              <Link
                href={`/admin/clients/${gallery.project.customerId}?tab=projects`}
                className="inline-flex items-center gap-1.5 rounded-full bg-brass/10 px-3 py-1 text-xs font-medium text-brass hover:bg-brass/15"
              >
                <Camera size={13} />
                {gallery.project.title}
              </Link>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <CopyPublicLinkButton slug={gallery.slug} url={galleryPublicUrl} variant="primary" />
          <ButtonLink href={galleryPublicUrl} variant="secondary">
            <ExternalLink size={16} />
            Publikus nézet
          </ButtonLink>
        </div>
      </div>
      <div className="mb-6">
        <GalleryTabController tabs={renderedGalleryTabs} initialTab={activeTab} />
      </div>

      <div className="mb-5 space-y-3">
        {flags.saved ? <Alert title="Galéria mentve." variant="success" /> : null}
        {flags.photoAdded ? <Alert title="Fotók feltöltve." variant="success" /> : null}
        {flags.bulkDelete && flags.bulkDelete !== "none" ? <Alert title={`${flags.bulkDelete} kép törölve.`} variant="success" /> : null}
        {flags.bulkDelete === "none" ? <Alert title="Nem volt törölhető kijelölt kép." variant="error" /> : null}
        {flags.bulkMove && flags.bulkMove !== "none" && flags.bulkMove !== "section" ? <Alert title={`${flags.bulkMove} kép áthelyezve.`} variant="success" /> : null}
        {flags.bulkMove === "none" ? <Alert title="Nem volt áthelyezhető kijelölt kép." variant="error" /> : null}
        {flags.bulkMove === "section" ? <Alert title="A kiválasztott címke nem található." variant="error" /> : null}
        {flags.sectionCreated ? <Alert title="Címke létrehozva." variant="success" /> : null}
        {flags.sectionDeleted ? <Alert title="Címke törölve." variant="success">A benne lévő képek az általános galériában maradtak.</Alert> : null}
        {flags.sectionOrdered ? <Alert title="Címke sorrend mentve." variant="success" /> : null}
        {flags.sectionError === "missing" ? <Alert title="Adj meg egy címke nevet." variant="error" /> : null}
        {flags.sectionError === "order" ? <Alert title="A címkék sorrendjét nem sikerült menteni." variant="error" /> : null}
        {flags.duplicateCleanup && flags.duplicateCleanup !== "none" ? (
          <Alert title={`${flags.duplicateCleanup} duplikált fotó törölve.`} variant="success" />
        ) : null}
        {flags.duplicateCleanup === "none" ? <Alert title="Nem találtam törölhető duplikátumot." variant="info" /> : null}
        {flags.mediaProcessing === "queued" ? <Alert title="Hiányzó előnézetek újra sorba állítva." variant="success" /> : null}
        {flags.mediaProcessing === "none" ? <Alert title="Nincs újraindítható előnézet." variant="info" /> : null}
        {flags.videoThumbnail === "updated" ? <Alert title="Videó thumbnail mentve." variant="success" /> : null}
        {flags.videoThumbnail === "missing" ? <Alert title="Válassz ki egy képet a videó thumbnailhez." variant="error" /> : null}
        {flags.videoThumbnail === "missing-photo" ? <Alert title="A videó nem található." variant="error" /> : null}
        {flags.videoThumbnail === "type" ? <Alert title="A videó thumbnail csak képfájl lehet." variant="error" /> : null}
        {flags.videoThumbnail === "not-video" ? <Alert title="Thumbnailt csak videóhoz tudsz beállítani." variant="error" /> : null}
        {flags.videoThumbnail === "storage" ? <Alert title="A videó thumbnail feltöltése nem sikerült." variant="error" /> : null}
        {flags.zip === "queued" ? <Alert title="ZIP csomag feldolgozásra beütemezve." variant="success" /> : null}
        {flags.zip === "manual-uploaded" ? <Alert title="Kész ZIP feltöltve." variant="success">A vendég letöltés most ezt a csomagot használja.</Alert> : null}
        {flags.zip === "already-running" ? <Alert title="A ZIP készítése már fut." variant="info" /> : null}
        {flags.zip === "already-ready" ? <Alert title="A ZIP már kész, újraindításra nem volt szükség." variant="success" /> : null}
        {flags.zip === "deleted" ? <Alert title="ZIP csomag törölve." variant="success">A hozzá tartozó R2 fájlok is törölve lettek.</Alert> : null}
        {flags.zip === "delete-active" ? <Alert title="Futó ZIP-et nem lehet törölni." variant="error">Várd meg, amíg befejeződik vagy hibára fut, utána törölhető.</Alert> : null}
        {flags.zip === "manual-required" ? (
          <Alert title="A ZIP nem indult el automatikusan." variant="info">
            Indítsd el az online ZIP készítést vagy tölts fel saját ZIP-et, amikor a galéria végleges.
          </Alert>
        ) : null}
        {flags.zip === "downloads-disabled" ? <Alert title="A letöltés ki van kapcsolva ehhez a galériához." variant="error" /> : null}
        {flags.downloadEmail === "resent" ? <Alert title="A letöltési e-mail újraküldve." variant="success" /> : null}
        {flags.downloadEmail === "missing" ? <Alert title="Nem található újraküldhető letöltési kérés." variant="error" /> : null}
        {flags.zip === "no-photos" ? <Alert title="Nincs letölthető fotó a galériában." variant="error" /> : null}
        {flags.zip === "not-active" ? <Alert title="Ez a galéria nem aktív." variant="error" /> : null}
        {flags.zip === "proofing-pending" ? <Alert title="A galéria még nem került átadásra." variant="error" /> : null}
        {flags.coverSet ? <Alert title="Borítókép beállítva." variant="success" /> : null}
        {flags.coverPosition ? <Alert title="Borítókép pozíciója mentve." variant="success" /> : null}
        {flags.design ? <Alert title="Galéria stílus mentve." variant="success" /> : null}
        {flags.proofingInvite === "sent" ? <Alert title="Válogató link elküldve emailben." variant="success" /> : null}
        {flags.proofingInvite === "missing-email" ? (
          <Alert title="Hiányzik az ügyfél email címe." variant="error">
            Add meg az ügyfél e-mail címét a galéria beállításaiban vagy a nyers feltöltésnél.
          </Alert>
        ) : null}
        {flags.proofingInvite === "failed" ? (
          <Alert title="A válogató email küldése nem sikerült." variant="error">
            {gallery.proofingInviteEmailError ?? "Ellenőrizd a Resend beállításokat, majd próbáld újra."}
          </Alert>
        ) : null}
        {flags.deliveryEmail === "sent" ? <Alert title="Kész képek email elküldve az ügyfélnek." variant="success" /> : null}
        {flags.deliveryEmail === "missing-email" ? (
          <Alert title="Hiányzik az ügyfél email címe." variant="error">
            Add meg az ügyfél e-mail címét a galéria beállításaiban, majd próbáld újra.
          </Alert>
        ) : null}
        {flags.deliveryEmail === "no-final-photos" ? (
          <Alert title="Még nincs feltöltött kész kép." variant="error">
            Előbb töltsd fel a kidolgozott képeket, utána tudod átadni a galériát az ügyfélnek.
          </Alert>
        ) : null}
        {flags.deliveryEmail === "failed" ? (
          <Alert title="A kész képek email küldése nem sikerült." variant="error">
            {gallery.finalDeliveryEmailError ?? "Ellenőrizd a Resend beállításokat, majd próbáld újra."}
          </Alert>
        ) : null}
        {flags.proofingStatus ? <Alert title="Ügyfélválogató státusz frissítve." variant="success" /> : null}
        {flags.ordered ? <Alert title="Fotósorrend frissítve." variant="success" /> : null}
        {flags.archived ? <Alert title="Galéria archiválva." variant="success">A publikus link most nem elérhető.</Alert> : null}
        {flags.activated ? <Alert title="Galéria aktiválva." variant="success">A publikus link újra elérhető.</Alert> : null}
        {flags.error === "slug" ? (
          <Alert title="Ez a slug már foglalt." variant="error">Adj meg egy egyedi publikus linket.</Alert>
        ) : null}
        {flags.error === "missing" ? <Alert title="Hiányzó kötelező mező." variant="error" /> : null}
        {flags.error === "email" ? <Alert title="Érvénytelen email cím." variant="error" /> : null}
        {flags.error === "customer" ? <Alert title="Válassz érvényes ügyfelet." variant="error" /> : null}
        {flags.error === "project" ? <Alert title="Válassz az ügyfélhez tartozó projektet." variant="error" /> : null}
        {flags.error === "stripe_required" ? (
          <Alert title="A fizetős galériához előbb Stripe kapcsolat kell." variant="error">
            Kösd össze a saját Stripe fiókodat a Beállítások / Integrációk alatt, utána választható a megvásárolható galéria mód.
          </Alert>
        ) : null}
        {flags.error === "price_required" ? (
          <Alert title="Adj meg árat a fizetős galériához." variant="error">
            A megvásárolható galéria csak pozitív árral menthető.
          </Alert>
        ) : null}
        {flags.photoError === "missing" ? <Alert title="Nem választottál ki fotót." variant="error" /> : null}
        {flags.photoError === "storage" ? (
          <Alert title="A feltöltés nem sikerült." variant="error">
            Ellenőrizd az R2 bucket nevét, endpointját és a hozzáférési kulcsokat Vercelben.
          </Alert>
        ) : null}
      </div>

      <div className="space-y-6">
        <div data-gallery-tab-panel="photos" hidden={activeTab !== "photos"}>
          <div className="space-y-8">
            {coverPositionControlProps ? <CoverPositionControl {...coverPositionControlProps} returnTab="photos" /> : null}
            <section className="rounded-lg border border-ink/10 bg-white p-6 shadow-soft">
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                <div>
                  <p className={sectionMetaClass}>Galéria címkék</p>
                  <h2 className="mt-2 text-xl font-semibold text-ink">Anchor blokkok a publikus galériában</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-graphite/70">
                    Hozz létre címkéket feltöltés előtt, majd az upload panelen válaszd ki, hova kerüljenek az új képek. A címkék sorrendje lesz a publikus galéria blokk-sorrendje is.
                  </p>
                </div>
                <form action={createGallerySectionAction.bind(null, gallery.id)} className="flex w-full flex-col gap-2 sm:flex-row lg:max-w-md">
                  <input
                    name="title"
                    placeholder="pl. Készülődés"
                    className="h-11 min-w-0 flex-1 rounded-md border border-ink/15 bg-paper px-3 text-sm text-ink outline-none transition placeholder:text-graphite/45 focus:border-ink/50"
                  />
                  <FormSubmitButton className="h-11 px-4" pendingLabel="Mentés...">
                    <Plus size={16} />
                    Címke
                  </FormSubmitButton>
                </form>
              </div>
              {gallery.sections.length > 0 ? (
                <GallerySectionSortableList
                  galleryId={gallery.id}
                  sections={gallery.sections.map((section) => ({
                    id: section.id,
                    title: section.title,
                    count: sectionPhotoCounts.get(section.id) ?? 0
                  }))}
                />
              ) : (
                <div className="mt-5 rounded-md border border-dashed border-ink/15 bg-paper px-4 py-4 text-sm text-graphite/70">
                  Még nincs címke. A publikus galéria egyben jelenik meg, a feltöltés pedig a megszokott módon működik.
                </div>
              )}
            </section>
            <section className="rounded-lg border border-ink/10 bg-white p-6 shadow-soft">
              <PhotoUploadForm
                galleryId={gallery.id}
                galleryMode={gallery.galleryMode}
                defaultDeliveryStage={defaultPhotoDeliveryStageForGalleryMode(gallery.galleryMode)}
                framed={false}
                sections={gallery.sections.map((section) => ({ id: section.id, title: section.title }))}
                resumableSessions={resumableUploadSessions}
              />
              {!proofingGallery ? (
                <ManualZipUploadForm
                  galleryId={gallery.id}
                  disabled={!canPrepareZip}
                  variant="compact"
                  handoffState={zipHandoff.state}
                  handoffDetail={zipHandoff.detail}
                />
              ) : null}
            </section>
            <MediaProcessingStatus galleryId={gallery.id} photos={gallery.photos} jobs={gallery.mediaProcessingJobs} />
            <PhotoManager
              coverPhotoId={gallery.coverPhotoId}
              galleryId={gallery.id}
              galleryMode={gallery.galleryMode}
              photos={gallery.photos}
              sections={gallery.sections.map((section) => ({ id: section.id, title: section.title }))}
              activeSet={flags.photoSet}
              activeSearch={flags.photoSearch}
              selectedPhotoIds={selectedPhotoIds}
            />
          </div>
        </div>

        <div data-gallery-tab-panel="client" hidden={activeTab !== "client"}>
          <div className="space-y-6">
            {proofingGallery ? (
              <ProofingStatusPanel
                galleryId={gallery.id}
                status={gallery.proofingStatus}
                updatedAt={gallery.proofingStatusUpdatedAt}
                metrics={{
                  rawPhotoCount,
                  selectedPhotoCount: selectedPhotoIds.length,
                  submittedListCount,
                  finalPhotoCount,
                  clientEmail: gallery.clientEmail,
                  proofingInviteSentAt: gallery.proofingInviteSentAt,
                  finalDeliveryEmailSentAt: gallery.finalDeliveryEmailSentAt
                }}
              />
            ) : null}
            {proofingGallery ? (
              <section className="rounded-md border border-ink/12 bg-white p-4">
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                  <div>
                    <div className={sectionMetaClass}>
                      <Download size={15} />
                      Kész képek átadása
                    </div>
                    <h2 className="mt-2 text-lg font-semibold text-ink">
                      {gallery.proofingStatus === PROOFING_STATUS_DELIVERED ? "A kész képek át vannak adva" : "Kész anyag publikálása"}
                    </h2>
                    <p className="mt-1 text-sm text-graphite/70">
                      Ha feltöltötted a kidolgozott képeket, ezzel váltod át az ügyfél galériáját a kész képekre. Onnantól a letöltések is ezekből készülnek.
                    </p>
                    <p className="mt-3 text-sm font-medium text-ink">Kész képek: {finalPhotoCount}</p>
                    <div className="mt-4 grid gap-3 text-sm text-graphite md:grid-cols-2">
                      <div className="rounded-md bg-paper px-3 py-2">
                        <p className={sectionMetaClass}>Ügyfél email</p>
                        <p className="mt-1 font-medium text-ink">{gallery.clientEmail ?? "Nincs megadva"}</p>
                      </div>
                      <div className="rounded-md bg-paper px-3 py-2">
                        <p className={sectionMetaClass}>Átadás email</p>
                        <p className="mt-1 font-medium text-ink">
                          {gallery.finalDeliveryEmailSentAt
                            ? `${gallery.finalDeliveryEmailSentAt.toLocaleString("hu-HU", { timeZone: APP_TIME_ZONE })} · ${gallery.finalDeliveryEmailSentTo ?? gallery.clientEmail ?? ""}`
                            : gallery.finalDeliveryEmailError
                              ? "Hibás"
                              : "Még nem lett kiküldve"}
                        </p>
                      </div>
                    </div>
                    {!gallery.clientEmail ? (
                      <p className="mt-3 text-sm text-red-700">Az email küldéshez előbb add meg az ügyfél email címét a galéria beállításaiban.</p>
                    ) : null}
                    <div className="mt-5 rounded-md border border-ink/10 bg-paper/80 p-4">
                      <p className={sectionMetaClass}>Fizetés / hozzáférés váz</p>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div className="rounded-md border border-sage/20 bg-paper px-3 py-3">
                          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                            <Landmark size={16} />
                            Most: számla és utalás
                          </div>
                          <p className="mt-2 text-sm leading-6 text-graphite/70">
                            A kész galéria csak akkor megy ki az ügyfélnek, amikor te manuálisan átadod. Így maradhat a számla után érkező utalás ellenőrzése.
                          </p>
                        </div>
                        <div className="rounded-md border border-ink/10 bg-paper px-3 py-3">
                          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                            <CreditCard size={16} />
                            Később: Stripe kártyás fizetés
                          </div>
                          <p className="mt-2 text-sm leading-6 text-graphite/70">
                            Ide kerül majd a kártyás fizetés: sikeres Stripe fizetés után a rendszer automatikusan átadhatja a kész galériát.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <form action={updateGalleryProofingStatusAction.bind(null, gallery.id, PROOFING_STATUS_DELIVERED)}>
                      <FormSubmitButton
                        variant={gallery.proofingStatus === PROOFING_STATUS_DELIVERED ? "secondary" : "primary"}
                        disabled={finalPhotoCount === 0 || gallery.proofingStatus === PROOFING_STATUS_DELIVERED || !gallery.clientEmail}
                        className={finalPhotoCount === 0 || gallery.proofingStatus === PROOFING_STATUS_DELIVERED || !gallery.clientEmail ? "opacity-60" : ""}
                        pendingLabel="Átadás..."
                      >
                        Kész képek átadása
                      </FormSubmitButton>
                    </form>
                    {gallery.proofingStatus === PROOFING_STATUS_DELIVERED ? (
                      <form action={sendFinalDeliveryEmailAction.bind(null, gallery.id)}>
                        <FormSubmitButton
                          variant="secondary"
                          disabled={!gallery.clientEmail}
                          className={!gallery.clientEmail ? "opacity-60" : ""}
                          pendingLabel="Küldés..."
                        >
                          Email újraküldése
                        </FormSubmitButton>
                      </form>
                    ) : null}
                  </div>
                </div>
              </section>
            ) : null}
            {proofingGallery ? (
              <PhotoUploadForm
                galleryId={gallery.id}
                galleryMode={gallery.galleryMode}
                defaultDeliveryStage={PHOTO_DELIVERY_STAGE_FINAL}
                deliveryStageMode="fixed"
                sections={gallery.sections.map((section) => ({ id: section.id, title: section.title }))}
                resumableSessions={resumableUploadSessions}
                title="Kész képek feltöltése"
                description="Ide töltsd fel a kidolgozott képeket, amelyeket az ügyfél kiválasztott. Ezek külön kész képként kerülnek a galériába."
              />
            ) : null}
            {proofingGallery ? (
              <section className="rounded-md border border-ink/12 bg-white p-4">
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                  <div>
                    <div className={sectionMetaClass}>
                      <KeyRound size={15} />
                      Válogató link
                    </div>
                    <h2 className="mt-2 text-lg font-semibold text-ink">Normál galéria link válogatáshoz</h2>
                    <p className="mt-1 text-sm text-graphite/70">
                      Nyers válogatásnál ezt a galéria linket kapja meg az ügyfél. Itt tud kedvenceket jelölni és leadni, melyik képeket szeretné megvenni.
                    </p>
                    <div className="mt-4 grid gap-3 text-sm text-graphite md:grid-cols-2">
                      <div className="rounded-md bg-paper px-3 py-2">
                        <p className={sectionMetaClass}>Ügyfél email</p>
                        <p className="mt-1 font-medium text-ink">{gallery.clientEmail ?? "Nincs megadva"}</p>
                      </div>
                      <div className="rounded-md bg-paper px-3 py-2">
                        <p className={sectionMetaClass}>Válogató email</p>
                        <p className="mt-1 font-medium text-ink">
                          {gallery.proofingInviteSentAt
                            ? `${gallery.proofingInviteSentAt.toLocaleString("hu-HU", { timeZone: APP_TIME_ZONE })} · ${gallery.proofingInviteSentTo ?? gallery.clientEmail ?? ""}`
                            : "Még nem lett kiküldve"}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <form action={sendProofingInviteAction.bind(null, gallery.id)}>
                      <FormSubmitButton
                        variant="secondary"
                        disabled={!gallery.clientEmail}
                        className={!gallery.clientEmail ? "opacity-60" : ""}
                        pendingLabel="Küldés..."
                      >
                        <Mail size={16} />
                        Válogató link küldése
                      </FormSubmitButton>
                    </form>
                    <CopyPublicLinkButton
                      slug={gallery.slug}
                      label="Válogató link másolása"
                    />
                  </div>
                </div>
              </section>
            ) : null}
            <FavoriteListsLog lists={gallery.favoriteLists} mode={proofingGallery ? "proofing" : "favorites"} />
          </div>
        </div>

        <div data-gallery-tab-panel="views" hidden={activeTab !== "views"}>
          <div className="space-y-6">
            <ViewLog views={gallery.views} />
            <ViewLocationMap
              points={locationPoints}
              title="Album megtekintések térképe"
              description="Összesített helyszínek kizárólag ennek a galériának a publikus megnyitásaiból. Görgetéssel vagy csippentéssel nagyítható."
            />
          </div>
        </div>

        <div data-gallery-tab-panel="downloads" hidden={activeTab !== "downloads"}>
          <div className="space-y-6">
            <ZipPreparationStatus galleryId={gallery.id} packages={publicDownloadPackages} photoCount={gallery.photos.length} canPrepareZip={canPrepareZip} />
            <DownloadLog galleryId={gallery.id} downloads={publicDownloadEntries} packages={publicDownloadPackages.slice(0, 8)} />
          </div>
        </div>

        <div data-gallery-tab-panel="appearance" hidden={activeTab !== "appearance"}>
          <div className="space-y-6">
            {coverPositionControlProps ? <CoverPositionControl {...coverPositionControlProps} returnTab="appearance" /> : null}
            <form action={updateGalleryDesignAction.bind(null, gallery.id)} className="rounded-lg border border-ink/10 bg-white p-6 shadow-soft">
              <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
                <div>
                  <p className={sectionMetaClass}>Megjelenés</p>
                  <h2 className="mt-2 text-xl font-semibold text-ink">Galéria dizájn</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-graphite/70">
                    Válaszd ki, milyen felépítéssel jelenjen meg a publikus galéria. Most csak a választást készítjük elő, a publikus megjelenítés külön lépésben kapja meg az új stílust.
                  </p>
                </div>
                <span className="inline-flex w-fit rounded-full bg-sage/15 px-3 py-1 text-xs font-medium text-sage">
                  {selectedGalleryDesignLabel}
                </span>
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                {GALLERY_DESIGNS.map((design) => {
                  const selected = selectedGalleryDesign === design.key;
                  const coverSticky = design.key === GALLERY_DESIGN_COVER_STICKY;

                  return (
                    <label key={design.key} className="block cursor-pointer">
                      <input
                        type="radio"
                        name="galleryDesign"
                        value={design.key}
                        defaultChecked={selected}
                        className="peer sr-only"
                      />
                      <div className="rounded-lg border border-ink/10 bg-white p-4 transition peer-checked:border-ink peer-checked:bg-paper peer-checked:shadow-soft">
                        <div className="flex items-start gap-3">
                          <span
                            className={`flex size-11 shrink-0 items-center justify-center rounded-md ${
                              selected ? "bg-ink text-white" : "bg-paper text-graphite"
                            }`}
                          >
                            <Palette size={20} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className={sectionMetaClass}>{design.eyebrow}</p>
                            <h3 className="mt-1 text-lg font-semibold text-ink">{design.label}</h3>
                            <p className="mt-2 text-sm leading-6 text-graphite/70">{design.description}</p>
                          </div>
                          <span
                            className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                              selected ? "bg-sage/15 text-sage" : "bg-ink/5 text-graphite"
                            }`}
                          >
                            {selected ? <Check size={13} /> : null}
                            {selected ? "Kiválasztva" : "Választható"}
                          </span>
                        </div>

                        <div className="mt-4 overflow-hidden rounded-md border border-ink/10 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                          {coverSticky ? (
                            <div className="bg-paper">
                              <div className="relative h-32 overflow-hidden bg-ink sm:h-36">
                                {designPreviewCoverPhoto ? (
                                  <Image
                                    src={designPreviewCoverPhoto.previewUrl || designPreviewCoverPhoto.imageUrl}
                                    alt={designPreviewCoverPhoto.filename}
                                    fill
                                    unoptimized
                                    className="object-cover"
                                    sizes="(min-width: 1024px) 420px, 90vw"
                                    style={{ objectPosition: `${gallery.coverPositionX ?? 50}% ${gallery.coverPositionY ?? 50}%` }}
                                  />
                                ) : (
                                  <div className="absolute inset-0 bg-graphite" />
                                )}
                                <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(17,17,17,0.12),rgba(17,17,17,0.56))]" />
                                <div className="absolute inset-x-4 bottom-4" style={{ color: selectedGalleryTextColor }}>
                                  <p className="text-[10px] font-semibold uppercase opacity-75">Editorial</p>
                                  <p className="font-playfair mt-1 max-w-[9ch] text-3xl font-semibold leading-[0.95] drop-shadow">
                                    {gallery.title}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center justify-between border-b border-ink/10 bg-white px-4 py-2">
                                <div className="min-w-0">
                                  <div className="h-3 w-32 max-w-full rounded bg-ink/80" />
                                  <div className="mt-1.5 h-2 w-24 rounded bg-graphite/30" />
                                </div>
                                <div className="flex shrink-0 gap-1.5">
                                  <span className="grid size-7 place-items-center rounded border border-ink/10 bg-white text-graphite">
                                    <Heart size={13} />
                                  </span>
                                  <span className="grid size-7 place-items-center rounded bg-ink text-white">
                                    <Download size={13} />
                                  </span>
                                  <span className="grid size-7 place-items-center rounded border border-ink/10 bg-white text-graphite">
                                    <Share2 size={13} />
                                  </span>
                                </div>
                              </div>
                              <div className="grid grid-cols-3 gap-2 p-3">
                                <div className="h-16 rounded bg-white shadow-sm" />
                                <div className="h-24 rounded bg-white shadow-sm" />
                                <div className="h-14 rounded bg-white shadow-sm" />
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-3 bg-paper p-3">
                              <div className="relative h-24 overflow-hidden rounded bg-ink/10">
                                {designPreviewCoverPhoto ? (
                                  <Image
                                    src={designPreviewCoverPhoto.previewUrl || designPreviewCoverPhoto.imageUrl}
                                    alt={designPreviewCoverPhoto.filename}
                                    fill
                                    unoptimized
                                    className="object-cover opacity-65"
                                    sizes="(min-width: 1024px) 420px, 90vw"
                                    style={{ objectPosition: `${gallery.coverPositionX ?? 50}% ${gallery.coverPositionY ?? 50}%` }}
                                  />
                                ) : null}
                                <div className="absolute inset-0 bg-white/35" />
                              </div>
                              <div className="mx-auto h-4 w-36 rounded" style={{ backgroundColor: selectedGalleryTextColor }} />
                              <div className="mx-auto h-2 w-24 rounded bg-graphite/30" />
                              <div className="grid grid-cols-3 gap-2">
                                <div className="h-16 rounded bg-white shadow-sm" />
                                <div className="h-20 rounded bg-white shadow-sm" />
                                <div className="h-14 rounded bg-white shadow-sm" />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <div className="rounded-md border border-ink/10 bg-paper p-4">
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px] lg:items-center">
                    <div>
                      <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                        <Palette size={16} />
                        Hero szöveg színe
                      </p>
                      <p className="mt-1 text-sm leading-6 text-graphite/70">
                        A publikus galéria borító részén megjelenő cím és meta szöveg színe.
                      </p>
                    </div>
                    <label className="block space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-graphite/55">Szín</span>
                      <div className="flex items-center gap-2 rounded-md border border-ink/15 bg-white px-2 py-2">
                        <input
                          type="color"
                          name="galleryTextColor"
                          defaultValue={selectedGalleryTextColor}
                          className="size-8 shrink-0 cursor-pointer rounded border border-ink/10 bg-white"
                        />
                        <span className="font-mono text-xs uppercase text-graphite">{selectedGalleryTextColor}</span>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="rounded-md border border-ink/10 bg-paper p-4">
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px] lg:items-center">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                      <Columns3 size={16} />
                      Mobil fotórács
                    </p>
                    <p className="mt-1 text-sm leading-6 text-graphite/70">
                      Állítsd be, hány oszlopban jelenjenek meg a képek telefonon. Asztali nézetben továbbra is automatikus, reszponzív rácsot használunk.
                    </p>
                  </div>
                  <label className="block space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-graphite/55">Telefonos oszlopok</span>
                    <select
                      name="publicColumnCount"
                      defaultValue={Math.min(3, Math.max(1, gallery.publicColumnCount))}
                      className="h-11 w-full rounded-md border border-ink/15 bg-white px-3 text-sm text-ink outline-none transition focus:border-ink/50"
                    >
                      <option value="1">1 oszlop</option>
                      <option value="2">2 oszlop</option>
                      <option value="3">3 oszlop</option>
                    </select>
                  </label>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end border-t border-ink/10 pt-5">
                <FormSubmitButton pendingLabel="Mentés...">Stílus mentése</FormSubmitButton>
              </div>
            </form>
          </div>
        </div>

        <div data-gallery-tab-panel="settings" hidden={activeTab !== "settings"}>
          <div className="space-y-8">
            <GalleryForm
              gallery={gallery}
              customers={customers}
              projects={projects}
              selectedCustomerId={gallery.customerId}
              selectedProjectId={gallery.projectId}
              stripeReady={Boolean(stripeIntegration?.chargesEnabled)}
            />
            <UploadSessionLog sessions={gallery.uploadSessions} />
            <GalleryDangerZone galleryId={gallery.id} isActive={gallery.isActive} />
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
