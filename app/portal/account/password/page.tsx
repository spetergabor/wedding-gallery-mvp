import { KeyRound, ShieldCheck } from "lucide-react";
import { Alert } from "@/components/alert";
import { CustomerAccountShell } from "@/components/customer-account-shell";
import { FormSubmitButton } from "@/components/form-submit-button";
import { changeCustomerPortalPasswordAction } from "@/lib/customer-portal-account-actions";
import { requireCustomerPortalSession } from "@/lib/customer-portal-auth";

export default async function CustomerPortalPasswordPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [session, params] = await Promise.all([
    requireCustomerPortalSession({ allowPasswordChange: true }),
    searchParams
  ]);
  const german = session.account.customer.preferredLanguage !== "hu";

  return (
    <CustomerAccountShell
      coupleName={session.account.customer.coupleName}
      displayName={session.account.displayName}
      language={session.account.customer.preferredLanguage}
    >
      <section className="mx-auto w-full max-w-xl px-5 py-12 lg:px-8">
        <div className="rounded-lg border border-ink/10 bg-white p-6 shadow-soft sm:p-8">
          <span className="grid size-11 place-items-center rounded-md bg-brass/10 text-brass"><ShieldCheck size={20} /></span>
          <h1 className="mt-4 text-2xl font-semibold text-ink">{german ? "Eigenes Passwort festlegen" : "Saját jelszó beállítása"}</h1>
          <p className="mt-2 text-sm leading-6 text-graphite/70">
            {german
              ? "Das vorläufige Passwort war nur für die erste Anmeldung bestimmt. Legt jetzt ein persönliches Passwort fest."
              : "Az ideiglenes jelszó csak az első belépéshez szólt. Most állítsatok be saját jelszót."}
          </p>

          <div className="mt-5">
            {params.error === "length" ? <Alert title={german ? "Das Passwort muss mindestens 10 Zeichen lang sein." : "A jelszó legalább 10 karakter legyen."} variant="error" /> : null}
            {params.error === "confirmation" ? <Alert title={german ? "Die beiden Passwörter stimmen nicht überein." : "A két jelszó nem egyezik."} variant="error" /> : null}
          </div>

          <form action={changeCustomerPortalPasswordAction} className="mt-6 space-y-4">
            <label className="block space-y-2">
              <span className="flex items-center gap-1.5 text-sm font-medium text-graphite"><KeyRound size={14} /> {german ? "Neues Passwort" : "Új jelszó"}</span>
              <input name="password" type="password" minLength={10} required autoComplete="new-password" className="h-12 w-full rounded-md border border-ink/15 bg-paper px-3 outline-none focus:border-ink/50" />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-graphite">{german ? "Passwort wiederholen" : "Jelszó még egyszer"}</span>
              <input name="passwordConfirmation" type="password" minLength={10} required autoComplete="new-password" className="h-12 w-full rounded-md border border-ink/15 bg-paper px-3 outline-none focus:border-ink/50" />
            </label>
            <FormSubmitButton className="w-full" pendingLabel={german ? "Speichern..." : "Mentés..."}>
              {german ? "Passwort speichern" : "Jelszó mentése"}
            </FormSubmitButton>
          </form>
        </div>
      </section>
    </CustomerAccountShell>
  );
}
