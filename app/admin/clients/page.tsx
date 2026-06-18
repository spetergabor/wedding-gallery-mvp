import Link from "next/link";
import { CalendarDays, Mail, Plus, Users } from "lucide-react";
import { Alert } from "@/components/alert";
import { AdminShell } from "@/components/admin-shell";
import { ButtonLink } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
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
    return "Nincs dátum";
  }

  return date.toLocaleDateString("hu-HU", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

export default async function AdminClientsPage({
  searchParams
}: {
  searchParams: Promise<{ deleted?: string }>;
}) {
  const [, params] = await Promise.all([requireAdmin(), searchParams]);

  const customers = await prisma.customer.findMany({
    orderBy: [{ weddingDate: "asc" }, { createdAt: "desc" }]
  });

  return (
    <AdminShell>
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-brass">Ügyfelek</p>
          <h1 className="mt-2 text-4xl font-semibold text-ink">Ügyfélkezelő</h1>
          <p className="mt-3 max-w-2xl text-sm text-graphite/70">
            Párok, esküvői adatok és szerződés előkészítés egy helyen.
          </p>
        </div>
        <ButtonLink href="/admin/clients/new">
          <Plus size={16} />
          Új ügyfél
        </ButtonLink>
      </div>

      {params.deleted ? (
        <div className="mb-5">
          <Alert title="Ügyfél törölve." variant="success" />
        </div>
      ) : null}

      {customers.length === 0 ? (
        <EmptyState
          icon={<Users size={22} />}
          title="Még nincs ügyfél"
          description="Vidd fel az első párt, majd később ehhez kapcsoljuk a szerződést és aláírást."
          action={
            <ButtonLink href="/admin/clients/new">
              <Plus size={16} />
              Új ügyfél
            </ButtonLink>
          }
        />
      ) : (
        <section className="overflow-hidden rounded-lg border border-ink/10 bg-white shadow-soft">
          <div className="divide-y divide-ink/10">
            {customers.map((customer) => (
              <Link
                key={customer.id}
                href={`/admin/clients/${customer.id}`}
                className="grid gap-4 px-5 py-5 transition hover:bg-ink/[0.03] md:grid-cols-[1fr_auto] md:items-center"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-semibold text-ink">{customer.coupleName}</p>
                    <span className="rounded-full bg-ink/5 px-2.5 py-1 text-xs font-medium text-graphite">
                      {statusLabels[customer.status] ?? customer.status}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-col gap-1 text-sm text-graphite/70 sm:flex-row sm:items-center sm:gap-4">
                    <span className="inline-flex items-center gap-1.5">
                      <Mail size={14} />
                      {customer.primaryEmail}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays size={14} />
                      {formatDate(customer.weddingDate)}
                    </span>
                  </div>
                </div>
                <div className="text-sm text-graphite/70 md:text-right">
                  <p>{customer.venue || "Nincs helyszín"}</p>
                  <p>Frissítve: {formatDate(customer.updatedAt)}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </AdminShell>
  );
}
