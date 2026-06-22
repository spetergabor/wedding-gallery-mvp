import Link from "next/link";
import { CalendarDays, Mail, Plus, Users } from "lucide-react";
import { Alert } from "@/components/alert";
import { AdminShell } from "@/components/admin-shell";
import { ButtonLink } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { requireAdmin } from "@/lib/auth";
import { adminOwnedWhere } from "@/lib/admin-scope";
import { CUSTOMER_STATUSES, CUSTOMER_TYPES, customerStatusLabel, customerTypeLabel, normalizeCustomerStatus, normalizeCustomerType } from "@/lib/customer-options";
import { prisma } from "@/lib/prisma";

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
  searchParams: Promise<{ deleted?: string; q?: string; status?: string; type?: string }>;
}) {
  const [admin, params] = await Promise.all([requireAdmin(), searchParams]);
  const query = (params.q ?? "").trim();
  const statusFilter = params.status ? normalizeCustomerStatus(params.status) : "";
  const typeFilter = params.type ? normalizeCustomerType(params.type) : "";
  const statusValues =
    statusFilter === "offer_sent"
      ? ["offer_sent", "contract_pending"]
      : statusFilter === "delivered"
        ? ["delivered", "completed"]
        : statusFilter
          ? [statusFilter]
          : [];

  const customers = await prisma.customer.findMany({
    where: {
      ...adminOwnedWhere(admin),
      ...(statusValues.length > 0 ? { status: { in: statusValues } } : {}),
      ...(typeFilter ? { customerType: typeFilter } : {}),
      ...(query
        ? {
            OR: [
              { coupleName: { contains: query, mode: "insensitive" } },
              { primaryEmail: { contains: query, mode: "insensitive" } },
              { secondaryEmail: { contains: query, mode: "insensitive" } },
              { phone: { contains: query, mode: "insensitive" } },
              { venue: { contains: query, mode: "insensitive" } }
            ]
          }
        : {})
    },
    orderBy: [{ weddingDate: "asc" }, { createdAt: "desc" }],
    include: {
      _count: {
        select: {
          galleries: true,
          contracts: true
        }
      }
    }
  });

  return (
    <AdminShell>
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-brass">Ügyfelek</p>
          <h1 className="mt-2 text-4xl font-semibold text-ink">Ügyfélkezelő</h1>
          <p className="mt-3 max-w-2xl text-sm text-graphite/70">
            Az ügyfél a nulladik pont: innen indul a galéria, a feltöltés, a válogatás és a szerződés.
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

      <form className="mb-5 rounded-lg border border-ink/10 bg-white p-4 shadow-soft">
        <div className="grid gap-3 md:grid-cols-[1fr_220px_220px_auto] md:items-end">
          <label className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-[0.16em] text-graphite/55">Keresés</span>
            <input
              name="q"
              defaultValue={query}
              placeholder="Név, email, telefon, helyszín..."
              className="h-11 w-full rounded-md border border-ink/15 bg-paper px-3 text-sm text-ink outline-none transition focus:border-ink/50"
            />
          </label>
          <label className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-[0.16em] text-graphite/55">Típus</span>
            <select
              name="type"
              defaultValue={typeFilter}
              className="h-11 w-full rounded-md border border-ink/15 bg-paper px-3 text-sm text-ink outline-none transition focus:border-ink/50"
            >
              <option value="">Minden típus</option>
              {CUSTOMER_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-[0.16em] text-graphite/55">Státusz</span>
            <select
              name="status"
              defaultValue={statusFilter}
              className="h-11 w-full rounded-md border border-ink/15 bg-paper px-3 text-sm text-ink outline-none transition focus:border-ink/50"
            >
              <option value="">Minden státusz</option>
              {CUSTOMER_STATUSES.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <button className="h-11 rounded-md bg-ink px-4 text-sm font-medium text-white transition hover:bg-graphite">
              Szűrés
            </button>
            <Link href="/admin/clients" className="inline-flex h-11 items-center rounded-md px-3 text-sm font-medium text-graphite hover:bg-ink/5">
              Törlés
            </Link>
          </div>
        </div>
      </form>

      {customers.length === 0 ? (
        <EmptyState
          icon={<Users size={22} />}
          title={query || statusFilter || typeFilter ? "Nincs találat" : "Még nincs ügyfél"}
          description={
            query || statusFilter || typeFilter
              ? "Módosítsd a keresést vagy töröld a szűrőket."
              : "Vidd fel az első ügyfelet, utána ehhez tudsz galériát, szerződést és átadást kapcsolni."
          }
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
                      {customerStatusLabel(customer.status)}
                    </span>
                    <span className="rounded-full bg-brass/10 px-2.5 py-1 text-xs font-medium text-brass">
                      {customerTypeLabel(customer.customerType)}
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
                  <p>{customer._count.galleries} galéria · {customer._count.contracts} szerződés</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </AdminShell>
  );
}
