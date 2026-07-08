import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#f8f7f4] text-ink">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8">
        <header className="flex items-center justify-between gap-4 border-b border-ink/10 pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-brass">Spetly</p>
            <p className="mt-1 text-sm text-graphite/70">Client workflow platform for photographers</p>
          </div>
          <nav className="flex items-center gap-3 text-sm font-medium">
            <Link className="text-graphite transition hover:text-ink" href="/privacy">
              Privacy
            </Link>
            <Link className="text-graphite transition hover:text-ink" href="/terms">
              Terms
            </Link>
            <Link className="rounded-md bg-ink px-4 py-2 text-white transition hover:bg-ink/90" href="/admin/dashboard">
              Sign in
            </Link>
          </nav>
        </header>

        <div className="grid flex-1 gap-10 py-14 lg:grid-cols-[1fr_0.9fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brass">For working photographers</p>
            <h1 className="mt-5 max-w-3xl text-5xl font-semibold leading-[1.02] tracking-normal text-ink md:text-6xl">
              Galleries, bookings and client work in one quiet workspace.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-graphite/78">
              Spetly helps photographers manage client galleries, mini session bookings, contracts, invoices,
              customer portals and Google Calendar synchronization from one admin area.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link className="rounded-md bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-ink/90" href="/admin/dashboard">
                Open admin
              </Link>
              <Link className="rounded-md border border-ink/15 bg-white px-5 py-3 text-sm font-semibold text-ink transition hover:border-ink/35" href="/privacy">
                Privacy policy
              </Link>
            </div>
          </div>

          <div className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
            <div className="border-b border-ink/10 pb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brass">Workflow overview</p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">What Spetly manages</h2>
            </div>
            <div className="mt-5 grid gap-3">
              {[
                ["Client galleries", "Private gallery delivery, selections and download flows."],
                ["Bookings", "Mini session and always-bookable sessions with availability rules."],
                ["Contracts", "Uploaded or platform-created contracts with digital signatures."],
                ["Google Calendar", "Optional calendar sync and availability blocking for connected photographers."]
              ].map(([title, description]) => (
                <div key={title} className="rounded-md border border-ink/10 bg-paper px-4 py-3">
                  <p className="font-semibold text-ink">{title}</p>
                  <p className="mt-1 text-sm leading-6 text-graphite/72">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <footer className="flex flex-col justify-between gap-3 border-t border-ink/10 pt-5 text-sm text-graphite/68 sm:flex-row">
          <p>© {new Date().getFullYear()} Spetly. All rights reserved.</p>
          <div className="flex gap-4">
            <Link className="transition hover:text-ink" href="/privacy">
              Privacy Policy
            </Link>
            <Link className="transition hover:text-ink" href="/terms">
              Terms of Service
            </Link>
          </div>
        </footer>
      </section>
    </main>
  );
}
