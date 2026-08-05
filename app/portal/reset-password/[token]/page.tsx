import Link from "next/link";
import { KeyRound, ShieldCheck } from "lucide-react";
import { Alert } from "@/components/alert";
import { FormSubmitButton } from "@/components/form-submit-button";
import { resetCustomerPortalPasswordAction } from "@/lib/customer-portal-account-actions";
import { passwordResetTokenHash } from "@/lib/password-reset";
import { prisma } from "@/lib/prisma";

export default async function CustomerPortalResetPasswordPage({
  params,
  searchParams
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ token }, flags] = await Promise.all([params, searchParams]);
  const resetToken = token
    ? await prisma.customerPortalPasswordResetToken.findUnique({
        where: { tokenHash: passwordResetTokenHash(token) },
        select: {
          purpose: true,
          expiresAt: true,
          usedAt: true,
          account: {
            select: {
              status: true,
              customer: { select: { coupleName: true, preferredLanguage: true } }
            }
          }
        }
      })
    : null;
  const valid = Boolean(resetToken && !resetToken.usedAt && resetToken.expiresAt > new Date() && resetToken.account.status === "active");
  const german = resetToken?.account.customer.preferredLanguage !== "hu";
  const invite = resetToken?.purpose === "invite";

  return (
    <main className="grid min-h-screen place-items-center bg-paper px-5 py-10">
      <section className="w-full max-w-md rounded-lg border border-ink/10 bg-white p-6 shadow-soft sm:p-8">
        <span className="grid size-11 place-items-center rounded-md bg-ink text-white"><ShieldCheck size={19} /></span>
        <h1 className="mt-4 text-2xl font-semibold text-ink">
          {german ? invite ? "Paarbereich aktivieren" : "Neues Passwort festlegen" : invite ? "Pár-admin aktiválása" : "Új jelszó beállítása"}
        </h1>
        {valid ? (
          <>
            <p className="mt-2 text-sm leading-6 text-graphite/70">
              {german
                ? `${resetToken?.account.customer.coupleName}: Legt ein persönliches Passwort mit mindestens 10 Zeichen fest.`
                : `${resetToken?.account.customer.coupleName}: állítsatok be legalább 10 karakteres saját jelszót.`}
            </p>
            <div className="mt-5 space-y-3">
              {flags.error === "length" ? <Alert title={german ? "Das Passwort muss mindestens 10 Zeichen lang sein." : "A jelszó legalább 10 karakter legyen."} variant="error" /> : null}
              {flags.error === "confirmation" ? <Alert title={german ? "Die Passwörter stimmen nicht überein." : "A két jelszó nem egyezik."} variant="error" /> : null}
              {flags.error === "rate_limit" ? <Alert title={german ? "Zu viele Versuche. Bitte wartet kurz." : "Túl sok próbálkozás. Várjatok néhány percet."} variant="error" /> : null}
              {flags.error === "invalid" ? <Alert title={german ? "Der Link ist nicht mehr gültig." : "A link már nem érvényes."} variant="error" /> : null}
            </div>
            <form action={resetCustomerPortalPasswordAction} className="mt-6 space-y-4">
              <input type="hidden" name="token" value={token} />
              <label className="block space-y-2">
                <span className="flex items-center gap-1.5 text-sm font-medium text-graphite"><KeyRound size={14} /> {german ? "Neues Passwort" : "Új jelszó"}</span>
                <input name="password" type="password" required minLength={10} autoComplete="new-password" className="h-12 w-full rounded-md border border-ink/15 bg-paper px-3 outline-none focus:border-ink/50" />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-graphite">{german ? "Passwort wiederholen" : "Jelszó még egyszer"}</span>
                <input name="passwordConfirmation" type="password" required minLength={10} autoComplete="new-password" className="h-12 w-full rounded-md border border-ink/15 bg-paper px-3 outline-none focus:border-ink/50" />
              </label>
              <FormSubmitButton className="w-full" pendingLabel={german ? "Speichern..." : "Mentés..."}>{german ? "Passwort speichern" : "Jelszó mentése"}</FormSubmitButton>
            </form>
          </>
        ) : (
          <div className="mt-5">
            <Alert title={german ? "Dieser Link ist abgelaufen oder wurde bereits verwendet." : "Ez a link lejárt vagy már felhasználták."} variant="error" />
            <Link href="/portal/forgot-password" className="mt-5 inline-flex text-sm font-semibold text-ink underline underline-offset-2">{german ? "Neuen Link anfordern" : "Új link kérése"}</Link>
          </div>
        )}
      </section>
    </main>
  );
}
