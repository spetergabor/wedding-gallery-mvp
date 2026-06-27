import Link from "next/link";
import Image from "next/image";
import { Bell, Camera, ChevronDown, LayoutDashboard, LogOut, Menu, Plus, Settings, Users } from "lucide-react";
import { AdminLanguageSwitch } from "@/components/admin-language-switch";
import { AdminRoutePrefetcher } from "@/components/admin-route-prefetcher";
import { logoutAction } from "@/lib/gallery-actions";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notificationWhere } from "@/lib/admin-scope";
import { ADMIN_SHELL_COPY, getAdminLanguage } from "@/lib/admin-language";

export async function AdminShell({ children }: { children: React.ReactNode }) {
  const [admin, language] = await Promise.all([getAdminSession(), getAdminLanguage()]);
  const copy = ADMIN_SHELL_COPY[language];
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
            <p className="text-xs text-graphite/70">{copy.appArea}</p>
          </div>
        </Link>

        <nav className="mt-10 space-y-1" aria-label={copy.navigationLabel}>
          <Link className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-graphite hover:bg-ink/5" href="/admin/dashboard">
            <LayoutDashboard size={17} />
            {copy.dashboard}
          </Link>
          <Link className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-graphite hover:bg-ink/5" href="/admin/clients">
            <Users size={17} />
            {copy.clients}
          </Link>
          <Link className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-graphite hover:bg-ink/5" href="/admin/galleries">
            <Camera size={17} />
            {copy.galleries}
          </Link>
          {admin?.role === "super_admin" ? (
            <Link className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-graphite hover:bg-ink/5" href="/admin/photographers">
              <Users size={17} />
              {copy.photographers}
            </Link>
          ) : null}
          <Link className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-graphite hover:bg-ink/5" href="/admin/clients/new">
            <Plus size={17} />
            {copy.newClient}
          </Link>
          <Link className="flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm text-graphite hover:bg-ink/5" href="/admin/notifications">
            <span className="flex items-center gap-3">
              <Bell size={17} />
              {copy.notifications}
            </span>
            {unreadNotifications > 0 ? (
              <span className="rounded-full bg-brass px-2 py-0.5 text-xs font-medium text-white">{unreadNotifications}</span>
            ) : null}
          </Link>
          <Link className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-graphite hover:bg-ink/5" href="/admin/settings">
            <Settings size={17} />
            {copy.settings}
          </Link>
        </nav>

        <div className="absolute bottom-20 left-5 right-5">
          <AdminLanguageSwitch language={language} label={copy.language} />
        </div>

        <form action={logoutAction} className="absolute bottom-6 left-5 right-5">
          <button className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-graphite hover:bg-ink/5">
            <LogOut size={17} />
            {copy.logout}
          </button>
        </form>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-ink/10 bg-paper/85 px-5 py-4 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between">
            <Link href="/admin/dashboard" className="text-sm font-semibold">
              {brandName}
            </Link>
            <details className="group relative">
              <summary className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-md border border-ink/10 bg-white px-3 text-sm font-medium text-ink shadow-soft marker:hidden">
                <Menu size={17} />
                {copy.menu}
                {unreadNotifications > 0 ? (
                  <span className="grid size-5 place-items-center rounded-full bg-brass text-[11px] font-semibold text-white">{unreadNotifications}</span>
                ) : null}
                <ChevronDown size={15} className="transition group-open:rotate-180" />
              </summary>
              <div className="absolute right-0 mt-2 w-[min(86vw,320px)] overflow-hidden rounded-lg border border-ink/10 bg-white shadow-soft">
                <nav className="p-2" aria-label={copy.mobileNavigationLabel}>
                  <Link className="flex items-center gap-3 rounded-md px-3 py-3 text-sm text-graphite hover:bg-ink/5" href="/admin/dashboard">
                    <LayoutDashboard size={17} />
                    {copy.dashboard}
                  </Link>
                  <Link className="flex items-center gap-3 rounded-md px-3 py-3 text-sm text-graphite hover:bg-ink/5" href="/admin/clients">
                    <Users size={17} />
                    {copy.clients}
                  </Link>
                  <Link className="flex items-center gap-3 rounded-md px-3 py-3 text-sm text-graphite hover:bg-ink/5" href="/admin/galleries">
                    <Camera size={17} />
                    {copy.galleries}
                  </Link>
                  {admin?.role === "super_admin" ? (
                    <Link className="flex items-center gap-3 rounded-md px-3 py-3 text-sm text-graphite hover:bg-ink/5" href="/admin/photographers">
                      <Users size={17} />
                      {copy.photographers}
                    </Link>
                  ) : null}
                  <Link className="flex items-center gap-3 rounded-md px-3 py-3 text-sm text-graphite hover:bg-ink/5" href="/admin/clients/new">
                    <Plus size={17} />
                    {copy.newClient}
                  </Link>
                  <Link className="flex items-center justify-between gap-3 rounded-md px-3 py-3 text-sm text-graphite hover:bg-ink/5" href="/admin/notifications">
                    <span className="flex items-center gap-3">
                      <Bell size={17} />
                      {copy.notifications}
                    </span>
                    {unreadNotifications > 0 ? (
                      <span className="rounded-full bg-brass px-2 py-0.5 text-xs font-medium text-white">{unreadNotifications}</span>
                    ) : null}
                  </Link>
                  <Link className="flex items-center gap-3 rounded-md px-3 py-3 text-sm text-graphite hover:bg-ink/5" href="/admin/settings">
                    <Settings size={17} />
                    {copy.settings}
                  </Link>
                </nav>
                <div className="border-t border-ink/10 p-2">
                  <AdminLanguageSwitch language={language} label={copy.language} compact />
                </div>
                <form action={logoutAction} className="border-t border-ink/10 p-2">
                  <button className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-sm text-graphite hover:bg-ink/5">
                    <LogOut size={17} />
                    {copy.logout}
                  </button>
                </form>
              </div>
            </details>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-10">{children}</main>
      </div>
    </div>
  );
}
