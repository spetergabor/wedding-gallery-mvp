import { CheckCircle2, Laptop2, ShieldCheck, TimerOff } from "lucide-react";
import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { FormSubmitButton } from "@/components/form-submit-button";
import { approveIrisMomentDeviceAction } from "@/lib/iris-retouch-actions";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export default async function AuthorizeIrisMomentDevicePage({
  searchParams
}: {
  searchParams: Promise<{ id?: string; approved?: string; expired?: string }>;
}) {
  await requireAdmin();
  const flags = await searchParams;
  const authorization = flags.id
    ? await prisma.irisMomentDeviceAuthorization.findUnique({ where: { id: flags.id } })
    : null;
  const expired = !authorization || authorization.expiresAt <= new Date() || Boolean(flags.expired);
  const approved = authorization?.status === "approved" || Boolean(flags.approved);

  return (
    <AdminShell>
      <div className="mx-auto max-w-xl rounded-lg border border-ink/10 bg-white p-7 shadow-soft">
        <div className="flex size-12 items-center justify-center rounded-full bg-brass/15 text-brass">
          <Laptop2 size={24} />
        </div>
        <h1 className="mt-5 text-2xl font-semibold text-ink">irismoment eszköz kapcsolása</h1>
        {approved ? (
          <div className="mt-5 rounded-md bg-sage/10 p-5 text-sage">
            <p className="flex items-center gap-2 font-semibold"><CheckCircle2 size={18} /> Az eszköz engedélyezve</p>
            <p className="mt-2 text-sm">Visszatérhetsz az irismoment alkalmazásba. A közös munkatér automatikusan megjelenik.</p>
          </div>
        ) : expired ? (
          <div className="mt-5 rounded-md bg-red-50 p-5 text-red-700">
            <p className="flex items-center gap-2 font-semibold"><TimerOff size={18} /> A kapcsolási kérés lejárt</p>
            <p className="mt-2 text-sm">Indíts új bejelentkezést az irismoment alkalmazásból.</p>
          </div>
        ) : (
          <>
            <div className="mt-5 rounded-md bg-paper p-5">
              <p className="text-xs uppercase tracking-[0.13em] text-graphite/55">Kapcsolódó eszköz</p>
              <p className="mt-2 text-lg font-semibold text-ink">{authorization.deviceName}</p>
              {authorization.appVersion ? <p className="mt-1 text-sm text-graphite/60">irismoment {authorization.appVersion}</p> : null}
            </div>
            <p className="mt-4 flex items-start gap-2 text-sm leading-6 text-graphite/70">
              <ShieldCheck size={18} className="mt-0.5 shrink-0 text-sage" />
              Az engedélyezés után ez a gép a munkatér közös eseményeit és ügyféladatait láthatja és szerkesztheti.
            </p>
            <form action={approveIrisMomentDeviceAction.bind(null, authorization.id)} className="mt-6">
              <FormSubmitButton pendingLabel="Engedélyezés…"><ShieldCheck size={16} /> Eszköz engedélyezése</FormSubmitButton>
            </form>
          </>
        )}
        <Link href="/admin/mini-sessions/irismoment" className="mt-6 inline-block text-sm font-medium text-graphite hover:text-ink">
          Vissza az irismoment kapcsolathoz
        </Link>
      </div>
    </AdminShell>
  );
}
