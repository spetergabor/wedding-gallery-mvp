import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { Alert } from "@/components/alert";
import { ContractManager } from "@/components/contract-manager";
import { CustomerForm } from "@/components/customer-form";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const statusLabels: Record<string, string> = {
  lead: "Érdeklődő",
  contract_pending: "Szerződésre vár",
  booked: "Szerződött",
  completed: "Teljesítve",
  archived: "Archivált"
};

function formatDate(date: Date | null) {
  if (!date) {
    return "Nincs dátum megadva";
  }

  return date.toLocaleDateString("hu-HU", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

export default async function AdminClientDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    created?: string;
    updated?: string;
    error?: string;
    contractUploaded?: string;
    contractSent?: string;
    contractError?: string;
  }>;
}) {
  await requireAdmin();
  const [{ id }, flags] = await Promise.all([params, searchParams]);
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      contracts: {
        orderBy: { createdAt: "desc" }
      }
    }
  });

  if (!customer) {
    notFound();
  }

  return (
    <AdminShell>
      <div className="mb-8">
        <p className="text-sm uppercase tracking-[0.24em] text-brass">Ügyfél</p>
        <div className="mt-2 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h1 className="text-4xl font-semibold text-ink">{customer.coupleName}</h1>
            <p className="mt-3 text-sm text-graphite/70">
              {statusLabels[customer.status] ?? customer.status} · {formatDate(customer.weddingDate)}
            </p>
          </div>
        </div>
      </div>

      <div className="mb-5 space-y-3">
        {flags.created ? <Alert title="Ügyfél létrehozva." variant="success" /> : null}
        {flags.updated ? <Alert title="Ügyfél mentve." variant="success" /> : null}
        {flags.contractUploaded ? <Alert title="Szerződés feltöltve." variant="success" /> : null}
        {flags.contractSent ? <Alert title="Szerződés elküldve emailben." variant="success" /> : null}
        {flags.error === "missing" ? (
          <Alert title="Hiányzó kötelező mező." variant="error">
            A pár neve és az elsődleges email cím kötelező.
          </Alert>
        ) : null}
        {flags.contractError === "missing" ? (
          <Alert title="Hiányzó szerződés adat." variant="error">
            Adj meg címet és válassz ki egy PDF fájlt.
          </Alert>
        ) : null}
        {flags.contractError === "type" ? (
          <Alert title="Csak PDF tölthető fel." variant="error">
            A szerződés első verzióban PDF fájl lehet.
          </Alert>
        ) : null}
        {flags.contractError === "not-found" ? (
          <Alert title="A szerződés nem található." variant="error">
            Frissítsd az oldalt, és próbáld újra.
          </Alert>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <CustomerForm customer={customer} />

        <aside className="space-y-6">
          <ContractManager customerId={customer.id} contracts={customer.contracts} />

          <section className="rounded-lg border border-ink/10 bg-white p-5 shadow-soft">
            <h2 className="text-lg font-semibold text-ink">Gyors adatok</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-graphite/60">Elsődleges email</dt>
                <dd className="font-medium text-ink">{customer.primaryEmail}</dd>
              </div>
              <div>
                <dt className="text-graphite/60">Másodlagos email</dt>
                <dd className="font-medium text-ink">{customer.secondaryEmail || "Nincs megadva"}</dd>
              </div>
              <div>
                <dt className="text-graphite/60">Telefon</dt>
                <dd className="font-medium text-ink">{customer.phone || "Nincs megadva"}</dd>
              </div>
              <div>
                <dt className="text-graphite/60">Helyszín</dt>
                <dd className="font-medium text-ink">{customer.venue || "Nincs megadva"}</dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </AdminShell>
  );
}
