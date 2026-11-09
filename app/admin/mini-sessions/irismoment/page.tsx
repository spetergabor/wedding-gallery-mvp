import { ArrowLeft, CalendarClock, CheckCircle2, KeyRound, Settings2, Tag, Unplug } from "lucide-react";
import { cookies } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { FormSubmitButton } from "@/components/form-submit-button";
import { ownerAdminId } from "@/lib/admin-scope";
import { requireAdmin } from "@/lib/auth";
import {
  generateIrisRetouchTokenAction,
  revokeIrisRetouchTokenAction,
  setIrisRetouchTagAction
} from "@/lib/iris-retouch-actions";
import { IRIS_FULFILLMENT_MODE } from "@/lib/iris-retouch-auth";
import { prisma } from "@/lib/prisma";

export default async function IrisMomentIntegrationPage({
  searchParams
}: {
  searchParams: Promise<{ created?: string; revoked?: string }>;
}) {
  const admin = await requireAdmin();
  const adminId = ownerAdminId(admin);
  const flags = await searchParams;
  const oneTimeToken = flags.created ? (await cookies()).get("irismoment_token_once")?.value : undefined;
  const [integration, sessions] = await Promise.all([
    prisma.irisRetouchIntegration.findUnique({ where: { adminId } }),
    prisma.miniSession.findMany({
      where: { adminId },
      orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        bookingMode: true,
        startsAt: true,
        isActive: true,
        fulfillmentMode: true,
        _count: { select: { bookings: true } }
      }
    })
  ]);
  const irisSessions = sessions.filter((session) => session.fulfillmentMode === IRIS_FULFILLMENT_MODE);
  const otherSessions = sessions.filter((session) => session.fulfillmentMode !== IRIS_FULFILLMENT_MODE);

  return (
    <AdminShell>
      <Link href="/admin/mini-sessions" className="inline-flex items-center gap-2 text-sm font-medium text-graphite hover:text-ink">
        <ArrowLeft size={15} /> Vissza a foglalási központhoz
      </Link>
      <div className="mt-5 max-w-3xl space-y-5">
        <section className="rounded-lg border border-ink/10 bg-white p-6 shadow-soft">
          <Image
            src="/brand/irismoment-logo.png"
            alt="irismoment"
            width={88}
            height={88}
            className="size-[88px] rounded-2xl object-cover"
            priority
          />
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-brass">Integráció</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">irismoment kapcsolat</h1>
          <p className="mt-3 text-sm leading-6 text-graphite/70">
            Az irismoment biztonságosan betöltheti az íriszfoglalásokat, érkeztetheti a vendégeket és visszaírhatja a gyártási állapotot. Galéria és Spetly-ügyfél nem készül.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-md bg-paper p-4">
              <p className="text-xs uppercase tracking-[0.13em] text-graphite/55">Kapcsolat</p>
              <p className="mt-2 flex items-center gap-2 font-semibold text-ink">
                {integration ? <><CheckCircle2 size={16} className="text-sage" /> Aktív</> : <><Unplug size={16} /> Nincs összekapcsolva</>}
              </p>
            </div>
            <div className="rounded-md bg-paper p-4">
              <p className="text-xs uppercase tracking-[0.13em] text-graphite/55">irismoment címkével</p>
              <p className="mt-2 text-2xl font-semibold text-ink">{irisSessions.length}</p>
            </div>
          </div>

          {oneTimeToken ? (
            <div className="mt-6 rounded-md border border-brass/30 bg-brass/10 p-4">
              <p className="font-semibold text-ink">Új kapcsolódási kulcs</p>
              <p className="mt-1 text-xs text-graphite/65">Kattints a maszkolt mezőre, másold ki ⌘C-vel, majd illeszd be az irismoment alkalmazásba. Biztonsági okból később nem jelenik meg újra.</p>
              <input type="password" readOnly value={oneTimeToken} className="mt-3 h-11 w-full rounded-md border border-ink/15 bg-white px-3 font-mono text-sm text-ink" />
            </div>
          ) : null}
          {flags.revoked ? <p className="mt-5 rounded-md bg-sage/10 p-3 text-sm font-medium text-sage">A kapcsolat visszavonva.</p> : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <form action={generateIrisRetouchTokenAction}>
              <FormSubmitButton pendingLabel="Kulcs készítése..."><KeyRound size={16} /> {integration ? "Új kulcs készítése" : "Kapcsolódási kulcs készítése"}</FormSubmitButton>
            </form>
            {integration ? (
              <form action={revokeIrisRetouchTokenAction}>
                <FormSubmitButton variant="danger" pendingLabel="Visszavonás..."><Unplug size={16} /> Kapcsolat visszavonása</FormSubmitButton>
              </form>
            ) : null}
          </div>
          {integration?.lastUsedAt ? <p className="mt-4 text-xs text-graphite/55">Utoljára használva: {integration.lastUsedAt.toLocaleString("hu-HU")}</p> : null}
        </section>

        <section className="rounded-lg border border-ink/10 bg-white p-6 shadow-soft">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brass/15 text-brass"><Tag size={18} /></div>
            <div>
              <h2 className="text-xl font-semibold text-ink">irismoment címkével ellátott foglalók</h2>
              <p className="mt-1 text-sm leading-6 text-graphite/70">
                Csak az itt megjelölt szolgáltatások és mini session napok jelennek meg az irismoment alkalmazásban. A szám a foglalási oldalak darabszáma, nem a vendégfoglalásoké.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-2">
            {irisSessions.length === 0 ? (
              <p className="rounded-md border border-dashed border-ink/15 bg-paper px-4 py-5 text-sm text-graphite/70">Még nincs irismoment címkével ellátott foglaló.</p>
            ) : irisSessions.map((session) => (
              <div key={session.id} className="flex flex-col gap-3 rounded-md border border-brass/20 bg-brass/5 px-4 py-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold text-ink">{session.title}</p>
                    <span className="rounded-full bg-brass/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-brass">irismoment</span>
                    {!session.isActive ? <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[10px] font-medium text-graphite">Rejtett</span> : null}
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-graphite/60">
                    <span className="inline-flex items-center gap-1"><CalendarClock size={12} /> {session.startsAt.toLocaleDateString("hu-HU")}</span>
                    <span>{session.bookingMode === "recurring" ? "Állandó szolgáltatás" : "Mini session nap"}</span>
                    <span>{session._count.bookings} vendégfoglalás</span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link href={`/admin/mini-sessions/${session.id}?tab=settings`} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-ink/10 px-3 text-sm font-medium text-ink hover:bg-ink/5">
                    <Settings2 size={14} /> Beállítás
                  </Link>
                  <form action={setIrisRetouchTagAction.bind(null, session.id, false)}>
                    <FormSubmitButton variant="secondary" pendingLabel="Eltávolítás...">Címke le</FormSubmitButton>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </section>

        {otherSessions.length > 0 ? (
          <section className="rounded-lg border border-ink/10 bg-white p-6 shadow-soft">
            <h2 className="text-xl font-semibold text-ink">Más foglalók</h2>
            <p className="mt-1 text-sm leading-6 text-graphite/70">Egy kattintással megjelölheted azokat a meglévő napokat is, amelyeket az irismoment alkalmazásban szeretnél látni.</p>
            <div className="mt-5 divide-y divide-ink/10 overflow-hidden rounded-md border border-ink/10">
              {otherSessions.map((session) => (
                <div key={session.id} className="flex flex-col gap-3 bg-white px-4 py-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink">{session.title}</p>
                    <p className="mt-1 text-xs text-graphite/60">{session.startsAt.toLocaleDateString("hu-HU")} · {session._count.bookings} vendégfoglalás</p>
                  </div>
                  <form action={setIrisRetouchTagAction.bind(null, session.id, true)}>
                    <FormSubmitButton variant="secondary" pendingLabel="Jelölés..."><Tag size={14} /> Iris címke hozzáadása</FormSubmitButton>
                  </form>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </AdminShell>
  );
}
