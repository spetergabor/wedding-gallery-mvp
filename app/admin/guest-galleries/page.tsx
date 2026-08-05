import Link from "next/link";
import { Archive, CalendarDays, ExternalLink, Plus, QrCode, UploadCloud, UserCog } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Alert } from "@/components/alert";
import { ButtonLink } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { GalleryActiveSwitch } from "@/components/gallery-active-switch";
import { adminOwnedWhere, ownerAdminId } from "@/lib/admin-scope";
import { requireAdmin } from "@/lib/auth";
import { publicGalleryUrl } from "@/lib/email";
import { toggleGuestGalleryActiveAction } from "@/lib/guest-gallery-actions";
import { prisma } from "@/lib/prisma";
import { GALLERY_MODE_GUEST } from "@/lib/proofing";

function formatDate(date: Date | null) {
  if (!date) {
    return "Nincs dátum megadva";
  }

  return new Intl.DateTimeFormat("hu-HU", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC"
  }).format(date);
}

export default async function GuestGalleriesPage({
  searchParams
}: {
  searchParams: Promise<{ updated?: string; error?: string }>;
}) {
  const admin = await requireAdmin();
  const flags = await searchParams;
  const workspaceAdminId = ownerAdminId(admin);
  const [galleries, siteSettings] = await Promise.all([
    prisma.gallery.findMany({
      where: {
        ...adminOwnedWhere(admin),
        galleryMode: GALLERY_MODE_GUEST
      },
      orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
      include: {
        _count: { select: { guestUploads: true } },
        customer: {
          select: {
            id: true,
            coupleName: true,
            preferredLanguage: true
          }
        }
      }
    }),
    prisma.siteSettings.findUnique({
      where: { adminId: workspaceAdminId },
      select: { publicSubdomain: true }
    })
  ]);
  const publicSubdomain = siteSettings?.publicSubdomain ?? null;

  return (
    <AdminShell>
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-graphite/60">Vendéggalériák</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">Közös esküvői pillanatok</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-graphite/70">
            Készíts külön QR-kódos galériát, ahová a vendégek feltölthetik a saját fotóikat, és közösen láthatják az esemény képeit.
          </p>
        </div>
        <ButtonLink href="/admin/guest-galleries/new">
          <Plus size={16} />
          Új vendéggaléria
        </ButtonLink>
      </div>

      <div className="mb-5 space-y-3">
        {flags.updated ? <Alert title="A vendéggaléria állapota frissítve." variant="success" /> : null}
        {flags.error === "missing" ? <Alert title="A vendéggaléria nem található." variant="error" /> : null}
      </div>

      {galleries.length === 0 ? (
        <EmptyState
          icon={<QrCode size={22} />}
          title="Még nincs vendéggaléria"
          description="Hozd létre az első eseményt, majd töltsd le vagy másold ki a vendégeknek szánt QR-linket."
          action={
            <ButtonLink href="/admin/guest-galleries/new">
              <Plus size={16} />
              Első vendéggaléria
            </ButtonLink>
          }
        />
      ) : (
        <section className="grid gap-4 xl:grid-cols-2">
          {galleries.map((gallery) => {
            const archived = Boolean(gallery.guestGalleryArchivedAt) || Boolean(gallery.guestGalleryExpiresAt && gallery.guestGalleryExpiresAt <= new Date());
            const currentlyActive = gallery.isActive && !archived;
            const publicUrl = publicGalleryUrl(
              gallery.slug,
              gallery.customer?.preferredLanguage,
              publicSubdomain
            );

            return (
              <article key={gallery.id} className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
                <div className="flex items-start justify-between gap-4">
                  <Link href={`/admin/guest-galleries/${gallery.id}`} className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <span className="grid size-11 shrink-0 place-items-center rounded-md bg-ink text-white">
                        <QrCode size={20} />
                      </span>
                      <div className="min-w-0">
                        <h2 className="truncate text-xl font-semibold text-ink">{gallery.title}</h2>
                        <p className="mt-1 flex items-center gap-2 truncate text-sm text-graphite/65">
                          /g/{gallery.slug}
                          {archived ? <span className="inline-flex items-center gap-1 rounded-full bg-ink/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"><Archive size={10} /> Archivált</span> : null}
                        </p>
                      </div>
                    </div>
                  </Link>
                  <form action={toggleGuestGalleryActiveAction.bind(null, gallery.id, !currentlyActive)}>
                    <GalleryActiveSwitch initialIsActive={currentlyActive} title={gallery.title} />
                  </form>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-md bg-paper px-3 py-3">
                    <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-graphite/55">
                      <UploadCloud size={14} /> Feltöltések
                    </p>
                    <p className="mt-1 text-lg font-semibold text-ink">{gallery._count.guestUploads}</p>
                  </div>
                  <div className="rounded-md bg-paper px-3 py-3 sm:col-span-2">
                    <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-graphite/55">
                      <CalendarDays size={14} /> Esemény
                    </p>
                    <p className="mt-1 truncate text-sm font-semibold text-ink">{formatDate(gallery.eventDate)}</p>
                  </div>
                </div>

                <p className="mt-4 text-sm text-graphite/65">
                  {gallery.customer ? `Ügyfél: ${gallery.customer.coupleName}` : "Nincs ügyfélhez kapcsolva"}
                </p>

                <div className="mt-5 flex flex-col gap-2 border-t border-ink/10 pt-4 sm:flex-row">
                  <ButtonLink href={`/admin/guest-galleries/${gallery.id}`} variant="secondary" className="w-full sm:w-auto">
                    Kezelés és QR-kód
                  </ButtonLink>
                  {gallery.customer ? (
                    <ButtonLink href={`/admin/clients/${gallery.customer.id}?tab=portal#par-admin`} variant="secondary" className="w-full sm:w-auto">
                      <UserCog size={16} /> Pár-admin
                    </ButtonLink>
                  ) : null}
                  <a
                    href={archived ? `/admin/guest-galleries/${gallery.id}` : publicUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-ink/10 bg-white px-4 text-sm font-medium text-ink transition hover:bg-paper sm:w-auto"
                  >
                    {archived ? <Archive size={16} /> : <ExternalLink size={16} />}
                    {archived ? "Archivált" : "Megnyitás"}
                  </a>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </AdminShell>
  );
}
