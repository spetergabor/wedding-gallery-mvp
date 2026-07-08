import Link from "next/link";
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  Cloud,
  Database,
  ExternalLink,
  GitBranch,
  Globe2,
  HardDrive,
  Layers,
  Mail,
  Server,
  ShieldCheck,
  TrendingUp,
  UserRound,
  Zap
} from "lucide-react";
import { Alert } from "@/components/alert";
import { AdminShell } from "@/components/admin-shell";
import { AdminSecuritySettings } from "@/components/admin-security-settings";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { FormSubmitButton } from "@/components/form-submit-button";
import { PhotographerProfileSettings } from "@/components/photographer-profile-settings";
import { SiteSettingsForm } from "@/components/site-settings-form";
import { ownerAdminId } from "@/lib/admin-scope";
import { APP_TIME_ZONE } from "@/lib/date-format";
import { requireAdmin } from "@/lib/auth";
import {
  getGoogleCalendarOptionsForIntegration,
  googleCalendarMissingConfigKeys,
  isGoogleCalendarConfigured,
  type GoogleCalendarOption
} from "@/lib/google-calendar-api";
import { prisma } from "@/lib/prisma";
import { disconnectGoogleCalendarAction, updateGoogleCalendarSettingsAction } from "@/lib/settings-actions";

type SettingsTab = "brand" | "profile" | "integrations" | "providers" | "security";

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
      { label: "Repository", href: "https://github.com/spetergabor/spetly" },
      { label: "Actions", href: "https://github.com/spetergabor/spetly/actions" },
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
      { label: "Aktív app", href: "https://spetly.app" },
      { label: "CDN", href: "https://cdn.hochzeitsfotografgraz.at" }
    ],
    costHint: "Saját brandingnél és fotós domaineknél ez külön operációs terület lesz."
  }
];

const emptySettings = {
  businessName: "",
  logoUrl: null,
  logoHeight: 80,
  signatureUrl: null,
  websiteUrl: null,
  instagramUrl: null,
  facebookUrl: null,
  tiktokUrl: null,
  youtubeUrl: null,
  contactEmail: null,
  contactPhone: null
};

const ONE_GB = 1024 ** 3;
const R2_STORAGE_FREE_GB = 10;
const R2_STORAGE_USD_PER_GB_MONTH = 0.015;
const R2_CLASS_A_FREE_REQUESTS = 1_000_000;
const R2_CLASS_B_FREE_REQUESTS = 10_000_000;
const R2_CLASS_A_USD_PER_MILLION = 4.5;
const R2_CLASS_B_USD_PER_MILLION = 0.36;
const RESEND_FREE_EMAILS = 3_000;
const RESEND_PRO_EMAILS = 50_000;
const RESEND_PRO_MONTHLY_USD = 20;
const RESEND_EXTRA_USD_PER_1000 = 0.9;
const VERCEL_FREE_MONTHLY_USD = 0;
const NEON_FREE_MONTHLY_USD = 0;
const TRIGGER_HOBBY_MONTHLY_USD = 10;

type ProviderTone = "ok" | "watch" | "attention";

type ProviderUsageCard = {
  name: string;
  status: string;
  tone: ProviderTone;
  primaryMetric: string;
  secondaryMetric: string;
  estimatedUsd: number;
  estimateNote: string;
};

type ServiceUsageSummary = {
  monthLabel: string;
  estimatedMonthlyUsd: number;
  attentionCount: number;
  activePhotographers: number;
  totalPhotographers: number;
  totalCustomers: number;
  totalGalleries: number;
  totalPhotos: number;
  storageBytes: bigint;
  monthlyEmails: number;
  monthlyGalleryViews: number;
  monthlyZipPackages: number;
  monthlyZipBytes: bigint;
  openZipProblems: number;
  databaseRows: number;
  providers: ProviderUsageCard[];
};

function startOfCurrentMonth() {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfNextMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

function monthLabel(date: Date) {
  return date.toLocaleDateString("hu-HU", {
    year: "numeric",
    month: "long",
    timeZone: APP_TIME_ZONE
  });
}

function toBigInt(value: number | bigint | null | undefined) {
  if (typeof value === "bigint") {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return BigInt(Math.max(0, Math.round(value)));
  }

  return BigInt(0);
}

function formatBytes(value: bigint | number | null | undefined) {
  const bytes = typeof value === "bigint" ? Number(value) : value ?? 0;

  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 MB";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const amount = bytes / 1024 ** exponent;

  return `${amount >= 10 || exponent === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[exponent]}`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("hu-HU").format(value);
}

function formatUsd(value: number) {
  return new Intl.NumberFormat("hu-HU", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 10 ? 0 : 2
  }).format(value);
}

function roundCost(value: number) {
  return Math.round(value * 100) / 100;
}

