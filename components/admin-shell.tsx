import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeftRight,
  Bell,
  BriefcaseBusiness,
  CalendarClock,
  Camera,
  ChevronDown,
  HardDrive,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Settings,
  Users
} from "lucide-react";
import { AdminLanguageSwitch } from "@/components/admin-language-switch";
import { AdminRoutePrefetcher } from "@/components/admin-route-prefetcher";
import { logoutAction } from "@/lib/gallery-actions";
import { getAdminSession, type AdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notificationWhere, ownerAdminId } from "@/lib/admin-scope";
import { ADMIN_SHELL_COPY, getAdminLanguage } from "@/lib/admin-language";
import { switchWorkspaceAction } from "@/lib/workspace-actions";

type AdminShellCopy = (typeof ADMIN_SHELL_COPY)[keyof typeof ADMIN_SHELL_COPY];

function workspaceDisplayName(admin: AdminSession, copy: AdminShellCopy) {
  return admin.isTeamWorkspace ? admin.teamOwnerName ?? copy.teamWorkspace : admin.name;
}

function WorkspaceStatusBanner({ admin, copy }: { admin: AdminSession | null; copy: AdminShellCopy }) {
  if (!admin?.isTeamMember) {
    return null;
  }

  const isTeamWorkspace = admin.isTeamWorkspace;
  const activeWorkspaceLabel = isTeamWorkspace ? copy.teamWorkspace : copy.ownWorkspace;
  const targetWorkspaceMode = isTeamWorkspace ? "own" : "team";
  const targetWorkspaceLabel = isTeamWorkspace ? copy.switchToOwnWorkspace : copy.switchToTeamWorkspace;

  return (
    <section
      className={`mb-6 rounded-md border bg-white px-4 py-3 shadow-soft ${
        isTeamWorkspace ? "border-brass/30" : "border-ink/10"
      }`}
      aria-label={copy.workspace}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md ${
              isTeamWorkspace ? "bg-brass/15 text-brass" : "bg-ink/5 text-ink"
            }`}
          >
            <BriefcaseBusiness size={17} />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-graphite/55">{copy.activeWorkspace}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-ink">
                {activeWorkspaceLabel}: {workspaceDisplayName(admin, copy)}
              </p>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  isTeamWorkspace ? "bg-brass/15 text-brass" : "bg-ink/5 text-ink"
                }`}
              >
                {activeWorkspaceLabel}
              </span>
            </div>
            <p className="mt-1 text-xs leading-5 text-graphite/65">
              {isTeamWorkspace ? copy.teamWorkspaceHint : copy.ownWorkspaceHint}
            </p>
          </div>
        </div>
        <form action={switchWorkspaceAction} className="shrink-0">
          <button
            type="submit"
            name="workspaceMode"
            value={targetWorkspaceMode}
            className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-ink/10 bg-white px-3 text-sm font-medium text-ink shadow-soft transition hover:bg-ink/5 sm:w-auto"
          >
            <ArrowLeftRight size={15} />
            {targetWorkspaceLabel}
          </button>
        </form>
      </div>
    </section>
  );
}

