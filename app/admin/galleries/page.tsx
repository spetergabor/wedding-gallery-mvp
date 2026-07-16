import Image from "next/image";
import Link from "next/link";
import { Camera, ExternalLink, Film, Plus } from "lucide-react";
import { Alert } from "@/components/alert";
import { AdminShell } from "@/components/admin-shell";
import { ButtonLink } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { requireAdmin } from "@/lib/auth";
import { adminOwnedWhere, ownerAdminId } from "@/lib/admin-scope";
import { customerTypeLabel } from "@/lib/customer-options";
import { publicGalleryUrl } from "@/lib/email";
import { toggleGalleryActiveFromListAction } from "@/lib/gallery-actions";
import { prisma } from "@/lib/prisma";
import { GALLERY_MODE_ALBUM_SOURCE } from "@/lib/proofing";

export default async function AdminGalleriesPage({
  searchParams
}: {
  searchParams: Promise<{ deleted?: string; updated?: string }>;
}) {
  const admin = await requireAdmin();
  const flags = await searchParams;
  const galleryWhere = {
    ...adminOwnedWhere(admin),
    galleryMode: { not: GALLERY_MODE_ALBUM_SOURCE }
  };
  const workspaceAdminId = ownerAdminId(admin);

  const [galleries, siteSettings] = await Promise.all([
    prisma.gallery.findMany({
      where: galleryWhere,
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { photos: true } },
        customer: {
          select: {
            id: true,
            customerType: true,
            coupleName: true,
            preferredLanguage: true
          }
        },
        photos: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          select: { id: true, imageUrl: true, thumbnailUrl: true, filename: true, mediaType: true },
          take: 4
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
          <p className="text-xs uppercase tracking-[0.16em] text-graphite/60">Galériák</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">Galériakezelés</h1>
          <p className="mt-3 max-w-2xl text-sm text-graphite/70">
            A galériák mostantól ügyfelekhez kapcsolódnak. Új munka előtt érdemes az ügyfél adatlapjáról indítani.
          </p>
        </div>
        <ButtonLink href="/admin/galleries/new" variant="secondary">
          Új galéria
        </ButtonLink>
      </div>

      {flags.deleted ? (
        <div className="mb-5">
          <Alert title="Galéria törölve." variant="success">A local feltöltött fájlokat is eltávolítottam.</Alert>
        </div>
      ) : null}
      {flags.updated ? (
        <div className="mb-5">
          <Alert title="Galéria állapota frissítve." variant="success" />
        </div>
      ) : null}

      {galleries.length === 0 ? (
        <EmptyState
          icon={<Camera size={22} />}
          title="Még nincs galéria"
          description="Hozd létre az első esküvői galériát, add meg a nevet, és a slug automatikusan elkészül."
          action={
            <ButtonLink href="/admin/galleries/new">
              <Plus size={16} />
              Új galéria
            </ButtonLink>
          }
        />
      ) : (
        <section className="overflow-hidden rounded-md border border-ink/10 bg-white">
          <div className="divide-y divide-ink/10">
            {galleries.map((gallery) => {
              const galleryPublicUrl = publicGalleryUrl(gallery.slug, gallery.customer?.preferredLanguage, publicSubdomain);

              return (
                <div key={gallery.id} className="grid gap-4 px-5 py-5 md:grid-cols-[1fr_auto] md:items-center">
                  <Link href={`/admin/galleries/${gallery.id}`} className="grid gap-4 sm:grid-cols-[86px_1fr] sm:items-center">
                    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md border border-ink/10 bg-paper sm:w-20">
                      {(() => {
                        const cover =
                          gallery.photos.find((photo) => photo.id === gallery.coverPhotoId && photo.thumbnailUrl !== photo.imageUrl) ??
                          gallery.photos.find((photo) => photo.thumbnailUrl !== photo.imageUrl);

                        return cover ? (
                          cover.mediaType === "video" ? (
                            <div className="grid h-full place-items-center bg-ink text-white">
                              <Film size={20} />
                            </div>
                          ) : (
                            <Image
                              src={cover.thumbnailUrl}
                              alt={cover.filename}
                              fill
                              unoptimized
                              className="object-cover"
                              sizes="96px"
                              style={{ objectPosition: `${gallery.coverPositionX ?? 50}% ${gallery.coverPositionY ?? 50}%` }}
                            />
                          )
                        ) : (
                          <div className="flex h-full items-center justify-center text-graphite/50">
                            <Camera size={20} />
                          </div>
                        );
                      })()}
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-ink">{gallery.title}</p>
                      <p className="mt-1 text-sm text-graphite/70">/g/{gallery.slug} · {gallery._count.photos} média</p>
                      <p className="mt-1 text-sm text-graphite/60">
                        {gallery.customer
                          ? `Ügyfél: ${gallery.customer.coupleName} · ${customerTypeLabel(gallery.customer.customerType)}`
                          : "Nincs ügyfélhez rendelve"}
                      </p>
                    </div>
                  </Link>
                  <div className="flex items-center gap-3">
                    <form action={toggleGalleryActiveFromListAction.bind(null, gallery.id, !gallery.isActive)}>
                      <button
                        type="submit"
                        role="switch"
                        aria-checked={gallery.isActive}
                        aria-label={gallery.isActive ? `${gallery.title} kikapcsolása` : `${gallery.title} aktiválása`}
                        className={`inline-flex min-w-[116px] items-center gap-2 rounded-full border px-2 py-1 text-xs font-semibold transition hover:shadow-sm ${
                          gallery.isActive
                            ? "border-sage/25 bg-sage/10 text-sage hover:bg-sage/15"
                            : "border-ink/10 bg-ink/5 text-graphite hover:bg-ink/10"
                        }`}
                      >
                        <span
                          className={`relative h-5 w-9 rounded-full transition ${
                            gallery.isActive ? "bg-sage" : "bg-graphite/35"
                          }`}
                          aria-hidden="true"
                        >
                          <span
                            className={`absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition ${
                              gallery.isActive ? "translate-x-[18px]" : "translate-x-0.5"
                            }`}
                          />
                        </span>
                        {gallery.isActive ? "Aktív" : "Kikapcsolt"}
                      </button>
                    </form>
                    <a
                      className="flex size-10 items-center justify-center rounded-md border border-ink/10 hover:bg-ink/5"
                      href={galleryPublicUrl}
                      target="_blank"
                    >
                      <ExternalLink size={16} />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </AdminShell>
  );
}