function estimateR2Cost(storageBytes: bigint, classARequests: number, classBRequests: number) {
  const storageGb = Number(storageBytes) / ONE_GB;
  const billableStorageGb = Math.max(0, Math.ceil(storageGb) - R2_STORAGE_FREE_GB);
  const billableClassAMillions = Math.max(0, Math.ceil(classARequests / 1_000_000) - R2_CLASS_A_FREE_REQUESTS / 1_000_000);
  const billableClassBMillions = Math.max(0, Math.ceil(classBRequests / 1_000_000) - R2_CLASS_B_FREE_REQUESTS / 1_000_000);

  return roundCost(
    billableStorageGb * R2_STORAGE_USD_PER_GB_MONTH +
      billableClassAMillions * R2_CLASS_A_USD_PER_MILLION +
      billableClassBMillions * R2_CLASS_B_USD_PER_MILLION
  );
}

function estimateResendCost(monthlyEmails: number) {
  if (monthlyEmails <= RESEND_FREE_EMAILS) {
    return 0;
  }

  if (monthlyEmails <= RESEND_PRO_EMAILS) {
    return RESEND_PRO_MONTHLY_USD;
  }

  return roundCost(RESEND_PRO_MONTHLY_USD + Math.ceil((monthlyEmails - RESEND_PRO_EMAILS) / 1000) * RESEND_EXTRA_USD_PER_1000);
}

function toneClass(tone: ProviderTone) {
  if (tone === "attention") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (tone === "watch") {
    return "border-brass/25 bg-brass/10 text-brass";
  }

  return "border-sage/25 bg-sage/10 text-sage";
}

function providerCardClass(tone: ProviderTone) {
  if (tone === "attention") {
    return "border-red-200";
  }

  if (tone === "watch") {
    return "border-brass/30";
  }

  return "border-ink/10";
}

type GoogleCalendarIntegrationSettings = {
  googleAccountEmail: string | null;
  calendarId: string;
  calendarSummary: string | null;
  syncMiniSessionBookings: boolean;
  syncCustomerProjects: boolean;
  blockAvailabilityFromGoogleCalendar: boolean;
  deleteCancelledEvents: boolean;
  lastSyncError: string | null;
  connectedAt: Date;
  updatedAt: Date;
};

function formatSettingsDateTime(date: Date | null | undefined) {
  if (!date) {
    return "Nincs adat";
  }

  return date.toLocaleString("hu-HU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIME_ZONE
  });
}

function calendarOptionValue(option: { id: string; summary: string }) {
  return `${option.id}|||${option.summary}`;
}

