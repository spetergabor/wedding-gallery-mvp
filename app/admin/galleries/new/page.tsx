import Link from "next/link";
import { Camera, CheckCircle2, ImagePlus } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { Alert } from "@/components/alert";
import { GalleryForm } from "@/components/gallery-form";
import { requireAdmin } from "@/lib/auth";
import { adminOwnedWhere, ownerAdminId } from "@/lib/admin-scope";
import { prisma } from "@/lib/prisma";
import { GALLERY_MODE_FULL, GALLERY_MODE_PROOFING } from "@/lib/proofing";

function modeHref(mode: string, flags: { customerId?: string; projectId?: string }) {
  const params = new URLSearchParams({ mode });

  if (flags.customerId) {
    params.set("customerId", flags.customerId);
  }

  if (flags.projectId) {
    params.set("projectId", flags.projectId);
  }

  return `/admin/galleries/new?${params.toString()}`;
}

function chooserHref(flags: { customerId?: string; projectId?: string }) {
  const params = new URLSearchParams();

  if (flags.customerId) {
    params.set("customerId", flags.customerId);
  }

  if (flags.projectId) {
    params.set("projectId", flags.projectId);
  }

  const query = params.toString();
  return query ? `/admin/galleries/new?${query}` : "/admin/galleries/new";
}

export default async function NewGalleryPage({
  searchParams
}: {
  searchParams: Promise<{ customerId?: string; projectId?: string; error?: string; mode?: string }>;
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
  const stripeIntegration = await prisma.stripeConnectIntegration.findUnique({
    where: { adminId: ownerAdminId(admin) },
    select: { chargesEnabled: true }
  });
  const selectedProject = projects.find((project) => project.id === flags.projectId) ?? null;
  const selectedCustomerId = selectedProject?.customerId ?? (customers.some((customer) => customer.id === flags.customerId) ? flags.customerId : null);
  const selectedProjectId = selectedProject?.id ?? null;
  const selectedMode = flags.mode === GALLERY_MODE_PROOFING ? GALLERY_MODE_PROOFING : flags.mode === GALLERY_MODE_FULL ? GALLERY_MODE_FULL : null;

  return (
    <AdminShell>
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.16em] text-graphite/60">Új galéria</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">Galéria létrehozása</h1>
        <p className="mt-3 max-w-2xl text-sm text-graphite/70">
          Először válaszd ki, milyen munkafolyamatot indítasz. Így a feltöltés, ügyfél link és átadás útvonala is egyértelmű lesz.
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
        {flags.error === "stripe_required" ? (
          <Alert title="A fizetős galériához előbb Stripe kapcsolat kell." variant="error">
            Kösd össze a saját Stripe fiókodat a Beállítások / Integrációk alatt, utána választható a megvásárolható galéria mód.
          </Alert>
        ) : null}
        {flags.error === "price_required" ? (
          <Alert title="Adj meg árat a fizetős galériához." variant="error">
            A megvásárolható galéria csak pozitív árral menthető.
          </Alert>
        ) : null}
      </div>
      {!selectedMode ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <Link
            href={modeHref(GALLERY_MODE_FULL, flags)}
            className="group rounded-md border border-ink/10 bg-white p-6 transition hover:border-ink/25 hover:bg-ink/[0.02]"
          >
            <div className="flex size-12 items-center justify-center rounded-md bg-ink text-white">
              <Camera size={22} />
            </div>
            <h2 className="mt-5 text-2xl font-semibold text-ink">Kész galéria átadásra</h2>
            <p className="mt-3 text-sm leading-6 text-graphite/70">
              Végleges képek feltöltése, publikus vendéggaléria, letöltések és átadási link. Ezt válaszd, ha az anyag már kész.
            </p>
            <div className="mt-5 space-y-2 text-sm text-graphite">
              <p className="flex items-center gap-2"><CheckCircle2 size={15} /> Kész képek feltöltése</p>
              <p className="flex items-center gap-2"><CheckCircle2 size={15} /> Vendégoldali galéria</p>
              <p className="flex items-center gap-2"><CheckCircle2 size={15} /> Letöltések és ZIP csomagok</p>
            </div>
            <span className="mt-6 inline-flex h-11 items-center rounded-md bg-ink px-4 text-sm font-medium text-white transition group-hover:bg-graphite">
              Kész galéria indítása
            </span>
          </Link>

          <Link
            href={modeHref(GALLERY_MODE_PROOFING, flags)}
            className="group rounded-md border border-ink/10 bg-white p-6 transition hover:border-ink/25 hover:bg-ink/[0.02]"
          >
            <div className="flex size-12 items-center justify-center rounded-md bg-brass text-white">
              <ImagePlus size={22} />
            </div>
            <h2 className="mt-5 text-2xl font-semibold text-ink">Nyers képek válogatásra</h2>
            <p className="mt-3 text-sm leading-6 text-graphite/70">
              Nyers képek feltöltése, ügyfél válogató link, leadott választás, majd későbbi kész galéria átadás.
            </p>
            <div className="mt-5 space-y-2 text-sm text-graphite">
              <p className="flex items-center gap-2"><CheckCircle2 size={15} /> Ügyfél válogató workflow</p>
              <p className="flex items-center gap-2"><CheckCircle2 size={15} /> Leadott választás követése</p>
              <p className="flex items-center gap-2"><CheckCircle2 size={15} /> Kész képek későbbi átadása</p>
            </div>
            <span className="mt-6 inline-flex h-11 items-center rounded-md bg-ink px-4 text-sm font-medium text-white transition group-hover:bg-graphite">
              Nyers válogatás indítása
            </span>
          </Link>
        </section>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col justify-between gap-3 rounded-md border border-ink/10 bg-white p-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-graphite/65">Kiválasztott útvonal</p>
              <p className="mt-1 text-base font-semibold text-ink">
                {selectedMode === GALLERY_MODE_PROOFING ? "Nyers képek válogatásra" : "Kész galéria átadásra"}
              </p>
            </div>
            <Link href={chooserHref(flags)} className="inline-flex h-10 items-center justify-center rounded-md border border-ink/10 px-3 text-sm font-medium text-graphite hover:bg-ink/5">
              Másik útvonal
            </Link>
          </div>
          <GalleryForm
            customers={customers}
            projects={projects}
            selectedCustomerId={selectedCustomerId}
            selectedProjectId={selectedProjectId}
            initialGalleryMode={selectedMode}
            stripeReady={Boolean(stripeIntegration?.chargesEnabled)}
          />
        </div>
      )}
    </AdminShell>
  );
}
