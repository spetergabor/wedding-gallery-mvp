import Image from "next/image";
import { Camera, ExternalLink, Film, Plus } from "lucide-react";
import { Alert } from "@/components/alert";
import { AdminShell } from "@/components/admin-shell";
import { ButtonLink } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AdminGalleriesPage({
  searchParams
}: {
  searchParams: Promise<{ deleted?: string }>;
}) {
  const admin = await requireAdmin();
  const flags = await searchParams;
  const galleryWhere = admin.role === "super_admin" ? {} : { adminId: admin.id };

  const galleries = await prisma.gallery.findMany({
    where: galleryWhere,
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { photos: true } },
      photos: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true, imageUrl: true, thumbnailUrl: true, filename: true, mediaType: true }
      }
    }
  });

  return (
    <AdminShell>
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-brass">Galériák</p>
          <h1 className="mt-2 text-4xl font-semibold text-ink">Galériakezelés</h1>
        </div>
        <ButtonLink href="/admin/galleries/new">Új galéria</ButtonLink>
      </div>

      {flags.deleted ? (
        <div className="mb-5">
          <Alert title="Galéria törölve." variant="success">A local feltöltött fájlokat is eltávolítottam.</Alert>
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
      <section className="overflow-hidden rounded-lg border border-ink/10 bg-white shadow-soft">
        <div className="divide-y divide-ink/10">
          {galleries.map((gallery) => (
            <div key={gallery.id} className="grid gap-4 px-5 py-5 md:grid-cols-[1fr_auto] md:items-center">
              <a href={`/admin/galleries/${gallery.id}`} className="grid gap-4 sm:grid-cols-[96px_1fr] sm:items-center">
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md bg-paper sm:w-24">
                  {(() => {
                    const cover = gallery.photos.find((photo) => photo.id === gallery.coverPhotoId) ?? gallery.photos[0];

                    return cover ? (
                      cover.mediaType === "video" ? (
                        <div className="grid h-full place-items-center bg-ink text-white">
                          <Film size={20} />
                        </div>
                      ) : (
                        <Image src={cover.thumbnailUrl} alt={cover.filename} fill unoptimized className="object-cover" sizes="96px" />
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
                </div>
              </a>
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${gallery.isActive ? "bg-sage/15 text-sage" : "bg-ink/5 text-graphite"}`}>
                  {gallery.isActive ? "Aktív" : "Archivált"}
                </span>
                <a className="flex size-10 items-center justify-center rounded-md border border-ink/10 hover:bg-ink/5" href={`/g/${gallery.slug}`} target="_blank">
                  <ExternalLink size={16} />
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>
      )}
    </AdminShell>
  );
}
