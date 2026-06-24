import { AdminShell } from "@/components/admin-shell";
import { Alert } from "@/components/alert";
import { GalleryForm } from "@/components/gallery-form";
import { requireAdmin } from "@/lib/auth";
import { adminOwnedWhere } from "@/lib/admin-scope";
import { prisma } from "@/lib/prisma";

export default async function NewGalleryPage({
  searchParams
}: {
  searchParams: Promise<{ customerId?: string; projectId?: string; error?: string }>;
}) {
  const admin = await requireAdmin();
  const flags = await searchParams;
  const customers = await prisma.customer.findMany({
    where: adminOwnedWhere(admin),
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      customerType: true,
      coupleName: true,
      primaryEmail: true,
      weddingDate: true
    }
  });
  const projects = await prisma.customerProject.findMany({
    where: {
      customer: adminOwnedWhere(admin)
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      customerId: true,
      title: true,
      projectType: true,
      eventDate: true,
      venue: true,
      customer: {
        select: {
          coupleName: true
        }
      }
    }
  });
  const selectedProject = projects.find((project) => project.id === flags.projectId) ?? null;
  const selectedCustomerId = selectedProject?.customerId ?? (customers.some((customer) => customer.id === flags.customerId) ? flags.customerId : null);
  const selectedProjectId = selectedProject?.id ?? null;

  return (
    <AdminShell>
      <div className="mb-8">
        <p className="text-sm uppercase tracking-[0.24em] text-brass">Új galéria</p>
        <h1 className="mt-2 text-4xl font-semibold text-ink">Galéria létrehozása</h1>
        <p className="mt-3 max-w-2xl text-sm text-graphite/70">
          Kapcsold meglévő ügyfélhez, ha munkafolyamat része. Saját vagy belső célra ügyfél nélkül is létrehozható.
        </p>
      </div>
      <div className="mb-5 space-y-3">
        {flags.error === "slug" ? (
          <Alert title="Ez a slug már foglalt." variant="error">Adj meg egy egyedi publikus linket.</Alert>
        ) : null}
        {flags.error === "missing" ? <Alert title="Hiányzó kötelező mező." variant="error" /> : null}
        {flags.error === "customer" ? (
          <Alert title="Válassz érvényes ügyfelet." variant="error">
            A kiválasztott ügyfél nem található vagy nem hozzád tartozik.
          </Alert>
        ) : null}
        {flags.error === "project" ? (
          <Alert title="Válassz az ügyfélhez tartozó projektet." variant="error">
            A projekt és az ügyfél nem passzol egymáshoz.
          </Alert>
        ) : null}
      </div>
      <GalleryForm customers={customers} projects={projects} selectedCustomerId={selectedCustomerId} selectedProjectId={selectedProjectId} />
    </AdminShell>
  );
}
