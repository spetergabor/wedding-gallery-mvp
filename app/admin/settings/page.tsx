import { Alert } from "@/components/alert";
import { AdminShell } from "@/components/admin-shell";
import { SiteSettingsForm } from "@/components/site-settings-form";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const emptySettings = {
  businessName: "",
  logoUrl: null,
  signatureUrl: null,
  websiteUrl: null,
  instagramUrl: null,
  facebookUrl: null,
  tiktokUrl: null,
  youtubeUrl: null,
  contactEmail: null,
  contactPhone: null
};

export default async function AdminSettingsPage({
  searchParams
}: {
  searchParams: Promise<{
    error?: string;
    saved?: string;
  }>;
}) {
  const [admin, params] = await Promise.all([requireAdmin(), searchParams]);
  const settings = await prisma.siteSettings.findFirst({
    where: {
      OR: [{ adminId: admin.id }, ...(admin.role === "super_admin" ? [{ id: "default" }] : [])]
    },
    select: {
      businessName: true,
      logoUrl: true,
      signatureUrl: true,
      websiteUrl: true,
      instagramUrl: true,
      facebookUrl: true,
      tiktokUrl: true,
      youtubeUrl: true,
      contactEmail: true,
      contactPhone: true
    }
  });

  return (
    <AdminShell>
      <div className="mb-8">
        <p className="text-sm uppercase tracking-[0.24em] text-brass">Admin</p>
        <h1 className="mt-2 text-4xl font-semibold text-ink">Általános beállítások</h1>
        <p className="mt-3 max-w-2xl text-graphite/70">
          Márkaadatok, logó, elérhetőségek és social linkek egy helyen.
        </p>
      </div>

      <div className="mb-5 space-y-3">
        {params.saved ? <Alert title="Beállítások mentve." variant="success" /> : null}
        {params.error === "logo" ? (
          <Alert title="A logó feltöltése nem sikerült." variant="error">
            Csak képfájlt tölts fel logóként.
          </Alert>
        ) : null}
        {params.error === "signature" ? (
          <Alert title="Az aláírás feltöltése nem sikerült." variant="error">
            PNG képfájlt tölts fel aláírásként.
          </Alert>
        ) : null}
      </div>

      <SiteSettingsForm settings={settings ?? emptySettings} />
    </AdminShell>
  );
}
