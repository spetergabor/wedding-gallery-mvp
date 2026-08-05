import Link from "next/link";
import { ArrowLeft, KeyRound, Mail } from "lucide-react";
import { Alert } from "@/components/alert";
import { FormSubmitButton } from "@/components/form-submit-button";
import { requestCustomerPortalPasswordResetAction } from "@/lib/customer-portal-account-actions";

export default async function CustomerPortalForgotPasswordPage({
  searchParams
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="grid min-h-screen place-items-center bg-paper px-5 py-10">
      <section className="w-full max-w-md rounded-lg border border-ink/10 bg-white p-6 shadow-soft sm:p-8">
        <Link href="/portal/login" className="inline-flex items-center gap-1.5 text-sm font-medium text-graphite/65 hover:text-ink"><ArrowLeft size={15} /> Zur Anmeldung</Link>
        <span className="mt-6 grid size-11 place-items-center rounded-md bg-ink text-white"><KeyRound size={19} /></span>
        <h1 className="mt-4 text-2xl font-semibold text-ink">Passwort zurücksetzen</h1>
        <p className="mt-2 text-sm leading-6 text-graphite/70">Gebt die E-Mail-Adresse eures Paarbereichs ein. Wenn ein Konto vorhanden ist, senden wir einen sicheren Link.</p>

        {params.sent ? <div className="mt-5"><Alert title="E-Mail wurde angefordert." variant="success">Bitte prüft auch den Spam-Ordner.</Alert></div> : null}
        {params.error === "rate_limit" ? <div className="mt-5"><Alert title="Zu viele Anfragen." variant="error">Bitte wartet einige Minuten.</Alert></div> : null}
        {params.error === "invalid" ? <div className="mt-5"><Alert title="Der Link ist nicht gültig." variant="error" /></div> : null}

        <form action={requestCustomerPortalPasswordResetAction} className="mt-6 space-y-4">
          <label className="block space-y-2">
            <span className="flex items-center gap-1.5 text-sm font-medium text-graphite"><Mail size={14} /> E-Mail-Adresse</span>
            <input name="email" type="email" required autoComplete="email" className="h-12 w-full rounded-md border border-ink/15 bg-paper px-3 text-ink outline-none focus:border-ink/50" />
          </label>
          <FormSubmitButton className="w-full" pendingLabel="Wird gesendet...">Reset-Link senden</FormSubmitButton>
        </form>
      </section>
    </main>
  );
}
