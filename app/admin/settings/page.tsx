import Link from "next/link";
import { Activity, Cloud, Database, ExternalLink, GitBranch, Globe2, Mail, Server, Zap } from "lucide-react";
import { Alert } from "@/components/alert";
import { AdminShell } from "@/components/admin-shell";
import { SiteSettingsForm } from "@/components/site-settings-form";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type SettingsTab = "brand" | "providers";

const providerLinks = [
  {
    name: "Trigger.dev",
    description: "ZIP és média háttérfeladatok, futások, duration, retryk.",
    icon: Zap,
    links: [
      { label: "Dashboard", href: "https://cloud.trigger.dev" },
      { label: "Deployments", href: "https://cloud.trigger.dev/projects/v3/proj_ernxqehukwacwhubgqsp/deployments" },
      { label: "Pricing", href: "https://trigger.dev/pricing" }
    ],
    costHint: "ZIP worker futási idő és gépméret alapján fontos figyelni."
  },
  {
    name: "Vercel",
    description: "Next.js app hosting, deployok, function logok, domain routing.",
    icon: Server,
    links: [
      { label: "Dashboard", href: "https://vercel.com/dashboard" },
      { label: "Usage", href: "https://vercel.com/dashboard/usage" },
      { label: "Pricing", href: "https://vercel.com/pricing" }
    ],
    costHint: "Build, bandwidth és function usage nőhet több fotósnál."
  },
  {
    name: "Neon",
    description: "PostgreSQL adatbázis, storage, compute, connection pool.",
    icon: Database,
    links: [
      { label: "Console", href: "https://console.neon.tech" },
      { label: "Billing", href: "https://console.neon.tech/app/billing" },
      { label: "Pricing", href: "https://neon.com/pricing" }
    ],
    costHint: "Fotósok, ügyfelek, galériák és naplók száma növeli az adatbázis méretét."
  },
  {
    name: "Cloudflare R2",
    description: "Fotók, videók, ZIP-ek, letöltési sávszélesség és CDN domain.",
    icon: Cloud,
    links: [
      { label: "Dashboard", href: "https://dash.cloudflare.com" },
      { label: "R2", href: "https://dash.cloudflare.com/?to=/:account/r2" },
      { label: "Pricing", href: "https://developers.cloudflare.com/r2/pricing/" }
    ],
    costHint: "A legnagyobb költségtényező hosszú távon várhatóan a tárhely."
  },
  {
    name: "Resend",
    description: "Ügyfél emailek, válogató linkek, ZIP letöltési linkek.",
    icon: Mail,
    links: [
      { label: "Dashboard", href: "https://resend.com/emails" },
      { label: "Domains", href: "https://resend.com/domains" },
      { label: "Pricing", href: "https://resend.com/pricing" }
    ],
    costHint: "Általában olcsó marad, de több fotósnál domain és volumen miatt figyelni kell."
  },
  {
    name: "GitHub",
    description: "Forráskód, commitok, deploy trigger, verziókövetés.",
    icon: GitBranch,
    links: [
      { label: "Repository", href: "https://github.com/spetergabor/wedding-gallery-mvp" },
      { label: "Actions", href: "https://github.com/spetergabor/wedding-gallery-mvp/actions" },
      { label: "Billing", href: "https://github.com/settings/billing" }
    ],
    costHint: "MVP-ben főleg fejlesztési infrastruktúra, nem tipikus végfelhasználói költség."
  },
  {
    name: "Domain / DNS",
    description: "Saját domain, későbbi fotós domainek, CDN és email DNS rekordok.",
    icon: Globe2,
    links: [
      { label: "Cloudflare DNS", href: "https://dash.cloudflare.com" },
      { label: "Aktív app", href: "https://gallery.hochzeitsfotografgraz.at" },
      { label: "CDN", href: "https://cdn.hochzeitsfotografgraz.at" }
    ],
    costHint: "Saját brandingnél és fotós domaineknél ez külön operációs terület lesz."
  }
];

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
    tab?: string;
  }>;
}) {
  const [admin, params] = await Promise.all([requireAdmin(), searchParams]);
  const activeTab: SettingsTab = params.tab === "providers" && admin.role === "super_admin" ? "providers" : "brand";
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
        <p className="text-xs uppercase tracking-[0.16em] text-graphite/60">Admin</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">Általános beállítások</h1>
        <p className="mt-3 max-w-2xl text-graphite/70">
          Márkaadatok, logó, elérhetőségek és a platform külső szolgáltatói egy helyen.
        </p>
      </div>

      <div className="mb-6 rounded-md border border-ink/10 bg-white p-2">
        <nav className={`grid gap-2 ${admin.role === "super_admin" ? "sm:grid-cols-2" : "sm:grid-cols-1"}`} aria-label="Beállítások fülek">
          <Link
            href="/admin/settings?tab=brand"
            className={`flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition ${
              activeTab === "brand" ? "bg-ink text-white shadow-sm" : "text-graphite hover:bg-ink/5 hover:text-ink"
            }`}
          >
            <Globe2 size={16} />
            Márka
          </Link>
          {admin.role === "super_admin" ? (
            <Link
              href="/admin/settings?tab=providers"
              className={`flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition ${
                activeTab === "providers" ? "bg-ink text-white shadow-sm" : "text-graphite hover:bg-ink/5 hover:text-ink"
              }`}
            >
              <Activity size={16} />
              Szolgáltatók
            </Link>
          ) : null}
        </nav>
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

      {activeTab === "brand" ? <SiteSettingsForm settings={settings ?? emptySettings} /> : null}

      {activeTab === "providers" ? (
        <div className="space-y-6">
          <section className="rounded-md border border-ink/10 bg-white p-5">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-paper text-graphite">
                <Activity size={18} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-ink">Külső szolgáltatók gyors elérése</h2>
                <p className="mt-1 max-w-2xl text-sm text-graphite/70">
                  Első körben ezek gyors linkek és költségfigyelési kapaszkodók. Később ide köthetők API-s usage adatok, havi becslések és figyelmeztetések.
                </p>
              </div>
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            {providerLinks.map((provider) => {
              const Icon = provider.icon;

              return (
                <section key={provider.name} className="rounded-md border border-ink/10 bg-white p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-paper text-graphite">
                      <Icon size={18} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-ink">{provider.name}</h3>
                      <p className="mt-1 text-sm text-graphite/70">{provider.description}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {provider.links.map((link) => (
                      <a
                        key={`${provider.name}-${link.label}`}
                        href={link.href}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-10 items-center gap-2 rounded-md border border-ink/15 bg-white px-3 text-sm font-medium text-ink transition hover:border-ink/30"
                      >
                        {link.label}
                        <ExternalLink size={14} />
                      </a>
                    ))}
                  </div>
                  <p className="mt-4 rounded-md bg-paper px-3 py-2 text-sm text-graphite/75">{provider.costHint}</p>
                </section>
              );
            })}
          </div>
        </div>
      ) : null}
    </AdminShell>
  );
}
