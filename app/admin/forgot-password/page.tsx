import Link from "next/link";
import { Camera } from "lucide-react";
import { Alert } from "@/components/alert";
import { FormSubmitButton } from "@/components/form-submit-button";
import { requestAdminPasswordResetAction } from "@/lib/password-reset-actions";

export default async function AdminForgotPasswordPage({
  searchParams
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="grid min-h-screen place-items-center bg-paper px-5">
      <section className="w-full max-w-md rounded-md border border-ink/10 bg-white p-7">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-md bg-ink text-white">
            <Camera size={20} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-ink">Elfelejtett jelszó</h1>
            <p className="text-sm text-graphite/70">Kérj új belépési linket e-mailben.</p>
          </div>
        </div>

        <div className="mb-5 space-y-3">
          {params.sent === "1" ? (
            <Alert title="Ha létezik ilyen fiók, elküldtük a linket." variant="success">
              Nézd meg az e-mail fiókodat. A link 60 percig érvényes.
            </Alert>
          ) : null}
          {params.error === "invalid" ? (
            <Alert title="A link nem érvényes." variant="error">
              Kérj egy új jelszó-visszaállító linket.
            </Alert>
          ) : null}
          {params.error === "rate_limit" ? (
            <Alert title="Túl sok jelszó-visszaállítási kérés." variant="error">
              Várj egy kicsit, majd próbáld újra.
            </Alert>
          ) : null}
        </div>

        <form action={requestAdminPasswordResetAction} className="space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-graphite">Email</span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="h-12 w-full rounded-md border border-ink/15 bg-paper px-3 outline-none transition focus:border-ink/50"
            />
          </label>

          <FormSubmitButton className="w-full" pendingLabel="Küldés...">
            Jelszó-visszaállító link kérése
          </FormSubmitButton>
        </form>

        <p className="mt-6 text-center text-sm text-graphite/70">
          Eszedbe jutott?{" "}
          <Link href="/admin/login" className="font-medium text-ink hover:underline">
            Belépés
          </Link>
        </p>
      </section>
    </main>
  );
}
