import Link from "next/link";
import QRCode from "qrcode";
import { Archive, CalendarDays, Download, ExternalLink, FileArchive, KeyRound, QrCode, RotateCcw, UploadCloud, UserCog } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Alert } from "@/components/alert";
import { CopyLinkButton } from "@/components/copy-link-button";
import { FormSubmitButton } from "@/components/form-submit-button";
import { GuestGalleryPhotoManager } from "@/components/guest-gallery-photo-manager";
import { ZipStatusAutoRefresh } from "@/components/zip-status-auto-refresh";
import { adminOwnedWhere, galleryAccessWhere, ownerAdminId } from "@/lib/admin-scope";
import { requireAdmin } from "@/lib/auth";
import { GUEST_UPLOAD_DOWNLOAD_SCOPE, ensureDownloadPackageAccessToken } from "@/lib/download-packages";
import { publicGalleryUrl } from "@/lib/email";
import { ADMIN_GUEST_PHOTO_PAGE_SIZE, serializeGuestGalleryAdminPhoto } from "@/lib/guest-gallery-admin";
import {
  archiveGuestGalleryAction,
  queueGuestGalleryZipAction,
  restoreGuestGalleryAction,
  updateGuestGalleryAction
} from "@/lib/guest-gallery-actions";
import { prisma } from "@/lib/prisma";
import { GALLERY_MODE_GUEST } from "@/lib/proofing";

const fieldClass =
  "h-11 w-full rounded-md border border-ink/15 bg-white px-3 text-ink outline-none transition placeholder:text-graphite/45 focus:border-ink/50";

function dateInputValue(date: Date | null) {
  return date?.toISOString().slice(0, 10) ?? "";
}

