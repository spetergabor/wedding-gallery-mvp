import { ArrowLeft, CheckCircle2, KeyRound, MonitorUp, Unplug } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { FormSubmitButton } from "@/components/form-submit-button";
import { ownerAdminId } from "@/lib/admin-scope";
import { requireAdmin } from "@/lib/auth";
import { generateIrisRetouchTokenAction, revokeIrisRetouchTokenAction } from "@/lib/iris-retouch-actions";
import { IRIS_FULFILLMENT_MODE } from "@/lib/iris-retouch-auth";
import { prisma } from "@/lib/prisma";

export default async function IrisRetouchIntegrationPage({
  searchParams
}: {
  searchParams: Promise<{ created?: string; revoked?: string }>;
}) {
  const admin = await requireAdmin();
  const adminId = ownerAdminId(admin);
  const flags = await searchParams;
  const oneTimeToken = flags.created ? (await cookies()).get("iris_retouch_token_once")?.value : undefined;
  const [integration, irisEventCount] = await Promise.all([
    prisma.irisRetouchIntegration.findUnique({ where: { adminId } }),
    prisma.miniSession.count({ where: { adminId, fulfillmentMode: IRIS_FULFILLMENT_MODE } })
  ]);

  return (
    <AdminShell>
      <Link href="/admin/mini-sessions" className="inline-flex items-center gap-2 text-sm font-medium text-graphite hover:text-ink">
        <ArrowLeft size={15} /> Vissza a foglalási központhoz
      </Link>
      <div className="mt-5 max-w-3xl space-y-5">
        <section className="rounded-lg border border-ink/10 bg-white p-6 shadow-soft">
          <div className="flex size-12 items-center justify-center rounded-full bg-ink text-white"><MonitorUp size={22} /></div>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-brass">Integráció</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">Iris Retouch kapcsolat</h1>
          <p className="mt-3 text-sm leading-6 text-graphite/70">
            Az Iris Retouch biztonságosan betöltheti az íriszfoglalásokat, érkeztetheti a vendégeket és visszaírhatja a gyártási állapotot. Galéria és Spetly-ügyfél nem készül.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-md bg-paper p-4">
              <p className="text-xs uppercase tracking-[0.13em] text-graphite/55">Kapcsolat</p>
              <p className="mt-2 flex items-center gap-2 font-semibold text-ink">
                {integration ? <><CheckCircle2 size={16} className="text-sage" /> Aktív</> : <><Unplug size={16} /> Nincs összekapcsolva</>}
              </p>
            </div>
            <div className="rounded-md bg-paper p-4">
              <p className="text-xs uppercase tracking-[0.13em] text-graphite/55">Íriszes foglalók</p>
              <p className="mt-2 text-2xl font-semibold text-ink">{irisEventCount}</p>
            </div>
          </div>

          {oneTimeToken ? (
            <div className="mt-6 rounded-md border border-brass/30 bg-brass/10 p-4">
              <p className="font-semibold text-ink">Új kapcsolódási kulcs</p>
              <p className="mt-1 text-xs text-graphite/65">Másold be az Iris Retouch Spetly beállításába. Biztonsági okból később nem jelenik meg újra.</p>
              <input readOnly value={oneTimeToken} className="mt-3 h-11 w-full rounded-md border border-ink/15 bg-white px-3 font-mono text-sm text-ink" />
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
      </div>
    </AdminShell>
  );
}
