import Link from "next/link";
import { Camera } from "lucide-react";
import { Button } from "@/components/button";
import { Alert } from "@/components/alert";
import { hasAnyAdmin } from "@/lib/auth";
import { registerAdminAction } from "@/lib/gallery-actions";

export default async function AdminRegisterPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [params, alreadyHasAdmin] = await Promise.all([searchParams, hasAnyAdmin()]);

  return (
    <main className="grid min-h-screen place-items-center bg-paper px-5">
      <section className="w-full max-w-md rounded-md border border-ink/10 bg-white p-7">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-md bg-ink text-white">
            <Camera size={20} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-ink">Admin regisztráció</h1>
            <p className="text-sm text-graphite/70">
              {alreadyHasAdmin ? "Fotós hozzáférés igénylése." : "Hozd létre az első főadmin felhasználót."}
            </p>
          </div>
        </div>

        <div className="mb-5 space-y-3">
          {params.error === "missing" ? (
            <Alert title="Hiányzó vagy túl rövid adat." variant="error">A jelszó legalább 8 karakter legyen.</Alert>
          ) : null}
          {params.error === "password" ? (
            <Alert title="A két jelszó nem egyezik." variant="error" />
          ) : null}
        </div>

        <form action={registerAdminAction} className="space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-graphite">Név</span>
            <input
              name="name"
              required
              className="h-12 w-full rounded-md border border-ink/15 bg-paper px-3 outline-none transition focus:border-ink/50"
            />
          </label>

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
              minLength={8}
              required
              className="h-12 w-full rounded-md border border-ink/15 bg-paper px-3 outline-none transition focus:border-ink/50"
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-graphite">Jelszó újra</span>
            <input
              name="confirmPassword"
              type="password"
              minLength={8}
              required
              className="h-12 w-full rounded-md border border-ink/15 bg-paper px-3 outline-none transition focus:border-ink/50"
            />
          </label>

          <Button type="submit" className="w-full">
            {alreadyHasAdmin ? "Regisztráció elküldése" : "Főadmin létrehozása"}
          </Button>
        </form>

        {alreadyHasAdmin ? (
          <p className="mt-4 rounded-md bg-paper px-4 py-3 text-sm leading-6 text-graphite/70">
            A regisztráció után a főadminnak jóvá kell hagynia a fiókot. Addig nem lehet belépni.
          </p>
        ) : null}

        <p className="mt-6 text-center text-sm text-graphite/70">
          Már van admin?{" "}
          <Link href="/admin/login" className="font-medium text-ink hover:underline">
            Belépés
          </Link>
        </p>
      </section>
    </main>
  );
}
