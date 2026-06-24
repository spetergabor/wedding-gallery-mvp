import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { markAllNotificationsReadAction } from "@/lib/gallery-actions";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { notificationWhere } from "@/lib/admin-scope";
import { APP_TIME_ZONE } from "@/lib/date-format";
import { FormSubmitButton } from "@/components/form-submit-button";

export default async function AdminNotificationsPage() {
  const admin = await requireAdmin();
  const adminNotificationWhere = notificationWhere(admin);

  const [unreadCount, notifications] = await Promise.all([
    prisma.adminNotification.count({ where: { ...adminNotificationWhere, readAt: null } }),
    prisma.adminNotification.findMany({
      where: adminNotificationWhere,
      orderBy: { createdAt: "desc" },
      take: 50
    })
  ]);

  return (
    <AdminShell>
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-graphite/60">Admin</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">Értesítések</h1>
          <p className="mt-3 text-graphite/70">Kedvenc listák és későbbi ügyfél aktivitások admin jelzései.</p>
        </div>
        {unreadCount > 0 ? (
          <form action={markAllNotificationsReadAction}>
            <FormSubmitButton variant="secondary" pendingLabel="Frissítés...">
              <CheckCheck size={16} />
              Összes olvasottnak
            </FormSubmitButton>
          </form>
        ) : null}
      </div>

      <section className="rounded-md border border-ink/10 bg-white">
        <div className="divide-y divide-ink/10">
          {notifications.map((notification) => {
            const content = (
              <>
                <span className={`mt-1 flex size-10 shrink-0 items-center justify-center rounded-md ${notification.readAt ? "bg-paper text-graphite" : "bg-brass/15 text-brass"}`}>
                  <Bell size={18} />
                </span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-ink">{notification.title}</span>
                    {!notification.readAt ? <span className="rounded-full bg-brass/15 px-2 py-0.5 text-xs font-medium text-brass">Új</span> : null}
                  </span>
                  <span className="mt-1 block text-sm text-graphite/70">{notification.message}</span>
                  <span className="mt-2 block text-xs text-graphite/60">
                    {notification.createdAt.toLocaleString("hu-HU", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: APP_TIME_ZONE
                    })}
                  </span>
                </span>
              </>
            );

            return notification.href ? (
              <Link key={notification.id} href={notification.href} className="flex items-start gap-4 px-5 py-4 hover:bg-ink/[0.03]">
                {content}
              </Link>
            ) : (
              <div key={notification.id} className="flex items-start gap-4 px-5 py-4">
                {content}
              </div>
            );
          })}
          {notifications.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-md bg-paper text-graphite">
                <Bell size={20} />
              </div>
              <p className="mt-4 font-medium text-ink">Még nincs értesítés</p>
              <p className="mt-1 text-sm text-graphite/70">Ha egy ügyfél kedvenc listát kezd, itt fog megjelenni.</p>
            </div>
          ) : null}
        </div>
      </section>
    </AdminShell>
  );
}
