import Link from "next/link";
import { redirect } from "next/navigation";
import { Camera } from "lucide-react";
import { loginAction } from "@/lib/gallery-actions";
import { Alert } from "@/components/alert";
import { hasAnyAdmin } from "@/lib/auth";
import { FormSubmitButton } from "@/components/form-submit-button";

export default async function AdminLoginPage({
  searchParams
}: {
  searchParams: Promise<{ approval?: string; error?: string; registered?: string; reset?: string; twoFactor?: string }>;
}) {
  const [params, alreadyHasAdmin] = await Promise.all([searchParams, hasAnyAdmin()]);
  const needsTwoFactor = params.twoFactor === "1";

  if (!alreadyHasAdmin) {
    redirect("/admin/register");
  }

  return (
    <main className="grid min-h-screen place-items-center bg-paper px-5">
      <section className="w-full max-w-md rounded-md border border-ink/10 bg-white p-7">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-md bg-ink text-white">
            <Camera size={20} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-ink">Admin belépés</h1>
            <p className="text-sm text-graphite/70">Spetly</p>
          </div>
        </div>

        <div className="mb-5 space-y-3">
          {params.error ? (
            <Alert title="Hibás belépési adatok." variant="error">
              {needsTwoFactor ? "Ellenőrizd az authenticator appban látható friss 6 jegyű kódot. Ha lejárt a belépési ablak, kezdd újra." : "Ellenőrizd az email címet és a jelszót."}
            </Alert>
          ) : null}
          {needsTwoFactor && !params.error ? (
            <Alert title="Kétfaktoros kód szükséges." variant="info">
              Ehhez a fiókhoz be van kapcsolva a kétfaktoros hitelesítés. Írd be az authenticator appban látható aktuális kódot.
            </Alert>
          ) : null}
          {params.approval === "pending" ? (
            <Alert title="A fiók még jóváhagyásra vár." variant="info">
              A főadmin jóváhagyása után tudsz belépni.
            </Alert>
          ) : null}
          {params.registered === "pending" ? (
            <Alert title="Regisztráció elküldve." variant="success">
              A fiók jóváhagyásra vár. Értesítsd a főadmint, hogy aktiválja.
            </Alert>
          ) : null}
          {params.reset === "success" ? (
            <Alert title="Az új jelszó mentve." variant="success">
              Most már be tudsz lépni az új jelszóval.
            </Alert>
          ) : null}
        </div>

        {needsTwoFactor ? (
          <form action={loginAction} className="space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-graphite">Kétfaktoros kód</span>
              <input
                name="twoFactorCode"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9 ]*"
                placeholder="123456"
                required
                className="h-12 w-full rounded-md border border-ink/15 bg-paper px-3 outline-none transition focus:border-ink/50"
              />
            </label>

            <FormSubmitButton className="w-full" pendingLabel="Belépés...">Belépés</FormSubmitButton>
            <Link href="/admin/login" className="block text-center text-sm font-medium text-graphite/70 hover:text-ink">
              Belépés újrakezdése
            </Link>
          </form>
        ) : (
          <form action={loginAction} className="space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-graphite">Email</span>
              <input
                name="email"
                type="email"
                required
                className="h-12 w-full rounded-md border border-ink/15 bg-paper px-3 outline-none transition focus:border-ink/50"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-graphite">Jelszó</span>
              <input
                name="password"
                type="password"
                required
                className="h-12 w-full rounded-md border border-ink/15 bg-paper px-3 outline-none transition focus:border-ink/50"
              />
            </label>

            <div className="text-right">
              <Link href="/admin/forgot-password" className="text-sm font-medium text-graphite/70 hover:text-ink">
                Elfelejtetted a jelszót?
              </Link>
            </div>

            <FormSubmitButton className="w-full" pendingLabel="Belépés...">Belépés</FormSubmitButton>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-graphite/70">
          Admin hozzáférés adatbázisból, hash-elt jelszóval működik.{" "}
          <Link href="/admin/register" className="font-medium text-ink hover:underline">
            Regisztráció
          </Link>
        </p>
      </section>
    </main>
  );
}
