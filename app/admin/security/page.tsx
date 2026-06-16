import QRCode from "qrcode";
import { KeyRound, ShieldCheck, ShieldOff } from "lucide-react";
import { Alert } from "@/components/alert";
import { AdminShell } from "@/components/admin-shell";
import { Button } from "@/components/button";
import { disableTwoFactorAction, enableTwoFactorAction } from "@/lib/gallery-actions";
import { prisma } from "@/lib/prisma";
import { createTotpUri, generateTotpSecret } from "@/lib/totp";
import { requireAdmin } from "@/lib/auth";

export default async function AdminSecurityPage({
  searchParams
}: {
  searchParams: Promise<{
    disabled?: string;
    enabled?: string;
    error?: string;
  }>;
}) {
  const [adminSession, params] = await Promise.all([requireAdmin(), searchParams]);
  const admin = await prisma.admin.findUnique({
    where: { id: adminSession.id },
    select: {
      email: true,
      twoFactorEnabled: true
    }
  });

  if (!admin) {
    return null;
  }

  const setupSecret = admin.twoFactorEnabled ? null : generateTotpSecret();
  const qrCodeDataUrl = setupSecret
    ? await QRCode.toDataURL(
        createTotpUri({
          accountName: admin.email,
          issuer: "Wedding Gallery",
          secret: setupSecret
        }),
        {
          margin: 1,
          scale: 7
        }
      )
    : null;

  return (
    <AdminShell>
      <div className="mb-8">
        <p className="text-sm uppercase tracking-[0.24em] text-brass">Admin</p>
        <h1 className="mt-2 text-4xl font-semibold text-ink">Biztonság</h1>
        <p className="mt-3 max-w-2xl text-graphite/70">
          Kétfaktoros hitelesítés az admin belépéshez. Bekapcsolás után a jelszó mellett egy 6 jegyű authenticator kód is kell.
        </p>
      </div>

      <div className="mb-5 space-y-3">
        {params.enabled ? <Alert title="Kétfaktoros hitelesítés bekapcsolva." variant="success" /> : null}
        {params.disabled ? <Alert title="Kétfaktoros hitelesítés kikapcsolva." variant="success" /> : null}
        {params.error === "code" ? <Alert title="Hibás ellenőrző kód." variant="error">Nézd meg, hogy az authenticator appban látható friss 6 jegyű kódot írtad-e be.</Alert> : null}
        {params.error === "password" ? <Alert title="Hibás jelszó." variant="error">A kikapcsoláshoz az aktuális admin jelszó kell.</Alert> : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-lg border border-ink/10 bg-white p-6 shadow-soft">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-ink">Kétfaktoros hitelesítés</h2>
              <p className="mt-2 text-sm text-graphite/70">
                Állapot: <span className="font-medium text-ink">{admin.twoFactorEnabled ? "bekapcsolva" : "nincs bekapcsolva"}</span>
              </p>
            </div>
            <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-paper text-graphite">
              {admin.twoFactorEnabled ? <ShieldCheck size={20} /> : <ShieldOff size={20} />}
            </div>
          </div>

          {admin.twoFactorEnabled ? (
            <form action={disableTwoFactorAction} className="mt-6 space-y-4">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-graphite">Admin jelszó</span>
                <input
                  name="password"
                  type="password"
                  required
                  className="h-12 w-full rounded-md border border-ink/15 bg-paper px-3 outline-none transition focus:border-ink/50"
                />
              </label>
              <Button type="submit" variant="danger">
                <ShieldOff size={16} />
                Kétfaktor kikapcsolása
              </Button>
            </form>
          ) : (
            <form action={enableTwoFactorAction} className="mt-6 space-y-5">
              <input type="hidden" name="secret" value={setupSecret ?? ""} />

              {qrCodeDataUrl ? (
                <div className="grid gap-5 rounded-md bg-paper p-4 sm:grid-cols-[180px_1fr] sm:items-center">
                  <div className="rounded-md bg-white p-3">
                    <img src={qrCodeDataUrl} alt="Kétfaktoros hitelesítés QR-kód" className="h-auto w-full" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-ink">Olvasd be authenticator appal</p>
                    <p className="mt-2 text-sm text-graphite/70">Google Authenticator, 1Password, Authy vagy bármely TOTP app jó hozzá.</p>
                    <p className="mt-4 break-all rounded-md bg-white px-3 py-2 font-mono text-sm text-graphite">{setupSecret}</p>
                  </div>
                </div>
              ) : null}

              <label className="block space-y-2">
                <span className="text-sm font-medium text-graphite">Első 6 jegyű kód</span>
                <input
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9 ]*"
                  placeholder="123456"
                  required
                  className="h-12 w-full rounded-md border border-ink/15 bg-paper px-3 outline-none transition focus:border-ink/50"
                />
              </label>

              <Button type="submit">
                <ShieldCheck size={16} />
                Kétfaktor bekapcsolása
              </Button>
            </form>
          )}
        </section>

        <section className="rounded-lg border border-ink/10 bg-white p-6 shadow-soft">
          <div className="flex size-11 items-center justify-center rounded-md bg-paper text-graphite">
            <KeyRound size={20} />
          </div>
          <h2 className="mt-5 text-xl font-semibold text-ink">Belépés után</h2>
          <p className="mt-2 text-sm leading-6 text-graphite/70">
            A bejelentkezési oldalon az email és jelszó mellett megjelenő kétfaktoros kód mezőbe kell írni az appban látható aktuális kódot.
          </p>
          <p className="mt-4 rounded-md bg-paper px-4 py-3 text-sm text-graphite/70">
            Ha telefont váltasz, előtte érdemes itt kikapcsolni és újra bekapcsolni a kétfaktort az új készüléken.
          </p>
        </section>
      </div>
    </AdminShell>
  );
}
