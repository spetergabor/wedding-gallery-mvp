import Link from "next/link";
import { redirect } from "next/navigation";
import { Camera, KeyRound, ShieldCheck } from "lucide-react";
import { Alert } from "@/components/alert";
import { FormSubmitButton } from "@/components/form-submit-button";
import { loginCustomerPortalAction } from "@/lib/customer-portal-account-actions";
import { getCustomerPortalSession } from "@/lib/customer-portal-auth";

export default async function CustomerPortalLoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; signedOut?: string; reset?: string }>;
}) {
  const [params, session] = await Promise.all([searchParams, getCustomerPortalSession()]);

  if (session) {
    redirect(session.account.mustChangePassword ? "/portal/account/password" : "/portal/account");
  }

  return (
    <main className="grid min-h-screen place-items-center bg-paper px-5 py-10">
      <section className="w-full max-w-md rounded-lg border border-ink/10 bg-white p-6 shadow-soft sm:p-8">
        <div className="flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-md bg-ink text-white"><Camera size={21} /></div>
          <div>
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-brass"><ShieldCheck size={12} /> Geschützter Zugang</p>
            <h1 className="mt-1 text-xl font-semibold text-ink">Paarbereich</h1>
          </div>
        </div>

        <p className="mt-6 text-sm leading-6 text-graphite/70">
          Meldet euch mit den Zugangsdaten an, die ihr von eurem Fotografen erhalten habt.
        </p>

        <div className="mt-5 space-y-3">
          {params.error === "invalid" ? <Alert title="Die Zugangsdaten sind nicht korrekt." variant="error">Bitte prüft Benutzername und Passwort.</Alert> : null}
          {params.error === "rate_limit" ? <Alert title="Zu viele Anmeldeversuche." variant="error">Bitte wartet einige Minuten und versucht es erneut.</Alert> : null}
          {params.signedOut ? <Alert title="Ihr wurdet erfolgreich abgemeldet." variant="success" /> : null}
          {params.reset === "success" ? <Alert title="Euer neues Passwort wurde gespeichert. Ihr könnt euch jetzt anmelden." variant="success" /> : null}
        </div>

        <form action={loginCustomerPortalAction} className="mt-6 space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-graphite">E-Mail oder Benutzername</span>
            <input
              name="loginIdentifier"
              required
              autoCapitalize="none"
              autoComplete="username"
              className="h-12 w-full rounded-md border border-ink/15 bg-paper px-3 text-ink outline-none transition focus:border-ink/50"
            />
          </label>
          <label className="block space-y-2">
            <span className="flex items-center justify-between gap-3 text-sm font-medium text-graphite">
              <span className="flex items-center gap-1.5"><KeyRound size={14} /> Passwort</span>
              <Link href="/portal/forgot-password" className="text-xs text-graphite/65 underline-offset-2 hover:text-ink hover:underline">Passwort vergessen?</Link>
            </span>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="h-12 w-full rounded-md border border-ink/15 bg-paper px-3 text-ink outline-none transition focus:border-ink/50"
            />
          </label>
          <FormSubmitButton className="w-full" pendingLabel="Anmelden...">Anmelden</FormSubmitButton>
        </form>

        <p className="mt-6 text-center text-xs leading-5 text-graphite/55">
          Bei Problemen mit dem Zugang wendet euch bitte direkt an euren Fotografen.
        </p>
      </section>
    </main>
  );
}
