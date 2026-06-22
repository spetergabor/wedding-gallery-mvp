import { Plus, Users } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Alert } from "@/components/alert";
import { ButtonLink } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { GalleryForm } from "@/components/gallery-form";
import { requireAdmin } from "@/lib/auth";
import { adminOwnedWhere } from "@/lib/admin-scope";
import { prisma } from "@/lib/prisma";

export default async function NewGalleryPage({
  searchParams
}: {
  searchParams: Promise<{ customerId?: string; error?: string }>;
}) {
  const admin = await requireAdmin();
  const flags = await searchParams;
  const customers = await prisma.customer.findMany({
    where: adminOwnedWhere(admin),
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      coupleName: true,
      primaryEmail: true,
      weddingDate: true
    }
  });
  const selectedCustomerId = customers.some((customer) => customer.id === flags.customerId) ? flags.customerId : null;

  return (
    <AdminShell>
      <div className="mb-8">
        <p className="text-sm uppercase tracking-[0.24em] text-brass">Új galéria</p>
        <h1 className="mt-2 text-4xl font-semibold text-ink">Galéria létrehozása</h1>
        <p className="mt-3 max-w-2xl text-sm text-graphite/70">
          Válassz meglévő ügyfelet, majd ehhez kapcsolódik a feltöltés, a válogatás, az átadás és a szerződéses folyamat.
        </p>
      </div>
      <div className="mb-5 space-y-3">
        {flags.error === "slug" ? (
          <Alert title="Ez a slug már foglalt." variant="error">Adj meg egy egyedi publikus linket.</Alert>
        ) : null}
        {flags.error === "missing" ? <Alert title="Hiányzó kötelező mező." variant="error" /> : null}
        {flags.error === "customer" ? (
          <Alert title="Válassz érvényes ügyfelet." variant="error">
            A galéria csak létező ügyfélhez kapcsolva hozható létre.
          </Alert>
        ) : null}
      </div>
      {customers.length === 0 ? (
        <EmptyState
          icon={<Users size={22} />}
          title="Először hozz létre ügyfelet"
          description="Az új működésben az ügyfél a nulladik pont. Az ügyfél adatlapjáról indítható a galéria, szerződés és később a fizetés."
          action={
            <ButtonLink href="/admin/clients/new">
              <Plus size={16} />
              Új ügyfél
            </ButtonLink>
          }
        />
      ) : (
        <GalleryForm customers={customers} selectedCustomerId={selectedCustomerId} />
      )}
    </AdminShell>
  );
}
