import Link from "next/link";
import Image from "next/image";
import { Bell, Camera, LayoutDashboard, LogOut, Plus, Settings, ShieldCheck, Users } from "lucide-react";
import { AdminRoutePrefetcher } from "@/components/admin-route-prefetcher";
import { logoutAction } from "@/lib/gallery-actions";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notificationWhere } from "@/lib/admin-scope";

export async function AdminShell({ children }: { children: React.ReactNode }) {
  const admin = await getAdminSession();
  const [unreadNotifications, settings] = await Promise.all([
    prisma.adminNotification.count({
      where: { ...notificationWhere(admin ?? { id: "", role: "photographer" }), readAt: null }
    }),
    admin
      ? prisma.siteSettings.findFirst({
          where: {
            OR: [{ adminId: admin.id }, ...(admin.role === "super_admin" ? [{ id: "default" }] : [])]
          },
          select: {
            businessName: true,
            logoUrl: true
          }
        })
      : null
  ]);
  const brandName = settings?.businessName || "Wedding Gallery";

  return (
    <div className="min-h-screen bg-paper">
      <AdminRoutePrefetcher />
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-ink/10 bg-white/70 px-5 py-6 backdrop-blur lg:block">
        <Link href="/admin/dashboard" className="flex items-center gap-3">
          <div className="relative flex size-10 items-center justify-center overflow-hidden rounded-md bg-ink text-white">
            {settings?.logoUrl ? (
              <Image src={settings.logoUrl} alt={brandName} fill unoptimized className="object-contain p-1.5" sizes="40px" />
            ) : (
              <Camera size={20} />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">{brandName}</p>
            <p className="text-xs text-graphite/70">Admin MVP</p>
          </div>
        </Link>

        <nav className="mt-10 space-y-1">
          <Link className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-graphite hover:bg-ink/5" href="/admin/dashboard">
            <LayoutDashboard size={17} />
            Dashboard
          </Link>
          <Link className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-graphite hover:bg-ink/5" href="/admin/clients">
            <Users size={17} />
            Ügyfelek
          </Link>
          <Link className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-graphite hover:bg-ink/5" href="/admin/galleries">
            <Camera size={17} />
            Galériák
          </Link>
          {admin?.role === "super_admin" ? (
            <Link className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-graphite hover:bg-ink/5" href="/admin/photographers">
              <Users size={17} />
              Fotósok
            </Link>
          ) : null}
          <Link className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-graphite hover:bg-ink/5" href="/admin/clients/new">
            <Plus size={17} />
            Új ügyfél
          </Link>
          <Link className="flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm text-graphite hover:bg-ink/5" href="/admin/notifications">
            <span className="flex items-center gap-3">
              <Bell size={17} />
              Értesítések
            </span>
            {unreadNotifications > 0 ? (
              <span className="rounded-full bg-brass px-2 py-0.5 text-xs font-medium text-white">{unreadNotifications}</span>
            ) : null}
          </Link>
          <Link className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-graphite hover:bg-ink/5" href="/admin/security">
            <ShieldCheck size={17} />
            Biztonság
          </Link>
          <Link className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-graphite hover:bg-ink/5" href="/admin/settings">
            <Settings size={17} />
            Beállítások
          </Link>
        </nav>

        <form action={logoutAction} className="absolute bottom-6 left-5 right-5">
          <button className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-graphite hover:bg-ink/5">
            <LogOut size={17} />
            Kilépés
          </button>
        </form>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-ink/10 bg-paper/85 px-5 py-4 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between">
            <Link href="/admin/dashboard" className="text-sm font-semibold">
              {brandName}
            </Link>
            <div className="flex items-center gap-2">
              <Link href="/admin/notifications" className="relative rounded-md border border-ink/10 bg-white px-3 py-2 text-xs font-medium text-ink">
                Értesítések
                {unreadNotifications > 0 ? (
                  <span className="absolute -right-1 -top-1 size-4 rounded-full bg-brass text-[10px] leading-4 text-white">{unreadNotifications}</span>
                ) : null}
              </Link>
              <Link href="/admin/settings" className="rounded-md border border-ink/10 bg-white px-3 py-2 text-xs font-medium text-ink">
                Beáll.
              </Link>
              <Link href="/admin/clients/new" className="rounded-md bg-ink px-3 py-2 text-xs font-medium text-white">
                Új
              </Link>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-10">{children}</main>
      </div>
    </div>
  );
}
