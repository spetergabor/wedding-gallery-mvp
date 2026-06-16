import Link from "next/link";
import { Camera, LayoutDashboard, LogOut, Plus, ShieldCheck } from "lucide-react";
import { logoutAction } from "@/lib/gallery-actions";

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-ink/10 bg-white/70 px-5 py-6 backdrop-blur lg:block">
        <Link href="/admin/dashboard" className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-ink text-white">
            <Camera size={20} />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">Wedding Gallery</p>
            <p className="text-xs text-graphite/70">Admin MVP</p>
          </div>
        </Link>

        <nav className="mt-10 space-y-1">
          <Link className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-graphite hover:bg-ink/5" href="/admin/dashboard">
            <LayoutDashboard size={17} />
            Dashboard
          </Link>
          <Link className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-graphite hover:bg-ink/5" href="/admin/galleries">
            <Camera size={17} />
            Galériák
          </Link>
          <Link className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-graphite hover:bg-ink/5" href="/admin/galleries/new">
            <Plus size={17} />
            Új galéria
          </Link>
          <Link className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-graphite hover:bg-ink/5" href="/admin/security">
            <ShieldCheck size={17} />
            Biztonság
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
              Wedding Gallery
            </Link>
            <Link href="/admin/galleries/new" className="rounded-md bg-ink px-3 py-2 text-xs font-medium text-white">
              Új
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-10">{children}</main>
      </div>
    </div>
  );
}
