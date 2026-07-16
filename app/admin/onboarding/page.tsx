import { Camera, CheckCircle2, Globe2, LogOut, Sparkles } from "lucide-react";
import { Alert } from "@/components/alert";
import { FormSubmitButton } from "@/components/form-submit-button";
import { requireAdmin } from "@/lib/auth";
import { logoutAction } from "@/lib/gallery-actions";
import { completeAdminOnboardingAction } from "@/lib/onboarding-actions";
import { prisma } from "@/lib/prisma";

const COUNTRIES = [
  "Ausztria",
  "Magyarország",
  "Németország",
  "Svájc",
  "Szlovákia",
  "Szlovénia",
  "Horvátország",
  "Egyéb"
];

export default async function AdminOnboardingPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [admin, params] = await Promise.all([requireAdmin({ allowIncompleteOnboarding: true }), searchParams]);

  if (admin.role === "super_admin" || admin.onboardingCompletedAt) {
    return (
      <main className="grid min-h-screen place-items-center bg-paper px-5">
        <section className="w-full max-w-md rounded-md border border-ink/10 bg-white p-7 text-center">
          <CheckCircle2 className="mx-auto text-sage" size={34} />
          <h1 className="mt-4 text-2xl font-semibold text-ink">A profil már készen áll.</h1>
          <a href="/admin/dashboard" className="mt-6 inline-flex h-11 items-center justify-center rounded-md bg-ink px-5 text-sm font-semibold text-white">
            Tovább a dashboardra
          </a>
        </section>
      </main>
    );
  }

  const [settings, profile] = await Promise.all([
    prisma.siteSettings.findUnique({
      where: { adminId: admin.id },
      select: {
        businessName: true,
        publicSubdomain: true,
        websiteUrl: true,
        contactPhone: true
      }
    }),
    prisma.admin.findUnique({
      where: { id: admin.id },
      select: {
        country: true,
        phone: true
      }
    })
  ]);

  return (
    <main className="min-h-screen bg-white text-ink">
      <section className="grid min-h-screen lg:grid-cols-[minmax(0,0.95fr)_minmax(520px,1.05fr)]">
        <aside className="hidden bg-[#f3eadb] px-10 py-12 lg:flex lg:items-center lg:justify-center">
          <div className="w-full max-w-lg">
            <div className="rounded-md border border-ink/10 bg-white/70 p-5 shadow-sm">
              <div className="aspect-[4/5] rounded-md bg-ink p-8 text-white">
                <div className="flex h-full flex-col justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Spetly setup</p>
                    <h2 className="mt-5 max-w-sm text-5xl font-semibold leading-tight">Your workspace starts with your brand.</h2>
                  </div>
                  <div className="grid gap-3">
                    {["Public galleries", "Bookings", "Contracts", "Albums"].map((item) => (
                      <div key={item} className="flex items-center justify-between rounded-md border border-white/15 bg-white/10 px-4 py-3">
                        <span className="text-sm font-medium">{item}</span>
                        <CheckCircle2 size={17} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <p className="mt-4 text-sm text-graphite">Ezek az adatok jelennek meg a publikus linkeken, foglalásoknál és ügyféloldalakon.</p>
            </div>
          </div>
        </aside>

        <section className="flex items-center justify-center px-5 py-12">
          <div className="w-full max-w-xl">
            <div className="mb-8 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-md bg-ink text-white">
                  <Camera size={20} />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brass">Első beállítás</p>
                  <h1 className="text-2xl font-semibold text-ink">Állítsuk be a fotós profilodat</h1>
                </div>
              </div>
              <form action={logoutAction}>
                <button type="submit" className="inline-flex size-10 items-center justify-center rounded-md border border-ink/10 text-graphite hover:bg-ink/5" aria-label="Kijelentkezés">
                  <LogOut size={17} />
                </button>
              </form>
            </div>

            <p className="mb-6 text-base leading-7 text-graphite/75">
              Ezeket az alapadatokat használja majd a Spetly a publikus galériákhoz, mini session oldalakhoz, szerződésekhez és ügyfél e-mailekhez.
            </p>

            <div className="mb-5 space-y-3">
              {params.error === "missing" ? <Alert title="Hiányzó adat." variant="error">A márkanév, Spetly cím és ország kötelező.</Alert> : null}
              {params.error === "subdomain" ? <Alert title="Ez a Spetly cím nem használható." variant="error">Legalább 3 karakteres, egyedi nevet adj meg. A rendszernevek foglaltak.</Alert> : null}
              {params.error === "taken" ? <Alert title="Ez a Spetly cím már foglalt." variant="error">Válassz egy másik nevet a spetly.app elé.</Alert> : null}
            </div>

            <form action={completeAdminOnboardingAction} className="space-y-5 rounded-md border border-ink/10 bg-white p-6 shadow-sm">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-graphite">Márkanév / vállalkozás neve</span>
                <input
                  name="businessName"
                  defaultValue={settings?.businessName || admin.name}
                  required
                  className="h-12 w-full rounded-md border border-ink/15 bg-paper px-3 text-ink outline-none transition focus:border-ink/50"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-graphite">Saját Spetly cím</span>
                <div className="flex items-center rounded-md border border-ink/15 bg-paper focus-within:border-ink/50">
                  <input
                    name="publicSubdomain"
                    defaultValue={settings?.publicSubdomain ?? admin.publicSubdomain ?? ""}
                    required
                    className="h-12 min-w-0 flex-1 rounded-l-md bg-transparent px-3 text-ink outline-none"
                  />
                  <span className="shrink-0 border-l border-ink/10 px-3 text-sm font-semibold text-graphite/70">.spetly.app</span>
                </div>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-graphite">Ország</span>
                  <select
                    name="country"
                    defaultValue={profile?.country ?? ""}
                    required
                    className="h-12 w-full rounded-md border border-ink/15 bg-paper px-3 text-ink outline-none transition focus:border-ink/50"
                  >
                    <option value="" disabled>
                      Válassz országot
                    </option>
                    {COUNTRIES.map((country) => (
                      <option key={country} value={country}>
                        {country}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-graphite">Telefonszám</span>
                  <input
                    name="phone"
                    type="tel"
                    defaultValue={settings?.contactPhone ?? profile?.phone ?? ""}
                    className="h-12 w-full rounded-md border border-ink/15 bg-paper px-3 text-ink outline-none transition focus:border-ink/50"
                  />
                </label>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-graphite">Weboldal vagy Instagram</span>
                <input
                  name="websiteUrl"
                  defaultValue={settings?.websiteUrl ?? ""}
                  placeholder="https://..."
                  className="h-12 w-full rounded-md border border-ink/15 bg-paper px-3 text-ink outline-none transition focus:border-ink/50"
                />
              </label>

              <div className="flex flex-col gap-3 border-t border-ink/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-sm text-graphite/70">
                  <Globe2 size={16} />
                  <span>A publikus linkeket később is módosíthatod a Beállításokban.</span>
                </div>
                <FormSubmitButton className="min-w-44" pendingLabel="Mentés...">
                  <Sparkles size={17} />
                  Kezdés
                </FormSubmitButton>
              </div>
            </form>
          </div>
        </section>
      </section>
    </main>
  );
}
