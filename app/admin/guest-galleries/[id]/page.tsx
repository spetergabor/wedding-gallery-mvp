import Image from "next/image";
import Link from "next/link";
import QRCode from "qrcode";
import { CalendarDays, Download, ExternalLink, Eye, EyeOff, KeyRound, QrCode, UploadCloud } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Alert } from "@/components/alert";
import { CopyLinkButton } from "@/components/copy-link-button";
import { FormSubmitButton } from "@/components/form-submit-button";
import { galleryAccessWhere, ownerAdminId } from "@/lib/admin-scope";
import { requireAdmin } from "@/lib/auth";
import { publicGalleryUrl } from "@/lib/email";
import { setGuestPhotoVisibilityAction, updateGuestGalleryAction } from "@/lib/guest-gallery-actions";
import { prisma } from "@/lib/prisma";
import { GALLERY_MODE_GUEST } from "@/lib/proofing";

const fieldClass =
  "h-11 w-full rounded-md border border-ink/15 bg-white px-3 text-ink outline-none transition placeholder:text-graphite/45 focus:border-ink/50";

function dateInputValue(date: Date | null) {
  return date?.toISOString().slice(0, 10) ?? "";
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function GuestGalleryDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; saved?: string; photo?: string; error?: string }>;
}) {
  const admin = await requireAdmin();
  const { id } = await params;
  const flags = await searchParams;
  const workspaceAdminId = ownerAdminId(admin);
  const [gallery, siteSettings] = await Promise.all([
    prisma.gallery.findFirst({
      where: {
        ...galleryAccessWhere(admin, id),
        galleryMode: GALLERY_MODE_GUEST
      },
      include: {
        customer: {
          select: {
            coupleName: true,
            preferredLanguage: true
          }
        },
        guestUploads: {
          orderBy: { createdAt: "desc" }
        }
      }
    }),
    prisma.siteSettings.findUnique({
      where: { adminId: workspaceAdminId },
      select: { publicSubdomain: true }
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
  const qrCodeDataUrl = await QRCode.toDataURL(guestUrl, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 480,
    color: {
      dark: "#111111",
      light: "#ffffff"
    }
  });
  const visibleCount = gallery.guestUploads.filter((photo) => photo.status === "visible").length;
  const hiddenCount = gallery.guestUploads.filter((photo) => photo.status === "hidden").length;
  const pendingReviewCount = gallery.guestUploads.filter((photo) => photo.status === "pending_review").length;
  const processingCount = gallery.guestUploads.filter((photo) => photo.processingStatus === "pending" || photo.processingStatus === "processing").length;
  const capacityPercent = Math.min(100, Math.round((gallery.guestUploads.length / gallery.guestUploadLimit) * 100));

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
        <a
          href={publicUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-medium text-white transition hover:bg-graphite"
        >
          <ExternalLink size={16} /> Publikus galéria
        </a>
      </div>

      <div className="mb-5 space-y-3">
        {flags.created ? <Alert title="A vendéggaléria és a QR-kód elkészült." variant="success" /> : null}
        {flags.saved ? <Alert title="A vendéggaléria beállításai elmentve." variant="success" /> : null}
        {flags.photo === "hidden" ? <Alert title="A kép elrejtve a vendégek elől." variant="success" /> : null}
        {flags.photo === "shown" ? <Alert title="A kép ismét látható a vendéggalériában." variant="success" /> : null}
        {flags.error === "missing" ? <Alert title="A galéria neve kötelező." variant="error" /> : null}
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
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <label className="flex items-start gap-3 rounded-md border border-ink/10 bg-paper p-4">
              <input name="isActive" type="checkbox" defaultChecked={gallery.isActive} className="mt-1 size-4 accent-ink" />
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
                className="mt-1 size-4 accent-ink"
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
            <span>{gallery.guestUploads.length} / {gallery.guestUploadLimit} kép{processingCount > 0 ? ` · ${processingCount} feldolgozás alatt` : ""}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink/10">
            <div className="h-full rounded-full bg-sage transition-[width]" style={{ width: `${capacityPercent}%` }} />
          </div>
        </div>

        {gallery.guestUploads.length > 0 ? (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {gallery.guestUploads.map((photo) => {
              const visible = photo.status === "visible";
              const pendingReview = photo.status === "pending_review";
              const canModerate = photo.status !== "pending";
              const identity = photo.guestName || photo.email || "Névtelen vendég";
              const statusLabel = visible ? "Látható" : pendingReview ? "Jóváhagyásra vár" : photo.status === "pending" ? "Feltöltés alatt" : "Elrejtve";
              const statusClass = visible ? "bg-sage text-white" : pendingReview ? "bg-brass text-white" : photo.status === "pending" ? "bg-graphite text-white" : "bg-ink/75 text-white";

              return (
                <article key={photo.id} className={`overflow-hidden rounded-md border bg-paper ${visible ? "border-ink/10" : pendingReview ? "border-brass/40" : "border-amber-200 opacity-75"}`}>
                  <div className="relative aspect-square overflow-hidden bg-mist">
                    {photo.imageUrl ? (
                      <Image
                        src={photo.thumbnailUrl || photo.previewUrl || photo.imageUrl}
                        alt={photo.filename}
                        fill
                        unoptimized
                        className="object-cover"
                        sizes="(min-width: 1280px) 20vw, (min-width: 768px) 25vw, 50vw"
                      />
                    ) : null}
                    <span className={`absolute left-2 top-2 rounded-full px-2 py-1 text-[10px] font-semibold ${statusClass}`}>
                      {statusLabel}
                    </span>
                    {photo.processingStatus === "failed" ? (
                      <span className="absolute bottom-2 right-2 rounded-full bg-red-700 px-2 py-1 text-[10px] font-semibold text-white">Feldolgozási hiba</span>
                    ) : photo.processingStatus !== "ready" && photo.status !== "pending" ? (
                      <span className="absolute bottom-2 right-2 rounded-full bg-ink/75 px-2 py-1 text-[10px] font-semibold text-white">Előnézet készül</span>
                    ) : null}
                  </div>
                  <div className="p-3">
                    <p className="truncate text-xs font-semibold text-ink" title={photo.filename}>{photo.filename}</p>
                    <p className="mt-1 truncate text-[11px] text-graphite/55" title={identity}>{identity}</p>
                    {photo.guestName && photo.email ? <p className="mt-1 truncate text-[11px] text-graphite/45" title={photo.email}>{photo.email}</p> : null}
                    <p className="mt-1 text-[11px] text-graphite/55">{formatFileSize(photo.fileSize)}</p>
                    {canModerate ? (
                      <form action={setGuestPhotoVisibilityAction.bind(null, gallery.id, photo.id, !visible)} className="mt-3">
                        <button
                          type="submit"
                          className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-ink/10 bg-white px-2 text-xs font-medium text-ink transition hover:bg-ink/5"
                        >
                          {visible ? <EyeOff size={14} /> : <Eye size={14} />}
                          {visible ? "Elrejtés" : pendingReview ? "Jóváhagyás" : "Megjelenítés"}
                        </button>
                      </form>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-5 rounded-md border border-dashed border-ink/15 bg-paper px-5 py-12 text-center">
            <UploadCloud className="mx-auto text-graphite/40" size={24} />
            <p className="mt-3 text-sm font-medium text-ink">Még nincs vendégfeltöltés</p>
            <p className="mt-1 text-xs text-graphite/60">Oszd meg a QR-kódot vagy a vendéglinket az első képekhez.</p>
          </div>
        )}
      </section>
    </AdminShell>
  );
}
