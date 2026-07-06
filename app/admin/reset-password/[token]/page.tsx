import Link from "next/link";
import { Camera } from "lucide-react";
import { Alert } from "@/components/alert";
import { FormSubmitButton } from "@/components/form-submit-button";
import { resetAdminPasswordAction } from "@/lib/password-reset-actions";
import { passwordResetTokenHash } from "@/lib/password-reset";
import { prisma } from "@/lib/prisma";

async function isValidResetToken(token: string) {
  const resetToken = await prisma.adminPasswordResetToken.findUnique({
    where: { tokenHash: passwordResetTokenHash(token) },
    select: {
      expiresAt: true,
      usedAt: true
    }
  });

  return Boolean(resetToken && !resetToken.usedAt && resetToken.expiresAt > new Date());
}

export default async function AdminResetPasswordPage({
  params,
  searchParams
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ token }, flags] = await Promise.all([params, searchParams]);
  const tokenIsValid = await isValidResetToken(token);

  return (
    <main className="grid min-h-screen place-items-center bg-paper px-5">
      <section className="w-full max-w-md rounded-md border border-ink/10 bg-white p-7">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-md bg-ink text-white">
            <Camera size={20} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-ink">Új jelszó beállítása</h1>
            <p className="text-sm text-graphite/70">Adj meg egy új admin jelszót.</p>
          </div>
        </div>

        <div className="mb-5 space-y-3">
          {!tokenIsValid || flags.error === "invalid" ? (
            <Alert title="A jelszó-visszaállító link lejárt vagy már felhasználták." variant="error">
              Kérj egy új linket az e-mail címedre.
            </Alert>
          ) : null}
          {flags.error === "missing" ? (
            <Alert title="A jelszó túl rövid." variant="error">A jelszó legalább 8 karakter legyen.</Alert>
          ) : null}
          {flags.error === "password" ? (
            <Alert title="A két jelszó nem egyezik." variant="error" />
          ) : null}
        </div>

        {tokenIsValid ? (
          <form action={resetAdminPasswordAction} className="space-y-4">
            <input type="hidden" name="token" value={token} />
            <label className="block space-y-2">
              <span className="text-sm font-medium text-graphite">Új jelszó</span>
              <input
                name="password"
                type="password"
                minLength={8}
                required
                autoComplete="new-password"
                className="h-12 w-full rounded-md border border-ink/15 bg-paper px-3 outline-none transition focus:border-ink/50"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-graphite">Új jelszó újra</span>
              <input
                name="confirmPassword"
                type="password"
                minLength={8}
                required
                autoComplete="new-password"
                className="h-12 w-full rounded-md border border-ink/15 bg-paper px-3 outline-none transition focus:border-ink/50"
              />
            </label>

            <FormSubmitButton className="w-full" pendingLabel="Mentés...">
              Új jelszó mentése
            </FormSubmitButton>
          </form>
        ) : (
          <Link
            href="/admin/forgot-password"
            className="flex h-12 w-full items-center justify-center rounded-md bg-ink px-4 text-sm font-medium text-white transition hover:bg-graphite"
          >
            Új link kérése
          </Link>
        )}

        <p className="mt-6 text-center text-sm text-graphite/70">
          Vissza a{" "}
          <Link href="/admin/login" className="font-medium text-ink hover:underline">
            belépéshez
          </Link>
        </p>
      </section>
    </main>
  );
}
