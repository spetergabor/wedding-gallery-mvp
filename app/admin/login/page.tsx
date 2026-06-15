import { Camera } from "lucide-react";
import { loginAction } from "@/lib/gallery-actions";
import { Button } from "@/components/button";

export default async function AdminLoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="grid min-h-screen place-items-center bg-paper px-5">
      <section className="w-full max-w-md rounded-lg border border-ink/10 bg-white p-7 shadow-soft">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-md bg-ink text-white">
            <Camera size={20} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-ink">Admin belépés</h1>
            <p className="text-sm text-graphite/70">Wedding Gallery MVP</p>
          </div>
        </div>

        {params.error ? (
          <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Hibás email vagy jelszó.
          </div>
        ) : null}

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

          <Button type="submit" className="w-full">Belépés</Button>
        </form>
      </section>
    </main>
  );
}