function formatFileSize(bytes: number | bigint) {
  const value = Number(bytes);

  if (value < 1024 * 1024) {
    return `${Math.max(1, Math.round(value / 1024))} KB`;
  }

  if (value >= 1024 * 1024 * 1024) {
    return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function GuestGalleryDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; saved?: string; photo?: string; error?: string; zip?: string; archive?: string }>;
}) {
  const admin = await requireAdmin();
  const { id } = await params;
  const flags = await searchParams;
  const workspaceAdminId = ownerAdminId(admin);
  const [gallery, siteSettings, customers] = await Promise.all([
    prisma.gallery.findFirst({
      where: {
        ...galleryAccessWhere(admin, id),
        galleryMode: GALLERY_MODE_GUEST
      },
      include: {
        customer: {
          select: {
            id: true,
            coupleName: true,
            preferredLanguage: true
          }
        },
        guestUploads: {
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: ADMIN_GUEST_PHOTO_PAGE_SIZE + 1,
          select: {
            id: true,
            filename: true,
            email: true,
            guestName: true,
            imageUrl: true,
            thumbnailUrl: true,
            previewUrl: true,
            fileSize: true,
            status: true,
            processingStatus: true,
            createdAt: true
          }
        },
        _count: { select: { guestUploads: true } },
        downloadPackages: {
          where: { scope: GUEST_UPLOAD_DOWNLOAD_SCOPE },
          orderBy: [{ createdAt: "desc" }, { partIndex: "asc" }],
          take: 30
        }
      }
    }),
    prisma.siteSettings.findUnique({
      where: { adminId: workspaceAdminId },
      select: { publicSubdomain: true }
    }),
    prisma.customer.findMany({
      where: {
        ...adminOwnedWhere(admin),
        customerType: "wedding_couple"
      },
      orderBy: [{ weddingDate: "desc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        coupleName: true
      }
    })
  ]);

  if (!gallery) {
    return (
      <AdminShell>
        <Alert title="A vendéggaléria nem található." variant="error" />
      </AdminShell>
    );
  }

  const publicUrl = publicGalleryUrl(
    gallery.slug,
    gallery.customer?.preferredLanguage,
    siteSettings?.publicSubdomain
  );
  const guestUrl = `${publicUrl}#guest-photos`;
  const [qrCodeDataUrl, statusGroups, processingGroups, uploadingCount] = await Promise.all([
    QRCode.toDataURL(guestUrl, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 480,
      color: {
        dark: "#111111",
        light: "#ffffff"
      }
    }),
    prisma.galleryGuestUpload.groupBy({
      by: ["status"],
      where: { galleryId: gallery.id },
      _count: { _all: true }
    }),
    prisma.galleryGuestUpload.groupBy({
      by: ["processingStatus"],
      where: { galleryId: gallery.id },
      _count: { _all: true }
    }),
    prisma.galleryGuestUpload.count({
      where: {
        galleryId: gallery.id,
        OR: [{ status: "pending" }, { processingStatus: "uploading" }]
      }
    })
  ]);
  const statusCount = new Map(statusGroups.map((group) => [group.status, group._count._all]));
  const processingStatusCount = new Map(processingGroups.map((group) => [group.processingStatus, group._count._all]));
  const totalPhotoCount = gallery._count.guestUploads;
  const visibleCount = statusCount.get("visible") ?? 0;
  const galleryArchived = Boolean(gallery.guestGalleryArchivedAt) || Boolean(gallery.guestGalleryExpiresAt && gallery.guestGalleryExpiresAt <= new Date());
  const hiddenCount = statusCount.get("hidden") ?? 0;
  const pendingReviewCount = statusCount.get("pending_review") ?? 0;
  const processingCount = (processingStatusCount.get("pending") ?? 0) + (processingStatusCount.get("processing") ?? 0);
  const failedCount = processingStatusCount.get("failed") ?? 0;
  const capacityPercent = Math.min(100, Math.round((totalPhotoCount / gallery.guestUploadLimit) * 100));
  const initialPhotoRows = gallery.guestUploads.slice(0, ADMIN_GUEST_PHOTO_PAGE_SIZE);
  const initialLastPhoto = initialPhotoRows.at(-1);
  const initialNextCursor = gallery.guestUploads.length > ADMIN_GUEST_PHOTO_PAGE_SIZE && initialLastPhoto
    ? { createdAt: initialLastPhoto.createdAt.toISOString(), id: initialLastPhoto.id }
    : null;
  const latestZipPackage = gallery.downloadPackages[0] ?? null;
  const latestZipGroupKey = latestZipPackage ? latestZipPackage.groupId ?? latestZipPackage.id : null;
  const latestZipPackages = latestZipGroupKey
    ? gallery.downloadPackages
        .filter((downloadPackage) => (downloadPackage.groupId ?? downloadPackage.id) === latestZipGroupKey)
        .sort((a, b) => a.partIndex - b.partIndex)
    : [];
  const zipActive = latestZipPackages.some((downloadPackage) => downloadPackage.status === "pending" || downloadPackage.status === "processing");
  const zipReady = latestZipPackages.length > 0 && latestZipPackages.every((downloadPackage) => downloadPackage.status === "completed" && downloadPackage.downloadUrl);
  const zipFailed = latestZipPackages.some((downloadPackage) => downloadPackage.status === "failed");
  const zipProcessedCount = latestZipPackages.reduce((sum, downloadPackage) => sum + downloadPackage.processedCount, 0);
  const zipPhotoCount = latestZipPackage?.photoCount ?? totalPhotoCount - (statusCount.get("pending") ?? 0);
  const zipProgress = zipReady ? 100 : zipPhotoCount > 0 ? Math.min(99, Math.round((zipProcessedCount / zipPhotoCount) * 100)) : 0;
  const zipDownloadLinks = new Map(
    zipReady
      ? await Promise.all(latestZipPackages.map(async (downloadPackage) => {
          const access = await ensureDownloadPackageAccessToken(downloadPackage.id);
          return [downloadPackage.id, `/download/${access.token}`] as const;
        }))
      : []
  );

  return (
    <AdminShell>
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <Link href="/admin/guest-galleries" className="text-sm font-medium text-graphite/70 hover:text-ink">
            ← Vendéggalériák
          </Link>
          <p className="mt-6 text-xs uppercase tracking-[0.16em] text-graphite/60">QR-kódos vendégfeltöltés</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">{gallery.title}</h1>
          <p className="mt-2 text-sm text-graphite/65">{gallery.customer?.coupleName ?? "Nincs ügyfélhez kapcsolva"}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {gallery.customer ? (
            <Link
              href={`/admin/clients/${gallery.customer.id}?tab=portal#par-admin`}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-ink/15 bg-white px-4 text-sm font-medium text-ink transition hover:bg-paper"
            >
              <UserCog size={16} /> Pár-admin hozzáférés
            </Link>
          ) : (
            <a
              href="#megrendelo-par"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-brass/30 bg-brass/10 px-4 text-sm font-semibold text-ink transition hover:bg-brass/15"
            >
              <UserCog size={16} /> Pár hozzárendelése
            </a>
          )}
          {!galleryArchived && gallery.isActive ? (
            <a
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-medium text-white transition hover:bg-graphite"
            >
              <ExternalLink size={16} /> Publikus galéria
            </a>
          ) : (
            <span className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-ink/10 px-4 text-sm font-medium text-graphite">
              <Archive size={16} /> Archivált galéria
            </span>
          )}
        </div>
      </div>

      <div className="mb-5 space-y-3">
        {flags.created ? <Alert title="A vendéggaléria és a QR-kód elkészült." variant="success" /> : null}
        {flags.saved ? <Alert title="A vendéggaléria beállításai elmentve." variant="success" /> : null}
        {flags.photo === "hidden" ? <Alert title="A kép elrejtve a vendégek elől." variant="success" /> : null}
        {flags.photo === "shown" ? <Alert title="A kép ismét látható a vendéggalériában." variant="success" /> : null}
        {flags.zip === "queued" ? <Alert title="A vendégfotók ZIP-feldolgozása elindult." variant="success" /> : null}
        {flags.zip === "already-running" ? <Alert title="A ZIP-feldolgozás már folyamatban van." variant="info" /> : null}
        {flags.zip === "already-ready" ? <Alert title="A vendégfotók ZIP-je már letölthető." variant="success" /> : null}
        {flags.zip === "no-photos" ? <Alert title="Nincs ZIP-be tehető vendégfotó." variant="error" /> : null}
        {flags.archive === "done" ? <Alert title="A vendéggaléria archiválva és lezárva." variant="success" /> : null}
        {flags.archive === "restored" ? <Alert title="A vendéggaléria visszaállítva és újra megnyitva." variant="success" /> : null}
        {flags.error === "missing" ? <Alert title="A galéria neve kötelező." variant="error" /> : null}
        {flags.error === "customer" ? <Alert title="A kiválasztott esküvős pár nem található." variant="error" /> : null}
        {flags.error === "photo" ? <Alert title="A kiválasztott vendégfotó nem található." variant="error" /> : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <form action={updateGuestGalleryAction.bind(null, gallery.id)} className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft sm:p-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-graphite/55">Beállítások</p>
            <h2 className="mt-1 text-xl font-semibold text-ink">Esemény és hozzáférés</h2>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2 sm:col-span-2">
              <span className="text-sm font-medium text-graphite">Galéria neve</span>
              <input name="title" type="text" required defaultValue={gallery.title} className={fieldClass} />
            </label>

            <label id="megrendelo-par" className="block scroll-mt-6 space-y-2 sm:col-span-2">
              <span className="flex items-center gap-2 text-sm font-medium text-graphite">
                <UserCog size={15} /> Megrendelő pár
              </span>
              <select name="customerId" defaultValue={gallery.customer?.id ?? ""} className={fieldClass}>
                <option value="">Nincs ügyfélhez kapcsolva</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>{customer.coupleName}</option>
                ))}
              </select>
              <span className="block text-xs leading-5 text-graphite/60">
                A hozzárendelés után itt jelenik meg a Pár-admin hozzáférés gomb, és a pár csak ezt a galériát tudja kezelni.
              </span>
            </label>

            <label className="block space-y-2">
              <span className="flex items-center gap-2 text-sm font-medium text-graphite">
                <CalendarDays size={15} /> Esemény dátuma
              </span>
              <input name="eventDate" type="date" defaultValue={dateInputValue(gallery.eventDate)} className={fieldClass} />
            </label>

            <label className="block space-y-2">
              <span className="flex items-center gap-2 text-sm font-medium text-graphite">
                <KeyRound size={15} /> PIN-kód
              </span>
              <input
                name="password"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                defaultValue={gallery.password ?? ""}
                placeholder="PIN nélkül nyilvános"
                className={fieldClass}
              />
            </label>

            <label className="block space-y-2 sm:col-span-2">
              <span className="flex items-center gap-2 text-sm font-medium text-graphite">
                <CalendarDays size={15} /> Automatikus archiválás
              </span>
              <input
                name="guestGalleryExpiresAt"
                type="date"
                defaultValue={dateInputValue(gallery.guestGalleryExpiresAt)}
                className={fieldClass}
              />
              <span className="block text-xs leading-5 text-graphite/60">A megadott nap végén a galéria bezár és a vendégfeltöltés kikapcsol.</span>
            </label>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <label className="flex items-start gap-3 rounded-md border border-ink/10 bg-paper p-4">
              <input name="isActive" type="checkbox" defaultChecked={gallery.isActive && !galleryArchived} disabled={galleryArchived} className="mt-1 size-4 accent-ink disabled:opacity-40" />
              <span>
                <span className="text-sm font-semibold text-ink">Galéria aktív</span>
                <span className="mt-1 block text-xs leading-5 text-graphite/65">Kikapcsolva a publikus link nem nyitható meg.</span>
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-md border border-ink/10 bg-paper p-4">
              <input
                name="guestUploadsEnabled"
                type="checkbox"
                defaultChecked={gallery.guestUploadsEnabled}
                disabled={galleryArchived}
                className="mt-1 size-4 accent-ink disabled:opacity-40"
              />
              <span>
                <span className="text-sm font-semibold text-ink">Új feltöltések engedélyezve</span>
                <span className="mt-1 block text-xs leading-5 text-graphite/65">Lezárás után a meglévő képek továbbra is láthatók.</span>
              </span>
            </label>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-graphite">Új képek megjelenése</span>
              <select
                name="guestUploadModerationMode"
                defaultValue={gallery.guestUploadModerationMode}
                className={fieldClass}
              >
                <option value="automatic">Azonnal, automatikusan</option>
                <option value="approval">Csak jóváhagyás után</option>
              </select>
              <span className="block text-xs leading-5 text-graphite/60">Jóváhagyás esetén a vendég feltöltése nem jelenik meg rögtön.</span>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-graphite">Galéria képlimitje</span>
              <input
                name="guestUploadLimit"
                type="number"
                min={20}
                max={5000}
                step={10}
                defaultValue={gallery.guestUploadLimit}
                className={fieldClass}
              />
              <span className="block text-xs leading-5 text-graphite/60">Legalább 20, legfeljebb 5000 vendégfotó.</span>
            </label>
          </div>

          <div className="mt-6 flex justify-end border-t border-ink/10 pt-5">
            <FormSubmitButton pendingLabel="Mentés...">Beállítások mentése</FormSubmitButton>
          </div>
        </form>

        <aside className="rounded-lg border border-ink/10 bg-white p-5 text-center shadow-soft">
          <p className="flex items-center justify-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-graphite/55">
            <QrCode size={15} /> Vendég QR-kód
          </p>
          <div className="mx-auto mt-4 max-w-[280px] rounded-lg border border-ink/10 bg-white p-3">
            <img src={qrCodeDataUrl} alt={`${gallery.title} QR-kód`} className="block h-auto w-full" />
          </div>
          <p className="mt-4 break-all text-xs leading-5 text-graphite/60">{guestUrl}</p>
          <div className="mt-4 grid gap-2">
            <CopyLinkButton url={guestUrl} label="Vendéglink másolása" className="w-full" />
            <a
              href={qrCodeDataUrl}
              download={`${gallery.slug}-qr.png`}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-ink/15 bg-white px-4 text-sm font-medium text-ink transition hover:bg-paper"
            >
              <Download size={16} /> QR-kód letöltése
            </a>
            <Link
              href={`/admin/guest-galleries/${gallery.id}/print`}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-ink/15 bg-white px-4 text-sm font-medium text-ink transition hover:bg-paper"
            >
              Nyomtatható kártya
            </Link>
          </div>
        </aside>
      </div>

      <section className="mt-6 grid gap-6 xl:grid-cols-2">
        <div className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-graphite/55">Eredeti fájlok</p>
              <h2 className="mt-1 text-xl font-semibold text-ink">Vendégfotók ZIP-letöltése</h2>
              <p className="mt-2 text-sm leading-6 text-graphite/65">Az összes befejezett vendégfeltöltés eredeti fájlja, szükség esetén több ZIP-részben.</p>
            </div>
            <ZipStatusAutoRefresh enabled={zipActive} />
          </div>

          <div className="mt-5 rounded-md border border-ink/10 bg-paper p-4">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-ink">
                {zipReady ? "ZIP elkészült" : zipActive ? "ZIP készül" : zipFailed ? "A ZIP készítése hibára futott" : "Még nincs kész ZIP"}
              </span>
              <span className="text-graphite/60">{zipProgress}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink/10">
              <div className={`h-full rounded-full ${zipFailed ? "bg-red-600" : "bg-sage"}`} style={{ width: `${zipProgress}%` }} />
            </div>
            {latestZipPackages.some((downloadPackage) => downloadPackage.errorMessage) ? (
              <p className="mt-3 text-xs text-red-700">{latestZipPackages.find((downloadPackage) => downloadPackage.errorMessage)?.errorMessage}</p>
            ) : (
              <p className="mt-3 text-xs text-graphite/60">{zipProcessedCount}/{zipPhotoCount} kép feldolgozva</p>
            )}
          </div>

          {zipReady ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {latestZipPackages.map((downloadPackage) => (
                <a
                  key={downloadPackage.id}
                  href={zipDownloadLinks.get(downloadPackage.id) ?? downloadPackage.downloadUrl!}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-medium text-white transition hover:bg-graphite"
                >
                  <Download size={16} /> ZIP {downloadPackage.partCount > 1 ? `${downloadPackage.partIndex + 1}/${downloadPackage.partCount}` : "letöltése"}
                  {downloadPackage.fileSize > 0 ? ` · ${formatFileSize(downloadPackage.fileSize)}` : ""}
                </a>
              ))}
            </div>
          ) : (
            <form action={queueGuestGalleryZipAction.bind(null, gallery.id)} className="mt-4">
              <FormSubmitButton disabled={zipActive || zipPhotoCount === 0} pendingLabel="Indítás...">
                <FileArchive size={16} /> {zipFailed ? "ZIP újraindítása" : "Eredeti ZIP elkészítése"}
              </FormSubmitButton>
            </form>
          )}
        </div>

        <div className={`rounded-lg border p-5 shadow-soft sm:p-6 ${galleryArchived ? "border-ink/10 bg-paper" : "border-red-200 bg-white"}`}>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-graphite/55">Életciklus</p>
          <h2 className="mt-1 text-xl font-semibold text-ink">{galleryArchived ? "Galéria archiválva" : "Esemény lezárása"}</h2>
          <p className="mt-2 text-sm leading-6 text-graphite/65">
            {galleryArchived
              ? "A publikus oldal és a feltöltés nem érhető el. A képek és a ZIP-ek megmaradtak."
              : "Az archiválás azonnal bezárja a publikus oldalt és letiltja az új feltöltéseket, de nem töröl semmit."}
          </p>
          <form action={(galleryArchived ? restoreGuestGalleryAction : archiveGuestGalleryAction).bind(null, gallery.id)} className="mt-5">
            <FormSubmitButton variant={galleryArchived ? "secondary" : "danger"} pendingLabel={galleryArchived ? "Visszaállítás..." : "Archiválás..."}>
              {galleryArchived ? <RotateCcw size={16} /> : <Archive size={16} />}
              {galleryArchived ? "Galéria visszaállítása" : "Galéria archiválása most"}
            </FormSubmitButton>
          </form>
        </div>
      </section>

      <section className="mt-8 rounded-lg border border-ink/10 bg-white p-5 shadow-soft sm:p-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-graphite/55">Moderálás</p>
            <h2 className="mt-1 text-xl font-semibold text-ink">Vendégfeltöltések</h2>
            <p className="mt-2 text-sm text-graphite/65">
              {visibleCount} látható · {pendingReviewCount} jóváhagyásra vár · {hiddenCount} elrejtett
            </p>
          </div>
          <span className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${gallery.guestUploadsEnabled ? "bg-sage/10 text-sage" : "bg-ink/5 text-graphite"}`}>
            <UploadCloud size={14} /> {gallery.guestUploadsEnabled ? "Feltöltés nyitva" : "Feltöltés lezárva"}
          </span>
        </div>

        <div className="mt-5 rounded-md border border-ink/10 bg-paper p-4">
          <div className="flex items-center justify-between gap-4 text-xs font-medium text-graphite/70">
            <span>Kapacitás</span>
            <span>{totalPhotoCount} / {gallery.guestUploadLimit} kép{processingCount > 0 ? ` · ${processingCount} feldolgozás alatt` : ""}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink/10">
            <div className="h-full rounded-full bg-sage transition-[width]" style={{ width: `${capacityPercent}%` }} />
          </div>
        </div>

        <GuestGalleryPhotoManager
          galleryId={gallery.id}
          initialPhotos={initialPhotoRows.map(serializeGuestGalleryAdminPhoto)}
          initialNextCursor={initialNextCursor}
          initialTotalCount={totalPhotoCount}
          initialRevision={gallery.guestGalleryRevision}
          statusCounts={{
            all: totalPhotoCount,
            pending_review: pendingReviewCount,
            visible: visibleCount,
            hidden: hiddenCount,
            uploading: uploadingCount,
            processing: processingCount,
            failed: failedCount
          }}
        />
      </section>
    </AdminShell>
  );
}
