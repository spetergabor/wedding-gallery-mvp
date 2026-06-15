import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-paper px-5">
      <section className="max-w-md text-center">
        <p className="text-sm uppercase tracking-[0.24em] text-brass">404</p>
        <h1 className="mt-3 text-3xl font-semibold text-ink">Az oldal nem található</h1>
        <p className="mt-3 text-sm text-graphite/70">A keresett galéria nem létezik, vagy jelenleg nem aktív.</p>
        <Link href="/admin/dashboard" className="mt-6 inline-flex h-11 items-center justify-center rounded-md bg-ink px-4 text-sm font-medium text-white">
          Admin dashboard
        </Link>
      </section>
    </main>
  );
}