function GoogleCalendarSettings({
  configured,
  missingConfigKeys,
  integration,
  calendarOptions,
  calendarOptionsError
}: {
  configured: boolean;
  missingConfigKeys: string[];
  integration: GoogleCalendarIntegrationSettings | null;
  calendarOptions: GoogleCalendarOption[];
  calendarOptionsError: boolean;
}) {
  const selectedCalendar = integration
    ? calendarOptions.find((calendar) => calendar.id === integration.calendarId) ?? {
        id: integration.calendarId,
        summary: integration.calendarSummary || integration.calendarId,
        primary: false
      }
    : null;
  const calendarOptionsWithSelected =
    selectedCalendar && !calendarOptions.some((calendar) => calendar.id === selectedCalendar.id)
      ? [selectedCalendar, ...calendarOptions]
      : calendarOptions;

  return (
    <section className="rounded-md border border-ink/10 bg-white p-5 shadow-soft sm:p-6">
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-graphite/60">
            <CalendarDays size={15} />
            Google naptár
          </div>
          <h2 className="mt-2 text-xl font-semibold text-ink">Automatikus naptár szinkron</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-graphite/70">
            Ha össze van kötve, az ügyfélfoglalások és a dátummal rendelkező projektek automatikusan bekerülhetnek a kiválasztott Google naptárba. Külön kapcsolóval azt is beállíthatod, hogy a Google naptár foglalt eseményei blokkolják a foglalható idősávokat.
          </p>
        </div>
        {integration ? (
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-sage/10 px-3 py-1 text-xs font-medium text-sage">
            <CheckCircle2 size={14} />
            Összekötve
          </span>
        ) : (
          <span className="w-fit rounded-full bg-ink/5 px-3 py-1 text-xs font-medium text-graphite">Nincs összekötve</span>
        )}
      </div>

      {!configured ? (
        <div className="mt-5 rounded-md border border-brass/20 bg-brass/10 px-4 py-4 text-sm leading-6 text-graphite/75">
          <p className="font-medium text-ink">A Google OAuth még nincs konfigurálva.</p>
          <p className="mt-1">Vercelen add meg ezeket az env változókat: {missingConfigKeys.join(", ")}.</p>
        </div>
      ) : null}

      {!integration ? (
        <div className="mt-5 rounded-md border border-ink/10 bg-paper p-4">
          <p className="text-sm leading-6 text-graphite/70">
            Az összekötés Google belépést nyit. A rendszer csak naptáreseményeket hoz létre/módosít, és a naptárlistát olvassa a kiválasztáshoz.
          </p>
          <div className="mt-4">
            {configured ? (
              <Link href="/api/google-calendar/connect" className="inline-flex h-10 items-center justify-center rounded-md bg-ink px-4 text-sm font-medium text-white transition hover:bg-graphite">
                Google naptár összekötése
              </Link>
            ) : (
              <span className="inline-flex h-10 items-center justify-center rounded-md bg-ink/10 px-4 text-sm font-medium text-graphite/60">
                Google naptár összekötése
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <form action={updateGoogleCalendarSettingsAction} className="rounded-md border border-ink/10 bg-paper p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-md bg-white px-4 py-3">
                <p className="text-xs uppercase tracking-[0.14em] text-graphite/55">Google fiók</p>
                <p className="mt-1 truncate text-sm font-semibold text-ink">{integration.googleAccountEmail || "Google fiók"}</p>
              </div>
              <div className="rounded-md bg-white px-4 py-3">
                <p className="text-xs uppercase tracking-[0.14em] text-graphite/55">Kapcsolódva</p>
                <p className="mt-1 text-sm font-semibold text-ink">{formatSettingsDateTime(integration.connectedAt)}</p>
              </div>
            </div>

            <label className="mt-4 block space-y-2">
              <span className="text-sm font-medium text-graphite">Célnaptár</span>
              <select name="calendarId" defaultValue={selectedCalendar ? calendarOptionValue(selectedCalendar) : "primary|||Primary"} className="h-12 w-full rounded-md border border-ink/15 bg-white px-3 text-ink outline-none transition focus:border-ink/50">
                {calendarOptionsWithSelected.length > 0 ? (
                  calendarOptionsWithSelected.map((calendar) => (
                    <option key={calendar.id} value={calendarOptionValue(calendar)}>
                      {calendar.summary}{calendar.primary ? " (primary)" : ""}
                    </option>
                  ))
                ) : (
                  <option value={calendarOptionValue({ id: integration.calendarId, summary: integration.calendarSummary || integration.calendarId })}>
                    {integration.calendarSummary || integration.calendarId}
                  </option>
                )}
              </select>
              {calendarOptionsError ? (
                <span className="block text-xs leading-5 text-brass">A naptárlista most nem tölthető be, de a mentett naptár továbbra is használható.</span>
              ) : null}
            </label>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="flex min-h-12 items-center gap-3 rounded-md bg-white px-3 text-sm text-graphite">
                <input name="syncMiniSessionBookings" type="checkbox" defaultChecked={integration.syncMiniSessionBookings} className="size-4 rounded border-ink/20" />
                Foglalások
              </label>
              <label className="flex min-h-12 items-center gap-3 rounded-md bg-white px-3 text-sm text-graphite">
                <input name="syncCustomerProjects" type="checkbox" defaultChecked={integration.syncCustomerProjects} className="size-4 rounded border-ink/20" />
                Projektek
              </label>
              <label className="flex min-h-12 items-center gap-3 rounded-md bg-white px-3 text-sm text-graphite">
                <input name="blockAvailabilityFromGoogleCalendar" type="checkbox" defaultChecked={integration.blockAvailabilityFromGoogleCalendar} className="size-4 rounded border-ink/20" />
                Google események blokkolnak
              </label>
              <label className="flex min-h-12 items-center gap-3 rounded-md bg-white px-3 text-sm text-graphite">
                <input name="deleteCancelledEvents" type="checkbox" defaultChecked={integration.deleteCancelledEvents} className="size-4 rounded border-ink/20" />
                Törlés Google-ból
              </label>
            </div>
            <p className="mt-3 rounded-md bg-white px-3 py-3 text-xs leading-5 text-graphite/65">
              A Google blokkolás csak akkor aktív, ha ezt külön bekapcsolod. Ha régebben kötötted össze a naptárat, nyomd meg az Újra összekötés gombot, hogy a free/busy jogosultság is meglegyen.
            </p>

            {integration.lastSyncError ? (
              <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-3 text-sm leading-6 text-red-700">
                Legutóbbi Google sync hiba: {integration.lastSyncError}
              </p>
            ) : null}

            <div className="mt-5 flex flex-col gap-3 border-t border-ink/10 pt-4 sm:flex-row sm:items-center">
              <FormSubmitButton pendingLabel="Mentés...">Google beállítások mentése</FormSubmitButton>
              <Link href="/api/google-calendar/connect" className="inline-flex h-10 items-center justify-center rounded-md border border-ink/10 px-4 text-sm font-medium text-ink transition hover:bg-ink/5">
                Újra összekötés
              </Link>
            </div>
          </form>

          <aside className="space-y-4">
            <div className="rounded-md border border-ink/10 bg-white p-4">
              <p className="text-sm font-semibold text-ink">Mit szinkronizál?</p>
              <div className="mt-3 space-y-2 text-sm leading-6 text-graphite/70">
                <p>Mini session és állandó fotózás foglalások: név, időpont, helyszín, elérhetőség.</p>
                <p>Ügyfélprojektek: projekt neve, ügyfél, dátum, időpont, helyszín.</p>
                <p>Bekapcsolt Google blokkolásnál a kiválasztott naptár foglalt eseményei nem lesznek foglalhatók a landing page-eken.</p>
              </div>
            </div>
            <form action={disconnectGoogleCalendarAction} className="rounded-md border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-700">Kapcsolat leválasztása</p>
              <p className="mt-2 text-sm leading-6 text-red-700/80">Az app nem hoz létre több Google naptár eseményt. A már létrehozott Google események nem törlődnek automatikusan.</p>
              <ConfirmSubmitButton variant="danger" className="mt-4" message="Biztosan leválasztod a Google naptár kapcsolatot?">
                Google kapcsolat leválasztása
              </ConfirmSubmitButton>
            </form>
          </aside>
        </div>
      )}
    </section>
  );
}

async function getServiceUsageSummary(): Promise<ServiceUsageSummary> {
  const monthStart = startOfCurrentMonth();
  const monthEnd = startOfNextMonth(monthStart);
  const monthRange = { gte: monthStart, lt: monthEnd };

  const [
    totalPhotographers,
    activePhotographers,
    totalCustomers,
    totalLeads,
    totalProjects,
    totalGalleries,
    totalPhotos,
    totalContracts,
    totalInvoices,
    totalFavorites,
    totalDownloads,
    totalDownloadPackages,
    totalViews,
    totalNotifications,
    photoStorage,
    albumSpreadStorage,
    contractStorage,
    invoiceStorage,
    downloadPackageStorage,
    uploadItemStorage,
    monthlyPhotos,
    monthlyAlbumSpreads,
    monthlyContracts,
    monthlyInvoices,
    monthlyDownloadPackages,
    monthlyDownloadPackageBytes,
    monthlyUploadItems,
    monthlyGalleryViews,
    monthlyDownloads,
    monthlyContractEmails,
    monthlyInvoiceEmails,
    monthlyProofingInviteEmails,
    monthlyFinalDeliveryEmails,
    monthlyDownloadReadyEmails,
    monthlyFavoriteListEmails,
    processingZipPackages,
    failedZipPackages,
    backgroundJobs,
    failedBackgroundJobs
  ] = await Promise.all([
    prisma.admin.count(),
    prisma.admin.count({ where: { status: "approved" } }),
    prisma.customer.count(),
    prisma.lead.count(),
    prisma.customerProject.count(),
    prisma.gallery.count(),
    prisma.photo.count(),
    prisma.contract.count(),
    prisma.customerInvoice.count(),
    prisma.galleryFavoriteList.count(),
    prisma.galleryDownload.count(),
    prisma.galleryDownloadPackage.count(),
    prisma.galleryView.count(),
    prisma.adminNotification.count(),
    prisma.photo.aggregate({ _sum: { fileSize: true } }),
    prisma.albumReviewSpread.aggregate({ _sum: { fileSize: true } }),
    prisma.contract.aggregate({ _sum: { fileSize: true } }),
    prisma.customerInvoice.aggregate({ _sum: { fileSize: true } }),
    prisma.galleryDownloadPackage.aggregate({ _sum: { fileSize: true } }),
    prisma.galleryUploadItem.aggregate({ _sum: { fileSize: true } }),
    prisma.photo.count({ where: { createdAt: monthRange } }),
    prisma.albumReviewSpread.count({ where: { createdAt: monthRange } }),
    prisma.contract.count({ where: { createdAt: monthRange } }),
    prisma.customerInvoice.count({ where: { createdAt: monthRange } }),
    prisma.galleryDownloadPackage.count({ where: { createdAt: monthRange } }),
    prisma.galleryDownloadPackage.aggregate({ where: { generatedAt: monthRange }, _sum: { fileSize: true } }),
    prisma.galleryUploadItem.count({ where: { createdAt: monthRange } }),
    prisma.galleryView.count({ where: { createdAt: monthRange } }),
    prisma.galleryDownload.count({ where: { createdAt: monthRange } }),
    prisma.contract.count({ where: { sentAt: monthRange } }),
    prisma.customerInvoice.count({ where: { sentAt: monthRange } }),
    prisma.gallery.count({ where: { proofingInviteSentAt: monthRange } }),
    prisma.gallery.count({ where: { finalDeliveryEmailSentAt: monthRange } }),
    prisma.galleryDownload.count({ where: { downloadLinkSentAt: monthRange } }),
    prisma.galleryFavoriteList.count({ where: { submittedAt: monthRange } }),
    prisma.galleryDownloadPackage.count({ where: { status: "processing" } }),
    prisma.galleryDownloadPackage.count({
      where: {
        status: "failed",
        NOT: {
          errorMessage: {
            startsWith: "Superseded by"
          }
        }
      }
    }),
    prisma.backgroundJob.count({ where: { createdAt: monthRange } }),
    prisma.backgroundJob.count({ where: { createdAt: monthRange, status: "failed" } })
  ]);

  const storageBytes =
    toBigInt(photoStorage._sum.fileSize) +
    toBigInt(albumSpreadStorage._sum.fileSize) +
    toBigInt(contractStorage._sum.fileSize) +
    toBigInt(invoiceStorage._sum.fileSize) +
    toBigInt(downloadPackageStorage._sum.fileSize) +
    toBigInt(uploadItemStorage._sum.fileSize);
  const monthlyZipBytes = toBigInt(monthlyDownloadPackageBytes._sum.fileSize);
  const monthlyStorageWrites =
    monthlyPhotos * 3 + monthlyAlbumSpreads + monthlyContracts + monthlyInvoices + monthlyDownloadPackages + monthlyUploadItems;
  const monthlyObjectReadsEstimate = monthlyGalleryViews * 40 + monthlyDownloads + monthlyDownloadReadyEmails;
  const r2Estimate = estimateR2Cost(storageBytes, monthlyStorageWrites, monthlyObjectReadsEstimate);
  const monthlyEmails =
    monthlyContractEmails +
    monthlyInvoiceEmails +
    monthlyProofingInviteEmails +
    monthlyFinalDeliveryEmails +
    monthlyDownloadReadyEmails +
    monthlyFavoriteListEmails +
    monthlyDownloadPackages;
  const resendEstimate = estimateResendCost(monthlyEmails);
  const openZipProblems = processingZipPackages + failedZipPackages + failedBackgroundJobs;
  const databaseRows =
    totalPhotographers +
    totalCustomers +
    totalLeads +
    totalProjects +
    totalGalleries +
    totalPhotos +
    totalContracts +
    totalInvoices +
    totalFavorites +
    totalDownloads +
    totalDownloadPackages +
    totalViews +
    totalNotifications;
  const storageGb = Number(storageBytes) / ONE_GB;
  const r2Tone: ProviderTone = storageGb >= R2_STORAGE_FREE_GB || r2Estimate > 0 ? "watch" : storageGb >= 8 ? "watch" : "ok";
  const resendTone: ProviderTone = monthlyEmails > RESEND_PRO_EMAILS ? "attention" : monthlyEmails > RESEND_FREE_EMAILS ? "watch" : "ok";
  const zipTone: ProviderTone = openZipProblems > 0 ? "attention" : monthlyDownloadPackages > 0 ? "watch" : "ok";
  const providers: ProviderUsageCard[] = [
    {
      name: "Cloudflare R2",
      status: r2Tone === "ok" ? "Free sávban" : "Figyelni",
      tone: r2Tone,
      primaryMetric: formatBytes(storageBytes),
      secondaryMetric: `${formatNumber(monthlyStorageWrites)} becsült írás · ${formatNumber(monthlyObjectReadsEstimate)} becsült olvasás ebben a hónapban`,
      estimatedUsd: r2Estimate,
      estimateNote: "R2 standard tárhely + becsült műveletek. A valódi Cloudflare analytics pontosabb."
    },
    {
      name: "Resend",
      status: resendTone === "ok" ? "Free sávban" : resendTone === "watch" ? "Pro küszöb" : "Magas volumen",
      tone: resendTone,
      primaryMetric: `${formatNumber(monthlyEmails)} email / hónap`,
      secondaryMetric: `${formatNumber(RESEND_FREE_EMAILS)} email free sáv · ${formatNumber(RESEND_PRO_EMAILS)} email Pro sáv`,
      estimatedUsd: resendEstimate,
      estimateNote: "App eseményekből becsült Resend hívások, nem Resend billing API."
    },
    {
      name: "Vercel",
      status: "Free sávban",
      tone: "ok",
      primaryMetric: `${formatNumber(monthlyGalleryViews)} publikus galérianézet`,
      secondaryMetric: "Jelenleg free csomagként vezetjük. Bandwidth és function usage csak Vercelben pontos.",
      estimatedUsd: VERCEL_FREE_MONTHLY_USD,
      estimateNote: "Nem számolunk fix Pro díjjal. Ha később fizetős csomagra váltunk, ezt külön állítjuk át."
    },
    {
      name: "Neon",
      status: "Free sávban",
      tone: "ok",
      primaryMetric: `${formatNumber(databaseRows)} app rekord`,
      secondaryMetric: `${formatNumber(totalPhotos)} fotó · ${formatNumber(totalViews)} galérianézet rekord · ${formatNumber(totalDownloadPackages)} ZIP rekord. DB méretet a Neon Console mér pontosan.`,
      estimatedUsd: NEON_FREE_MONTHLY_USD,
      estimateNote: "Nem számolunk fix Launch díjjal. Ha a Neon free limit közelébe érünk, azt külön provider-adatból érdemes jelezni."
    },
    {
      name: "Trigger.dev",
      status: zipTone === "attention" ? "Hiba van" : "ZIP workload",
      tone: zipTone,
      primaryMetric: `${formatNumber(monthlyDownloadPackages)} ZIP csomag / hónap`,
      secondaryMetric: `${formatBytes(monthlyZipBytes)} generált ZIP · ${formatNumber(backgroundJobs)} háttér job · ${formatNumber(openZipProblems)} nyitott gond`,
      estimatedUsd: TRIGGER_HOBBY_MONTHLY_USD,
      estimateNote: "Hobby alapbecslés. Futási időt és compute kreditet Trigger dashboard mér."
    },
    {
      name: "GitHub",
      status: "Rendben",
      tone: "ok",
      primaryMetric: "Forráskód és deploy trigger",
      secondaryMetric: "A végfelhasználói terhelés nem itt jelenik meg.",
      estimatedUsd: 0,
      estimateNote: "MVP-ben várhatóan nincs külön platformköltség."
    },
    {
      name: "Domain / DNS",
      status: "Manuális költség",
      tone: "ok",
      primaryMetric: "Saját domain + CDN domain",
      secondaryMetric: "A domain megújítás és fotós saját domainek később külön kezelendők.",
      estimatedUsd: 0,
      estimateNote: "DNS általában ingyenes, domain regisztrátor költsége manuális."
    }
  ];
  const estimatedMonthlyUsd = roundCost(providers.reduce((sum, provider) => sum + provider.estimatedUsd, 0));
  const attentionCount = providers.filter((provider) => provider.tone !== "ok").length;

  return {
    monthLabel: monthLabel(monthStart),
    estimatedMonthlyUsd,
    attentionCount,
    activePhotographers,
    totalPhotographers,
    totalCustomers,
    totalGalleries,
    totalPhotos,
    storageBytes,
    monthlyEmails,
    monthlyGalleryViews,
    monthlyZipPackages: monthlyDownloadPackages,
    monthlyZipBytes,
    openZipProblems,
    databaseRows,
    providers
  };
}

export default async function AdminSettingsPage({
  searchParams
}: {
  searchParams: Promise<{
    error?: string;
    saved?: string;
    tab?: string;
    disabled?: string;
    enabled?: string;
    google?: string;
  }>;
}) {
  const [admin, params] = await Promise.all([requireAdmin(), searchParams]);
  const isTeamWorkspace = admin.isTeamWorkspace;
  const workspaceAdminId = ownerAdminId(admin);
  const activeTab: SettingsTab =
    params.tab === "security"
      ? "security"
      : params.tab === "integrations" && !isTeamWorkspace
        ? "integrations"
      : params.tab === "providers" && admin.role === "super_admin"
        ? "providers"
        : params.tab === "brand" && !isTeamWorkspace
          ? "brand"
          : params.tab === "profile" || isTeamWorkspace
            ? "profile"
            : "brand";
  const [settings, photographerProfile, serviceUsage, googleIntegration] = await Promise.all([
    prisma.siteSettings.findFirst({
      where: {
        OR: [{ adminId: admin.id }, ...(admin.role === "super_admin" ? [{ id: "default" }] : [])]
      },
      select: {
        businessName: true,
        logoUrl: true,
        logoHeight: true,
        signatureUrl: true,
        websiteUrl: true,
        instagramUrl: true,
        facebookUrl: true,
        tiktokUrl: true,
        youtubeUrl: true,
        contactEmail: true,
        contactPhone: true
      }
    }),
    prisma.admin.findUniqueOrThrow({
      where: { id: admin.id },
      select: {
        name: true,
        email: true,
        legalName: true,
        birthDate: true,
        birthPlace: true,
        phone: true,
        addressLine: true,
        postalCode: true,
        city: true,
        country: true,
        taxNumber: true,
        businessRegistrationNumber: true,
        profileNotes: true
      }
    }),
    admin.role === "super_admin" ? getServiceUsageSummary() : Promise.resolve(null),
    !isTeamWorkspace
      ? prisma.googleCalendarIntegration.findUnique({
          where: { adminId: workspaceAdminId },
          select: {
            id: true,
            adminId: true,
            googleAccountEmail: true,
            calendarId: true,
            calendarSummary: true,
            accessTokenEncrypted: true,
            refreshTokenEncrypted: true,
            accessTokenExpiresAt: true,
            syncMiniSessionBookings: true,
            syncCustomerProjects: true,
            blockAvailabilityFromGoogleCalendar: true,
            deleteCancelledEvents: true,
            lastSyncError: true,
            connectedAt: true,
            updatedAt: true
          }
        })
      : Promise.resolve(null)
  ]);
  let googleCalendarOptions: GoogleCalendarOption[] = [];
  let googleCalendarOptionsError = false;

  if (googleIntegration) {
    try {
      googleCalendarOptions = await getGoogleCalendarOptionsForIntegration(googleIntegration);
    } catch (error) {
      googleCalendarOptionsError = true;
      console.error("Google calendar options load failed", error);
    }
  }

  const googleConfigured = isGoogleCalendarConfigured();
  const googleMissingConfigKeys = googleCalendarMissingConfigKeys();
  const settingsTabColumns = admin.role === "super_admin" ? "sm:grid-cols-5" : isTeamWorkspace ? "sm:grid-cols-2" : "sm:grid-cols-4";

  return (
    <AdminShell>
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.16em] text-graphite/60">Admin</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">Általános beállítások</h1>
        <p className="mt-3 max-w-2xl text-graphite/70">
          Márkaadatok, logó, elérhetőségek, biztonság és a platform külső szolgáltatói egy helyen.
        </p>
      </div>

      <div className="mb-6 rounded-md border border-ink/10 bg-white p-2">
        <nav className={`grid gap-2 ${settingsTabColumns}`} aria-label="Beállítások fülek">
          {!isTeamWorkspace ? (
            <Link
              href="/admin/settings?tab=brand"
              className={`flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition ${
                activeTab === "brand" ? "bg-ink text-white shadow-sm" : "text-graphite hover:bg-ink/5 hover:text-ink"
              }`}
            >
              <Globe2 size={16} />
              Márka
            </Link>
          ) : null}
          <Link
            href="/admin/settings?tab=profile"
            className={`flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition ${
              activeTab === "profile" ? "bg-ink text-white shadow-sm" : "text-graphite hover:bg-ink/5 hover:text-ink"
            }`}
          >
            <UserRound size={16} />
            Fotós adatok
          </Link>
          <Link
            href="/admin/settings?tab=security"
            className={`flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition ${
              activeTab === "security" ? "bg-ink text-white shadow-sm" : "text-graphite hover:bg-ink/5 hover:text-ink"
            }`}
          >
            <ShieldCheck size={16} />
            Biztonság
          </Link>
          {!isTeamWorkspace ? (
            <Link
              href="/admin/settings?tab=integrations"
              className={`flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition ${
                activeTab === "integrations" ? "bg-ink text-white shadow-sm" : "text-graphite hover:bg-ink/5 hover:text-ink"
              }`}
            >
              <CalendarDays size={16} />
              Integrációk
            </Link>
          ) : null}
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
        {params.error === "profile_required" ? (
          <Alert title="A fotós adatok mentése nem sikerült." variant="error">
            A név és az email megadása kötelező.
          </Alert>
        ) : null}
        {params.error === "profile_email" ? (
          <Alert title="Az email cím nem megfelelő." variant="error">
            Adj meg érvényes belépési email címet.
          </Alert>
        ) : null}
        {params.error === "profile_email_taken" ? (
          <Alert title="Ez az email cím már használatban van." variant="error">
            Válassz másik email címet ehhez a fotós fiókhoz.
          </Alert>
        ) : null}
        {params.google === "connected" ? <Alert title="Google naptár összekötve." variant="success" /> : null}
        {params.google === "saved" ? <Alert title="Google naptár beállítások mentve." variant="success" /> : null}
        {params.google === "disconnected" ? <Alert title="Google naptár kapcsolat leválasztva." variant="success" /> : null}
        {params.google === "missing-config" ? <Alert title="A Google OAuth nincs konfigurálva." variant="error">Add meg a szükséges Vercel env változókat.</Alert> : null}
        {params.google === "state-error" ? <Alert title="A Google összekötés biztonsági ellenőrzése lejárt." variant="error">Indítsd el újra az összekötést.</Alert> : null}
        {params.google === "no-refresh-token" ? <Alert title="A Google nem adott hosszú távú hozzáférést." variant="error">Indítsd újra az összekötést, és engedélyezd a naptár hozzáférést.</Alert> : null}
        {params.google === "oauth-error" || params.google === "callback-error" ? <Alert title="A Google naptár összekötése nem sikerült." variant="error">Próbáld újra pár perc múlva.</Alert> : null}
      </div>

      {activeTab === "brand" && !isTeamWorkspace ? <SiteSettingsForm adminName={admin.name} settings={settings ?? emptySettings} /> : null}

      {activeTab === "profile" ? <PhotographerProfileSettings profile={photographerProfile} /> : null}

      {activeTab === "security" ? <AdminSecuritySettings enabled={params.enabled} disabled={params.disabled} error={params.error} /> : null}

      {activeTab === "integrations" ? (
        <GoogleCalendarSettings
          configured={googleConfigured}
          missingConfigKeys={googleMissingConfigKeys}
          integration={googleIntegration ? {
            googleAccountEmail: googleIntegration.googleAccountEmail,
            calendarId: googleIntegration.calendarId,
            calendarSummary: googleIntegration.calendarSummary,
            syncMiniSessionBookings: googleIntegration.syncMiniSessionBookings,
            syncCustomerProjects: googleIntegration.syncCustomerProjects,
            blockAvailabilityFromGoogleCalendar: googleIntegration.blockAvailabilityFromGoogleCalendar,
            deleteCancelledEvents: googleIntegration.deleteCancelledEvents,
            lastSyncError: googleIntegration.lastSyncError,
            connectedAt: googleIntegration.connectedAt,
            updatedAt: googleIntegration.updatedAt
          } : null}
          calendarOptions={googleCalendarOptions}
          calendarOptionsError={googleCalendarOptionsError}
        />
      ) : null}

      {activeTab === "providers" ? (
        <div className="space-y-6">
          {serviceUsage ? (
            <>
              <section className="rounded-md border border-brass/20 bg-white p-5 shadow-[0_1px_0_rgba(178,139,78,0.08)]">
                <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-brass">
                      <Activity size={15} />
                      Szuperadmin
                    </div>
                    <h2 className="mt-2 text-xl font-semibold text-ink">Szolgáltatás és költségfigyelő</h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-graphite/70">
                      {serviceUsage.monthLabel} használati összefoglaló. Amit az appból tudunk, azt automatikusan számoljuk; a Vercel, Neon és Trigger pontos számláját továbbra is a provider dashboard mutatja.
                    </p>
                  </div>
                  <div className="rounded-md border border-brass/20 bg-brass/[0.06] px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-brass">Becsült havi költség</p>
                    <p className="mt-1 text-3xl font-semibold text-ink">{formatUsd(serviceUsage.estimatedMonthlyUsd)}</p>
                    <p className="mt-1 text-xs text-graphite/65">Provider alapdíjak + appból becsült használat</p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  {[
                    {
                      label: "Fotósok",
                      value: `${formatNumber(serviceUsage.activePhotographers)} / ${formatNumber(serviceUsage.totalPhotographers)}`,
                      detail: "aktív / összes",
                      icon: UserRound
                    },
                    {
                      label: "R2 tárhely",
                      value: formatBytes(serviceUsage.storageBytes),
                      detail: "adatbázisból ismert fájlméret",
                      icon: HardDrive
                    },
                    {
                      label: "Email",
                      value: formatNumber(serviceUsage.monthlyEmails),
                      detail: "becsült havi Resend hívás",
                      icon: Mail
                    },
                    {
                      label: "ZIP workload",
                      value: formatNumber(serviceUsage.monthlyZipPackages),
                      detail: `${formatBytes(serviceUsage.monthlyZipBytes)} ebben a hónapban`,
                      icon: Layers
                    },
                    {
                      label: "Figyelmet kér",
                      value: formatNumber(serviceUsage.attentionCount),
                      detail: `${formatNumber(serviceUsage.openZipProblems)} nyitott ZIP/job gond`,
                      icon: TrendingUp
                    }
                  ].map((stat) => {
                    const Icon = stat.icon;

                    return (
                      <div key={stat.label} className="rounded-md border border-ink/10 bg-paper/70 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-graphite/60">{stat.label}</p>
                          <Icon size={16} className="text-brass" />
                        </div>
                        <p className="mt-2 text-2xl font-semibold text-ink">{stat.value}</p>
                        <p className="mt-1 text-xs text-graphite/65">{stat.detail}</p>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-md border border-ink/10 bg-white p-5">
                <div className="flex flex-col justify-between gap-3 border-b border-ink/10 pb-4 md:flex-row md:items-start">
                  <div>
                    <h2 className="text-base font-semibold text-ink">Platform méret</h2>
                    <p className="mt-1 text-sm text-graphite/70">Ezekből látod, merre nő a rendszer: fotósok, ügyfelek, galériák, DB rekordok.</p>
                  </div>
                  <span className="w-fit rounded-full bg-ink/5 px-3 py-1 text-xs font-medium text-graphite">
                    {formatNumber(serviceUsage.databaseRows)} app rekord
                  </span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    { label: "Ügyfelek", value: serviceUsage.totalCustomers },
                    { label: "Galériák", value: serviceUsage.totalGalleries },
                    { label: "Fotók", value: serviceUsage.totalPhotos },
                    { label: "Publikus nézetek ebben a hónapban", value: serviceUsage.monthlyGalleryViews }
                  ].map((item) => (
                    <div key={item.label} className="rounded-md bg-paper px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.14em] text-graphite/55">{item.label}</p>
                      <p className="mt-1 text-xl font-semibold text-ink">{formatNumber(item.value)}</p>
                    </div>
                  ))}
                </div>
              </section>
            </>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            {providerLinks.map((provider) => {
              const Icon = provider.icon;
              const usage = serviceUsage?.providers.find((item) => item.name === provider.name);

              return (
                <section key={provider.name} className={`rounded-md border bg-white p-5 ${providerCardClass(usage?.tone ?? "ok")}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-paper text-graphite">
                        <Icon size={18} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold text-ink">{provider.name}</h3>
                        <p className="mt-1 text-sm text-graphite/70">{provider.description}</p>
                      </div>
                    </div>
                    {usage ? (
                      <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${toneClass(usage.tone)}`}>
                        {usage.status}
                      </span>
                    ) : null}
                  </div>
                  {usage ? (
                    <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                      <div className="rounded-md bg-paper px-3 py-3">
                        <p className="text-xs uppercase tracking-[0.14em] text-graphite/55">Használat</p>
                        <p className="mt-1 text-lg font-semibold text-ink">{usage.primaryMetric}</p>
                        <p className="mt-1 text-xs leading-5 text-graphite/65">{usage.secondaryMetric}</p>
                      </div>
                      <div className="rounded-md bg-ink px-3 py-3 text-white sm:min-w-32">
                        <p className="text-xs uppercase tracking-[0.14em] text-white/65">Becslés</p>
                        <p className="mt-1 text-lg font-semibold">{formatUsd(usage.estimatedUsd)}</p>
                      </div>
                    </div>
                  ) : null}
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
                  <div className="mt-4 grid gap-2">
                    <p className="rounded-md bg-paper px-3 py-2 text-sm text-graphite/75">{provider.costHint}</p>
                    {usage ? (
                      <p className="rounded-md border border-ink/10 bg-white px-3 py-2 text-sm text-graphite/70">
                        <span className="font-medium text-ink">Becslés alapja:</span> {usage.estimateNote}
                      </p>
                    ) : null}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      ) : null}
    </AdminShell>
  );
}
