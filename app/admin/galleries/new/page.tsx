import { AdminShell } from "@/components/admin-shell";
import { Alert } from "@/components/alert";
import { GalleryForm } from "@/components/gallery-form";
import { requireAdmin } from "@/lib/auth";

export default async function NewGalleryPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAdmin();
  const flags = await searchParams;

  return (
    <AdminShell>
      <div className="mb-8">
        <p className="text-sm uppercase tracking-[0.24em] text-brass">Új galéria</p>
        <h1 className="mt-2 text-4xl font-semibold text-ink">Galéria létrehozása</h1>
      </div>
      <div className="mb-5 space-y-3">
        {flags.error === "slug" ? (
          <Alert title="Ez a slug már foglalt." variant="error">Adj meg egy egyedi publikus linket.</Alert>
        ) : null}
        {flags.error === "missing" ? <Alert title="Hiányzó kötelező mező." variant="error" /> : null}
      </div>
      <GalleryForm />
    </AdminShell>
  );
}
