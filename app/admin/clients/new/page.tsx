import { AdminShell } from "@/components/admin-shell";
import { Alert } from "@/components/alert";
import { CustomerForm } from "@/components/customer-form";
import { requireAdmin } from "@/lib/auth";

export default async function NewCustomerPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdmin();
  const flags = await searchParams;

  return (
    <AdminShell>
      <div className="mb-8">
        <p className="text-sm uppercase tracking-[0.24em] text-brass">Új ügyfél</p>
        <h1 className="mt-2 text-4xl font-semibold text-ink">Pár felvitele</h1>
        <p className="mt-3 max-w-2xl text-sm text-graphite/70">
          Ezekből az adatokból fog később a szerződéskezelő és ügyfél workflow dolgozni.
        </p>
      </div>

      {flags.error === "missing" ? (
        <div className="mb-5">
          <Alert title="Hiányzó kötelező mező." variant="error">
            A pár neve és az elsődleges email cím kötelező.
          </Alert>
        </div>
      ) : null}

      <CustomerForm />
    </AdminShell>
  );
}
