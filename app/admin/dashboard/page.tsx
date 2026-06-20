import Image from "next/image";
import Link from "next/link";
import { Bell, Camera, Film } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { ButtonLink } from "@/components/button";
import { StatCard } from "@/components/stat-card";
import { ViewLocationMap } from "@/components/view-location-map";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createViewLocationPoints } from "@/lib/view-location-points";
import { notificationWhere } from "@/lib/admin-scope";

function formatStorageSize(bytes: number) {
  if (bytes <= 0) {
    return "0 MB";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;

  return `${value >= 10 || exponent === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[exponent]}`;
}

export default async function AdminDashboardPage() {
  const admin = await requireAdmin();
  const galleryWhere = admin.role === "super_admin" ? {} : { adminId: admin.id };
  const photoWhere = admin.role === "super_admin" ? {} : { gallery: { adminId: admin.id } };
  const adminNotificationWhere = notificationWhere(admin);

  const [
    galleryCount,
    activeCount,
    photoCount,
    photoStorage,
    unreadNotifications,
    latestNotifications,
    latestGalleries,
    viewLocations
  ] = await Promise.all([
    prisma.gallery.count({ where: galleryWhere }),
    prisma.gallery.count({ where: { ...galleryWhere, isActive: true } }),
    prisma.photo.count({ where: photoWhere }),
    prisma.photo.aggregate({ where: photoWhere, _sum: { fileSize: true } }),
    prisma.adminNotification.count({ where: { ...adminNotificationWhere, readAt: null } }),
    prisma.adminNotification.findMany({
      where: adminNotificationWhere,
      orderBy: { createdAt: "desc" },
      take: 4
    }),
    prisma.gallery.findMany({
      where: galleryWhere,
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        _count: { select: { photos: true } },
        photos: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          select: { id: true, imageUrl: true, thumbnailUrl: true, filename: true, mediaType: true }
        }
      }
    }),
    prisma.galleryView.findMany({
      where: admin.role === "super_admin" ? {} : { gallery: { adminId: admin.id } },
      select: {
        city: true,
        country: true,
        latitude: true,
        longitude: true
      }
    })
  ]);
  const locationPoints = createViewLocationPoints(viewLocations);
  const totalStorageBytes = photoStorage._sum.fileSize ?? 0;

  return (
    <AdminShell>
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-brass">Admin</p>
          <h1 className="mt-2 text-4xl font-semibold text-ink">Dashboard</h1>
        </div>
        <ButtonLink href="/admin/galleries/new">Új galéria</ButtonLink>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Galériák" value={galleryCount} detail="Összes létrehozott galéria" />
        <StatCard label="Aktív" value={activeCount} detail="Publikusan elérhető galériák" />
        <StatCard label="Médiák" value={photoCount} detail="Adatbázisban rögzített képek és videók" />
        <StatCard label="R2 tárhely" value={formatStorageSize(totalStorageBytes)} detail="Feltöltött médiák összmérete" />
        <StatCard label="Új értesítések" value={unreadNotifications} detail="Olvasatlan admin jelzések" />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <section className="rounded-lg border border-ink/10 bg-white shadow-soft">
          <div className="flex items-center justify-between gap-4 border-b border-ink/10 px-5 py-4">
            <h2 className="text-lg font-semibold text-ink">Értesítések</h2>
            <Link href="/admin/notifications" className="text-sm font-medium text-ink hover:underline">
              Összes
            </Link>
          </div>
          <div className="divide-y divide-ink/10">
            {latestNotifications.map((notification) => (
              <Link
                key={notification.id}
                href={notification.href ?? "/admin/notifications"}
                className="flex items-start gap-4 px-5 py-4 hover:bg-ink/[0.03]"
              >
                <span className={`mt-1 flex size-9 shrink-0 items-center justify-center rounded-md ${notification.readAt ? "bg-paper text-graphite" : "bg-brass/15 text-brass"}`}>
                  <Bell size={17} />
                </span>
                <span className="min-w-0">
                  <span className="block font-medium text-ink">{notification.title}</span>
                  <span className="mt-1 block text-sm text-graphite/70">{notification.message}</span>
                  <span className="mt-2 block text-xs text-graphite/60">
                    {notification.createdAt.toLocaleString("hu-HU", {
                      dateStyle: "medium",
                      timeStyle: "short"
                    })}
                  </span>
                </span>
              </Link>
            ))}
            {latestNotifications.length === 0 ? (
              <div className="px-5 py-10 text-sm text-graphite/70">Még nincs értesítés.</div>
            ) : null}
          </div>
        </section>

        <section className="rounded-lg border border-ink/10 bg-white shadow-soft">
          <div className="border-b border-ink/10 px-5 py-4">
            <h2 className="text-lg font-semibold text-ink">Legutóbbi galériák</h2>
          </div>
          <div className="divide-y divide-ink/10">
            {latestGalleries.map((gallery) => (
              <a
                key={gallery.id}
                href={`/admin/galleries/${gallery.id}`}
                className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-ink/[0.03]"
              >
                <div className="flex min-w-0 items-center gap-4">
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-md bg-paper">
                    {(() => {
                      const cover =
                        gallery.photos.find((photo) => photo.id === gallery.coverPhotoId && photo.thumbnailUrl !== photo.imageUrl) ??
                        gallery.photos.find((photo) => photo.thumbnailUrl !== photo.imageUrl);

                      return cover ? (
                        cover.mediaType === "video" ? (
                          <div className="grid h-full place-items-center bg-ink text-white">
                            <Film size={18} />
                          </div>
                        ) : (
                          <Image src={cover.thumbnailUrl} alt={cover.filename} fill unoptimized className="object-cover" sizes="56px" />
                        )
                      ) : (
                        <div className="flex h-full items-center justify-center text-graphite/50">
                          <Camera size={18} />
                        </div>
                      );
                    })()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{gallery.title}</p>
                    <p className="truncate text-sm text-graphite/70">/g/{gallery.slug}</p>
                  </div>
                </div>
                <div className="text-right text-sm text-graphite/70">
                  <p>{gallery._count.photos} média</p>
                  <p>{gallery.isActive ? "Aktív" : "Inaktív"}</p>
                </div>
              </a>
            ))}
            {latestGalleries.length === 0 ? (
              <div className="px-5 py-10 text-sm text-graphite/70">Még nincs galéria.</div>
            ) : null}
          </div>
        </section>
      </div>

      <ViewLocationMap points={locationPoints} />
    </AdminShell>
  );
}