export async function AdminShell({ children }: { children: React.ReactNode }) {
  const [admin, language] = await Promise.all([getAdminSession(), getAdminLanguage()]);
  const copy = ADMIN_SHELL_COPY[language];
  const workspaceAdminId = admin ? ownerAdminId(admin) : null;
  const [unreadNotifications, settings] = await Promise.all([
    prisma.adminNotification.count({
      where: { ...notificationWhere(admin ?? { id: "", role: "photographer" }), readAt: null }
    }),
    admin
      ? prisma.siteSettings.findFirst({
          where: {
            OR: [{ adminId: workspaceAdminId }, ...(admin.role === "super_admin" ? [{ id: "default" }] : [])]
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

        {admin?.isTeamMember ? (
          <form action={switchWorkspaceAction} className="mt-6 rounded-md border border-ink/10 bg-white p-2">
            <p className="px-2 pb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-graphite/55">{copy.workspace}</p>
            <div className="grid grid-cols-2 gap-1">
              <button
                type="submit"
                name="workspaceMode"
                value="team"
                className={`min-h-9 rounded-md px-2 text-xs font-medium transition ${
                  admin.isTeamWorkspace ? "bg-ink text-white" : "text-graphite hover:bg-ink/5 hover:text-ink"
                }`}
              >
                {copy.teamWorkspace}
              </button>
              <button
                type="submit"
                name="workspaceMode"
                value="own"
                className={`min-h-9 rounded-md px-2 text-xs font-medium transition ${
                  admin.workspaceMode === "own" ? "bg-ink text-white" : "text-graphite hover:bg-ink/5 hover:text-ink"
                }`}
              >
                {copy.ownWorkspace}
              </button>
            </div>
            <p className="mt-2 px-2 text-xs leading-5 text-graphite/65">
              {admin.isTeamWorkspace ? admin.teamOwnerName ?? copy.teamWorkspace : admin.name}
            </p>
          </form>
        ) : null}

        <nav className={admin?.isTeamMember ? "mt-6 space-y-1" : "mt-10 space-y-1"} aria-label={copy.navigationLabel}>
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
          <Link className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-graphite hover:bg-ink/5" href="/admin/mini-sessions">
            <CalendarClock size={17} />
            Mini session
          </Link>
          {admin && !admin.isTeamMember ? (
            <Link className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-graphite hover:bg-ink/5" href="/admin/team">
              <Users size={17} />
              {copy.team}
            </Link>
          ) : null}
          {admin?.role === "super_admin" ? (
            <>
              <Link className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-graphite hover:bg-ink/5" href="/admin/photographers">
                <Users size={17} />
                {copy.photographers}
              </Link>
              <Link className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-graphite hover:bg-ink/5" href="/admin/r2-storage">
                <HardDrive size={17} />
                R2 tárhely
              </Link>
            </>
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
                {admin?.isTeamMember ? (
                  <form action={switchWorkspaceAction} className="border-b border-ink/10 p-2">
                    <p className="px-2 pb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-graphite/55">{copy.workspace}</p>
                    <div className="grid grid-cols-2 gap-1">
                      <button
                        type="submit"
                        name="workspaceMode"
                        value="team"
                        className={`min-h-10 rounded-md px-2 text-xs font-medium transition ${
                          admin.isTeamWorkspace ? "bg-ink text-white" : "text-graphite hover:bg-ink/5 hover:text-ink"
                        }`}
                      >
                        {copy.teamWorkspace}
                      </button>
                      <button
                        type="submit"
                        name="workspaceMode"
                        value="own"
                        className={`min-h-10 rounded-md px-2 text-xs font-medium transition ${
                          admin.workspaceMode === "own" ? "bg-ink text-white" : "text-graphite hover:bg-ink/5 hover:text-ink"
                        }`}
                      >
                        {copy.ownWorkspace}
                      </button>
                    </div>
                  </form>
                ) : null}
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
                  <Link className="flex items-center gap-3 rounded-md px-3 py-3 text-sm text-graphite hover:bg-ink/5" href="/admin/mini-sessions">
                    <CalendarClock size={17} />
                    Mini session
                  </Link>
                  {admin && !admin.isTeamMember ? (
                    <Link className="flex items-center gap-3 rounded-md px-3 py-3 text-sm text-graphite hover:bg-ink/5" href="/admin/team">
                      <Users size={17} />
                      {copy.team}
                    </Link>
                  ) : null}
                  {admin?.role === "super_admin" ? (
                    <>
                      <Link className="flex items-center gap-3 rounded-md px-3 py-3 text-sm text-graphite hover:bg-ink/5" href="/admin/photographers">
                        <Users size={17} />
                        {copy.photographers}
                      </Link>
                      <Link className="flex items-center gap-3 rounded-md px-3 py-3 text-sm text-graphite hover:bg-ink/5" href="/admin/r2-storage">
                        <HardDrive size={17} />
                        R2 tárhely
                      </Link>
                    </>
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
        <main className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-10">
          <WorkspaceStatusBanner admin={admin} copy={copy} />
          {children}
        </main>
      </div>
    </div>
  );
}
