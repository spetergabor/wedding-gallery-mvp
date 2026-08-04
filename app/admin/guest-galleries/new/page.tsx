import Link from "next/link";
import { CalendarDays, KeyRound, QrCode, UploadCloud, UserRound } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Alert } from "@/components/alert";
import { FormSubmitButton } from "@/components/form-submit-button";
import { adminOwnedWhere } from "@/lib/admin-scope";
import { requireAdmin } from "@/lib/auth";
import { createGuestGalleryAction } from "@/lib/guest-gallery-actions";
import { prisma } from "@/lib/prisma";

const fieldClass =
  "h-12 w-full rounded-md border border-ink/15 bg-paper px-3 text-ink outline-none transition placeholder:text-graphite/45 focus:border-ink/50";

export default async function NewGuestGalleryPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; customerId?: string }>;
}) {
  const admin = await requireAdmin();
  const flags = await searchParams;
  const customers = await prisma.customer.findMany({
    where: adminOwnedWhere(admin),
    orderBy: [{ weddingDate: "desc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      coupleName: true,
      weddingDate: true
    }
  });

  return (
    <AdminShell>
      <div className="mb-8">
        <Link href="/admin/guest-galleries" className="text-sm font-medium text-graphite/70 hover:text-ink">
          ← Vendéggalériák
        </Link>
        <p className="mt-6 text-xs uppercase tracking-[0.16em] text-graphite/60">Új szolgáltatás</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">Vendéggaléria létrehozása</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-graphite/70">
          A mentés után azonnal elkészül az esemény saját publikus oldala és QR-kódja. A galéria aktívan, vendégfeltöltéssel indul.
        </p>
      </div>

      <div className="mb-5 space-y-3">
        {flags.error === "missing" ? <Alert title="Add meg a vendéggaléria nevét." variant="error" /> : null}
        {flags.error === "customer" ? <Alert title="A kiválasztott ügyfél nem található." variant="error" /> : null}
        {flags.error === "slug" ? <Alert title="Nem sikerült egyedi linket létrehozni. Próbáld újra." variant="error" /> : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <form action={createGuestGalleryAction} className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft sm:p-7">
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block space-y-2 sm:col-span-2">
              <span className="flex items-center gap-2 text-sm font-medium text-graphite">
                <QrCode size={15} /> Galéria neve
              </span>
              <input
                name="title"
                type="text"
                required
                placeholder="pl. Maria & Thomas – Vendégfotók"
                className={fieldClass}
              />
            </label>

            <label className="block space-y-2 sm:col-span-2">
              <span className="flex items-center gap-2 text-sm font-medium text-graphite">
                <UserRound size={15} /> Ügyfél kapcsolása
              </span>
              <select name="customerId" defaultValue={flags.customerId ?? ""} className={fieldClass}>
                <option value="">Nincs ügyfélhez kapcsolva</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.coupleName}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="flex items-center gap-2 text-sm font-medium text-graphite">
                <CalendarDays size={15} /> Esemény dátuma
              </span>
              <input name="eventDate" type="date" className={fieldClass} />
            </label>

            <label className="block space-y-2">
              <span className="flex items-center gap-2 text-sm font-medium text-graphite">
                <KeyRound size={15} /> Opcionális PIN-kód
              </span>
              <input
                name="password"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                placeholder="pl. 2486"
                className={fieldClass}
              />
            </label>
          </div>

          <div className="mt-6 rounded-md border border-sage/20 bg-sage/10 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-sage">
              <UploadCloud size={16} /> Vendégfeltöltés bekapcsolva
            </p>
            <p className="mt-1 text-xs leading-5 text-graphite/70">
              A vendégek képenként legfeljebb 25 MB-os JPG, PNG, WebP, HEIC vagy HEIF fájlokat tölthetnek fel.
            </p>
          </div>

          <div className="mt-7 flex justify-end border-t border-ink/10 pt-5">
            <FormSubmitButton pendingLabel="Létrehozás...">Vendéggaléria létrehozása</FormSubmitButton>
          </div>
        </form>

        <aside className="rounded-lg border border-ink/10 bg-ink p-6 text-white shadow-soft">
          <span className="grid size-12 place-items-center rounded-md bg-white/10">
            <QrCode size={22} />
          </span>
          <h2 className="mt-5 text-xl font-semibold">A következő lépés</h2>
          <p className="mt-3 text-sm leading-6 text-white/70">
            A létrehozott eseménynél letöltheted a QR-kódot, kimásolhatod a vendéglinket, és követheted vagy elrejtheted a feltöltött képeket.
          </p>
        </aside>
      </div>
    </AdminShell>
  );
}
