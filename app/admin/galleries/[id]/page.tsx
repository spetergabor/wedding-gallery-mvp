import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { Alert } from "@/components/alert";
import { AdminShell } from "@/components/admin-shell";
import { ButtonLink } from "@/components/button";
import { DownloadLog } from "@/components/download-log";
import { GalleryDangerZone } from "@/components/gallery-danger-zone";
import { GalleryForm } from "@/components/gallery-form";
import { PhotoManager } from "@/components/photo-manager";
import { StatCard } from "@/components/stat-card";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function GalleryDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    activated?: string;
    archived?: string;
    coverSet?: string;
    error?: string;
    ordered?: string;
    photoAdded?: string;
    photoError?: string;
    saved?: string;
  }>;
}) {
  await requireAdmin();

  const { id } = await params;
  const flags = await searchParams;
  const gallery = await prisma.gallery.findUnique({
    where: { id },
    include: {
      downloads: { orderBy: { createdAt: "desc" } },
      photos: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }
    }
  });

  if (!gallery) {
    notFound();
  }

  return (
    <AdminShell>
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-brass">Galéria</p>
          <h1 className="mt-2 text-4xl font-semibold text-ink">{gallery.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <p className="text-sm text-graphite/70">/g/{gallery.slug}</p>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${gallery.isActive ? "bg-sage/15 text-sage" : "bg-ink/5 text-graphite"}`}>
              {gallery.isActive ? "Aktív" : "Archivált"}
            </span>
          </div>
        </div>
        <ButtonLink href={`/g/${gallery.slug}`} variant="secondary">
          <ExternalLink size={16} />
          Publikus nézet
        </ButtonLink>
      </div>

      <div className="mb-5 space-y-3">
        {flags.saved ? <Alert title="Galéria mentve." variant="success" /> : null}
        {flags.photoAdded ? <Alert title="Fotók feltöltve." variant="success" /> : null}
        {flags.coverSet ? <Alert title="Borítókép beállítva." variant="success" /> : null}
        {flags.ordered ? <Alert title="Fotósorrend frissítve." variant="success" /> : null}
        {flags.archived ? <Alert title="Galéria archiválva." variant="success">A publikus link most nem elérhető.</Alert> : null}
        {flags.activated ? <Alert title="Galéria aktiválva." variant="success">A publikus link újra elérhető.</Alert> : null}
        {flags.error === "slug" ? (
          <Alert title="Ez a slug már foglalt." variant="error">Adj meg egy egyedi publikus linket.</Alert>
        ) : null}
        {flags.error === "missing" ? <Alert title="Hiányzó kötelező mező." variant="error" /> : null}
        {flags.photoError === "missing" ? <Alert title="Nem választottál ki fotót." variant="error" /> : null}
        {flags.photoError === "storage" ? (
          <Alert title="A feltöltés nem sikerült." variant="error">
            Ellenőrizd az R2 bucket nevét, endpointját és a hozzáférési kulcsokat Vercelben.
          </Alert>
        ) : null}
      </div>

      <div className="space-y-8">
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard label="Fotók" value={gallery.photos.length} detail="Feltöltött képek száma" />
          <StatCard label="ZIP letöltések" value={gallery.downloads.length} detail="Email címmel rögzített letöltések" />
          <StatCard label="Állapot" value={gallery.isActive ? "Aktív" : "Archivált"} detail="Publikus elérhetőség" />
          <StatCard label="Védelem" value={gallery.password ? "Jelszavas" : "Nyitott"} detail="Galéria hozzáférés" />
        </div>

        <GalleryForm gallery={gallery} />
        <GalleryDangerZone galleryId={gallery.id} isActive={gallery.isActive} />
        <DownloadLog downloads={gallery.downloads} />
        <PhotoManager coverPhotoId={gallery.coverPhotoId} galleryId={gallery.id} photos={gallery.photos} />
      </div>
    </AdminShell>
  );
}
