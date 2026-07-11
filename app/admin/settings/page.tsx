import Link from "next/link";
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Cloud,
  CreditCard,
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
import { dateLocaleForAdmin, getAdminLanguage, type AdminLanguage } from "@/lib/admin-language";
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
import { isStripeConnectConfigured, stripeConnectMissingConfigKeys } from "@/lib/stripe-connect";

type SettingsTab = "brand" | "profile" | "integrations" | "providers" | "security" | "logs";

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
  publicSubdomain: null,
  logoUrl: null,
  logoHeight: 80,
  signatureUrl: null,
  websiteUrl: null,
  instagramUrl: null,
  facebookUrl: null,
  tiktokUrl: null,
  youtubeUrl: null,
  contactEmail: null,
  contactPhone: null,
  galleryWatermarkEnabled: false,
  galleryWatermarkText: null,
  galleryWatermarkPosition: "center",
  galleryWatermarkOpacity: 32
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

type WorkspaceGalleryStats = {
  galleryCount: number;
  activeGalleryCount: number;
  mediaCount: number;
  storageBytes: bigint;
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

type StripeConnectIntegrationSettings = {
  stripeAccountId: string;
  stripeAccountEmail: string | null;
  country: string | null;
  defaultCurrency: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  onboardingCompletedAt: Date | null;
  lastSyncError: string | null;
  connectedAt: Date;
  updatedAt: Date;
};

const SETTINGS_COPY = {
  hu: {
    area: "Admin",
    title: "Általános beállítások",
    intro: "Márkaadatok, logó, elérhetőségek, biztonság és a platform külső szolgáltatói egy helyen.",
    tabs: {
      brand: "Márka",
      profile: "Fotós adatok",
      security: "Biztonság",
      integrations: "Integrációk",
      providers: "Szolgáltatók",
      logs: "Napló"
    },
    navLabel: "Beállítások fülek",
    alerts: {
      saved: "Beállítások mentve.",
      logoTitle: "A logó feltöltése nem sikerült.",
      logoBody: "Csak képfájlt tölts fel logóként.",
      signatureTitle: "Az aláírás feltöltése nem sikerült.",
      signatureBody: "PNG képfájlt tölts fel aláírásként.",
      profileRequiredTitle: "A fotós adatok mentése nem sikerült.",
      profileRequiredBody: "A név és az email megadása kötelező.",
      profileEmailTitle: "Az email cím nem megfelelő.",
      profileEmailBody: "Adj meg érvényes belépési email címet.",
      profileEmailTakenTitle: "Ez az email cím már használatban van.",
      profileEmailTakenBody: "Válassz másik email címet ehhez a fotós fiókhoz.",
      publicSubdomainTitle: "Ez a Spetly publikus név nem használható.",
      publicSubdomainBody: "Legalább 3 karakteres, egyedi nevet adj meg. A rendszernevek, mint www vagy admin, foglaltak.",
      publicSubdomainTakenTitle: "Ez a Spetly publikus név már foglalt.",
      publicSubdomainTakenBody: "Válassz másik nevet a spetly.app elé.",
      googleConnected: "Google naptár összekötve.",
      googleSaved: "Google naptár beállítások mentve.",
      googleDisconnected: "Google naptár kapcsolat leválasztva.",
      googleMissingConfigTitle: "A Google OAuth nincs konfigurálva.",
      googleMissingConfigBody: "Add meg a szükséges Vercel env változókat.",
      googleStateTitle: "A Google összekötés biztonsági ellenőrzése lejárt.",
      googleStateBody: "Indítsd el újra az összekötést.",
      googleRefreshTitle: "A Google nem adott hosszú távú hozzáférést.",
      googleRefreshBody: "Indítsd újra az összekötést, és engedélyezd a naptár hozzáférést.",
      googleErrorTitle: "A Google naptár összekötése nem sikerült.",
      googleErrorBody: "Próbáld újra pár perc múlva."
    },
    google: {
      eyebrow: "Google naptár",
      title: "Automatikus naptár szinkron",
      description: "Ha össze van kötve, az ügyfélfoglalások és a dátummal rendelkező projektek automatikusan bekerülhetnek a kiválasztott Google naptárba. Külön kapcsolóval azt is beállíthatod, hogy a Google naptár foglalt eseményei blokkolják a foglalható idősávokat.",
      connected: "Összekötve",
      disconnected: "Nincs összekötve",
      missingConfigTitle: "A Google OAuth még nincs konfigurálva.",
      missingConfigDetail: (keys: string) => `Vercelen add meg ezeket az env változókat: ${keys}.`,
      permissionTitle: "Mire használja a Spetly a Google Calendar hozzáférést?",
      permissionDescription: "Kizárólag foglalások és dátummal rendelkező projektek naptárszinkronjára, a célnaptár kiválasztására, valamint - ha külön bekapcsolod - a foglalt idősávok ellenőrzésére. A kapcsolat bármikor leválasztható ezen az oldalon.",
      connectInfo: "Az összekötés Google belépést nyit. A rendszer csak naptáreseményeket hoz létre/módosít, és a naptárlistát olvassa a kiválasztáshoz.",
      connectButton: "Google naptár összekötése",
      account: "Google fiók",
      connectedAt: "Kapcsolódva",
      targetCalendar: "Célnaptár",
      primarySuffix: "primary",
      calendarListError: "A naptárlista most nem tölthető be, de a mentett naptár továbbra is használható.",
      syncBookings: "Foglalások",
      syncProjects: "Projektek",
      blockAvailability: "Google események blokkolnak",
      deleteCancelledEvents: "Törlés Google-ból",
      freeBusyHint: "A Google blokkolás csak akkor aktív, ha ezt külön bekapcsolod. Ha régebben kötötted össze a naptárat, nyomd meg az Újra összekötés gombot, hogy a free/busy jogosultság is meglegyen.",
      lastSyncError: "Legutóbbi Google sync hiba:",
      save: "Google beállítások mentése",
      saving: "Mentés...",
      reconnect: "Újra összekötés",
      syncTitle: "Mit szinkronizál?",
      syncBookingsDetail: "Mini session és állandó fotózás foglalások: név, időpont, helyszín, elérhetőség.",
      syncProjectsDetail: "Ügyfélprojektek: projekt neve, ügyfél, dátum, időpont, helyszín.",
      syncBlockingDetail: "Bekapcsolt Google blokkolásnál a kiválasztott naptár foglalt eseményei nem lesznek foglalhatók a landing page-eken.",
      disconnectTitle: "Kapcsolat leválasztása",
      disconnectDescription: "Az app nem hoz létre több Google naptár eseményt. A már létrehozott Google események nem törlődnek automatikusan.",
      disconnectConfirm: "Biztosan leválasztod a Google naptár kapcsolatot?",
      disconnectButton: "Google kapcsolat leválasztása",
      noData: "Nincs adat"
    },
    logs: {
      eyebrow: "Szuperadmin",
      title: "Rendszernapló",
      description: "A legutóbbi platformszintű események egy helyen: foglalások, Google szinkronok, email hibák és admin műveletek.",
      latest: "Legutóbbi 100 esemény",
      emptyTitle: "Még nincs naplózott esemény",
      emptyBody: "Ahogy történnek foglalások, szinkronok vagy hibák, itt jelennek meg.",
      actor: "Műveletet végző",
      target: "Érintett fotós",
      source: "Forrás",
      type: "Típus",
      metadata: "Részletek",
      open: "Megnyitás",
      noActor: "Publikus / rendszer",
      noTarget: "Nincs megadva"
    }
  },
  de: {
    area: "Admin",
    title: "Allgemeine Einstellungen",
    intro: "Markendaten, Logo, Kontaktinformationen, Sicherheit und externe Plattformdienste an einem Ort.",
    tabs: {
      brand: "Marke",
      profile: "Fotografendaten",
      security: "Sicherheit",
      integrations: "Integrationen",
      providers: "Dienste",
      logs: "Protokoll"
    },
    navLabel: "Einstellungsbereiche",
    alerts: {
      saved: "Einstellungen gespeichert.",
      logoTitle: "Das Logo konnte nicht hochgeladen werden.",
      logoBody: "Bitte lade nur Bilddateien als Logo hoch.",
      signatureTitle: "Die Signatur konnte nicht hochgeladen werden.",
      signatureBody: "Bitte lade eine PNG-Datei als Signatur hoch.",
      profileRequiredTitle: "Die Fotografendaten konnten nicht gespeichert werden.",
      profileRequiredBody: "Name und E-Mail sind erforderlich.",
      profileEmailTitle: "Die E-Mail-Adresse ist ungültig.",
      profileEmailBody: "Bitte gib eine gültige Login-E-Mail-Adresse ein.",
      profileEmailTakenTitle: "Diese E-Mail-Adresse wird bereits verwendet.",
      profileEmailTakenBody: "Wähle eine andere E-Mail-Adresse für dieses Fotografenkonto.",
      publicSubdomainTitle: "Dieser öffentliche Spetly-Name kann nicht verwendet werden.",
      publicSubdomainBody: "Bitte verwende einen eindeutigen Namen mit mindestens 3 Zeichen. Systemnamen wie www oder admin sind reserviert.",
      publicSubdomainTakenTitle: "Dieser öffentliche Spetly-Name ist bereits vergeben.",
      publicSubdomainTakenBody: "Wähle einen anderen Namen vor spetly.app.",
      googleConnected: "Google Kalender verbunden.",
      googleSaved: "Google Kalender-Einstellungen gespeichert.",
      googleDisconnected: "Google Kalender-Verbindung getrennt.",
      googleMissingConfigTitle: "Google OAuth ist nicht konfiguriert.",
      googleMissingConfigBody: "Bitte füge die erforderlichen Vercel-Umgebungsvariablen hinzu.",
      googleStateTitle: "Die Sicherheitsprüfung der Google-Verbindung ist abgelaufen.",
      googleStateBody: "Starte die Verbindung erneut.",
      googleRefreshTitle: "Google hat keinen langfristigen Zugriff bereitgestellt.",
      googleRefreshBody: "Verbinde erneut und erlaube den Kalenderzugriff.",
      googleErrorTitle: "Google Kalender konnte nicht verbunden werden.",
      googleErrorBody: "Bitte versuche es in ein paar Minuten erneut."
    },
    google: {
      eyebrow: "Google Kalender",
      title: "Automatische Kalendersynchronisierung",
      description: "Wenn verbunden, können Kundenbuchungen und datierte Projekte automatisch in den ausgewählten Google Kalender eingetragen werden. Optional können belegte Google Kalender-Ereignisse buchbare Zeitfenster blockieren.",
      connected: "Verbunden",
      disconnected: "Nicht verbunden",
      missingConfigTitle: "Google OAuth ist noch nicht konfiguriert.",
      missingConfigDetail: (keys: string) => `Füge diese Vercel-Umgebungsvariablen hinzu: ${keys}.`,
      permissionTitle: "Wofür verwendet Spetly den Google Calendar-Zugriff?",
      permissionDescription: "Nur für die Kalendersynchronisierung von Buchungen und datierten Projekten, zur Auswahl des Zielkalenders und - wenn du es aktivierst - zur Prüfung belegter Zeitfenster. Die Verbindung kann jederzeit auf dieser Seite getrennt werden.",
      connectInfo: "Die Verbindung öffnet den Google Login. Spetly erstellt oder aktualisiert nur Kalenderereignisse und liest die Kalenderliste zur Auswahl des Zielkalenders.",
      connectButton: "Google Kalender verbinden",
      account: "Google-Konto",
      connectedAt: "Verbunden seit",
      targetCalendar: "Zielkalender",
      primarySuffix: "primary",
      calendarListError: "Die Kalenderliste kann gerade nicht geladen werden, der gespeicherte Kalender bleibt nutzbar.",
      syncBookings: "Buchungen",
      syncProjects: "Projekte",
      blockAvailability: "Google-Ereignisse blockieren",
      deleteCancelledEvents: "Aus Google löschen",
      freeBusyHint: "Google-Blockierung ist nur aktiv, wenn du sie einschaltest. Wenn du den Kalender früher verbunden hast, nutze Erneut verbinden, damit die free/busy-Berechtigung vorhanden ist.",
      lastSyncError: "Letzter Google Sync-Fehler:",
      save: "Google-Einstellungen speichern",
      saving: "Speichern...",
      reconnect: "Erneut verbinden",
      syncTitle: "Was wird synchronisiert?",
      syncBookingsDetail: "Mini-Session- und laufend buchbare Termine: Name, Uhrzeit, Ort und Kontakt.",
      syncProjectsDetail: "Kundenprojekte: Projektname, Kunde, Datum, Uhrzeit und Ort.",
      syncBlockingDetail: "Wenn Google-Blockierung aktiv ist, sind belegte Ereignisse im ausgewählten Kalender auf Landingpages nicht buchbar.",
      disconnectTitle: "Verbindung trennen",
      disconnectDescription: "Die App erstellt keine weiteren Google Kalender-Ereignisse. Bereits erstellte Google-Ereignisse werden nicht automatisch gelöscht.",
      disconnectConfirm: "Google Kalender-Verbindung wirklich trennen?",
      disconnectButton: "Google-Verbindung trennen",
      noData: "Keine Daten"
    },
    logs: {
      eyebrow: "Superadmin",
      title: "Systemprotokoll",
      description: "Die neuesten plattformweiten Ereignisse: Buchungen, Google-Synchronisierungen, E-Mail-Fehler und Admin-Aktionen.",
      latest: "Letzte 100 Ereignisse",
      emptyTitle: "Noch keine protokollierten Ereignisse",
      emptyBody: "Sobald Buchungen, Synchronisierungen oder Fehler auftreten, erscheinen sie hier.",
      actor: "Ausgeführt von",
      target: "Betroffener Fotograf",
      source: "Quelle",
      type: "Typ",
      metadata: "Details",
      open: "Öffnen",
      noActor: "Öffentlich / System",
      noTarget: "Nicht angegeben"
    }
  },
  en: {
    area: "Admin",
    title: "General settings",
    intro: "Brand details, logo, contact information, security and external platform services in one place.",
    tabs: {
      brand: "Brand",
      profile: "Photographer details",
      security: "Security",
      integrations: "Integrations",
      providers: "Providers",
      logs: "Logs"
    },
    navLabel: "Settings tabs",
    alerts: {
      saved: "Settings saved.",
      logoTitle: "Logo upload failed.",
      logoBody: "Upload an image file as the logo.",
      signatureTitle: "Signature upload failed.",
      signatureBody: "Upload a PNG file as the signature.",
      profileRequiredTitle: "Photographer details could not be saved.",
      profileRequiredBody: "Name and e-mail are required.",
      profileEmailTitle: "The e-mail address is invalid.",
      profileEmailBody: "Enter a valid login e-mail address.",
      profileEmailTakenTitle: "This e-mail address is already in use.",
      profileEmailTakenBody: "Choose another e-mail address for this photographer account.",
      publicSubdomainTitle: "This public Spetly name cannot be used.",
      publicSubdomainBody: "Use a unique name with at least 3 characters. System names like www or admin are reserved.",
      publicSubdomainTakenTitle: "This public Spetly name is already taken.",
      publicSubdomainTakenBody: "Choose another name before spetly.app.",
      googleConnected: "Google Calendar connected.",
      googleSaved: "Google Calendar settings saved.",
      googleDisconnected: "Google Calendar disconnected.",
      googleMissingConfigTitle: "Google OAuth is not configured.",
      googleMissingConfigBody: "Add the required Vercel environment variables.",
      googleStateTitle: "The Google connection security check expired.",
      googleStateBody: "Start the connection again.",
      googleRefreshTitle: "Google did not provide long-term access.",
      googleRefreshBody: "Reconnect and allow calendar access.",
      googleErrorTitle: "Google Calendar could not be connected.",
      googleErrorBody: "Try again in a few minutes."
    },
    google: {
      eyebrow: "Google Calendar",
      title: "Automatic calendar sync",
      description: "When connected, client bookings and dated projects can be added automatically to the selected Google Calendar. You can also enable Google Calendar busy events to block bookable time slots.",
      connected: "Connected",
      disconnected: "Not connected",
      missingConfigTitle: "Google OAuth is not configured yet.",
      missingConfigDetail: (keys: string) => `Add these Vercel environment variables: ${keys}.`,
      permissionTitle: "How does Spetly use Google Calendar access?",
      permissionDescription: "Only for calendar sync of bookings and dated projects, selecting the target calendar, and - if you enable it - checking busy time slots. You can disconnect the integration from this page at any time.",
      connectInfo: "Connecting opens the Google sign-in flow. Spetly only creates or updates calendar events and reads the calendar list so you can choose the target calendar.",
      connectButton: "Connect Google Calendar",
      account: "Google account",
      connectedAt: "Connected at",
      targetCalendar: "Target calendar",
      primarySuffix: "primary",
      calendarListError: "The calendar list cannot be loaded right now, but the saved calendar can still be used.",
      syncBookings: "Bookings",
      syncProjects: "Projects",
      blockAvailability: "Google events block availability",
      deleteCancelledEvents: "Delete from Google",
      freeBusyHint: "Google availability blocking is active only when you enable it. If you connected the calendar earlier, use Reconnect so the free/busy permission is granted.",
      lastSyncError: "Latest Google sync error:",
      save: "Save Google settings",
      saving: "Saving...",
      reconnect: "Reconnect",
      syncTitle: "What is synchronized?",
      syncBookingsDetail: "Mini session and always-bookable appointments: name, time, location and contact details.",
      syncProjectsDetail: "Client projects: project name, client, date, time and location.",
      syncBlockingDetail: "When Google blocking is enabled, busy events in the selected calendar are not bookable on landing pages.",
      disconnectTitle: "Disconnect integration",
      disconnectDescription: "The app will stop creating Google Calendar events. Existing Google events are not deleted automatically.",
      disconnectConfirm: "Are you sure you want to disconnect Google Calendar?",
      disconnectButton: "Disconnect Google Calendar",
      noData: "No data"
    },
    logs: {
      eyebrow: "Super admin",
      title: "System log",
      description: "Recent platform-level events in one place: bookings, Google syncs, e-mail failures and admin actions.",
      latest: "Latest 100 events",
      emptyTitle: "No logged events yet",
      emptyBody: "Bookings, syncs and failures will appear here as they happen.",
      actor: "Actor",
      target: "Affected photographer",
      source: "Source",
      type: "Type",
      metadata: "Details",
      open: "Open",
      noActor: "Public / system",
      noTarget: "Not specified"
    }
  }
} as const;

function formatSettingsDateTime(date: Date | null | undefined, language: AdminLanguage, fallback: string) {
  if (!date) {
    return fallback;
  }

  return date.toLocaleString(dateLocaleForAdmin(language), {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIME_ZONE
  });
}

type SettingsSystemEvent = {
  id: string;
  actorAdmin: { name: string; email: string } | null;
  targetAdmin: { name: string; email: string } | null;
  type: string;
  title: string;
  message: string | null;
  severity: string;
  status: string;
  source: string | null;
  href: string | null;
  metadata: unknown;
  createdAt: Date;
};

type SettingsDeliveryLog = {
  id: string;
  channel: string;
  type: string;
  status: string;
  recipient: string | null;
  subject: string | null;
  lastError: string | null;
  sentAt: Date | null;
  nextAttemptAt: Date | null;
  createdAt: Date;
};

const DELIVERY_PANEL_COPY = {
  hu: {
    eyebrow: "Kézbesítések",
    title: "E-mail és Google Calendar megbízhatóság",
    description: "A legutóbbi elakadt vagy várakozó kézbesítések az aktuális workspace-ben.",
    emptyTitle: "Nincs elakadt kézbesítés",
    emptyBody: "Ha egy e-mail vagy Google Calendar sync hibázik, itt fog megjelenni.",
    recipient: "Címzett",
    updated: "Frissítve",
    nextRetry: "Következő retry",
    error: "Hiba"
  },
  de: {
    eyebrow: "Zustellung",
    title: "E-Mail- und Google-Calendar-Zuverlässigkeit",
    description: "Die neuesten blockierten oder wartenden Zustellungen im aktuellen Workspace.",
    emptyTitle: "Keine blockierten Zustellungen",
    emptyBody: "Wenn eine E-Mail oder ein Google-Calendar-Sync fehlschlägt, erscheint es hier.",
    recipient: "Empfänger",
    updated: "Aktualisiert",
    nextRetry: "Nächster Retry",
    error: "Fehler"
  },
  en: {
    eyebrow: "Delivery",
    title: "E-mail and Google Calendar reliability",
    description: "Recent failed, retrying or pending deliveries in the current workspace.",
    emptyTitle: "No stuck deliveries",
    emptyBody: "Failed e-mails or Google Calendar sync attempts will appear here.",
    recipient: "Recipient",
    updated: "Updated",
    nextRetry: "Next retry",
    error: "Error"
  }
} as const;

const WORKSPACE_STATS_COPY = {
  hu: {
    eyebrow: "Workspace",
    title: "Galéria statisztika",
    description: "Háttérszámok a fotós fiókhoz tartozó galériákról, médiákról és R2 tárhelyről.",
    openStorage: "R2 tárhely megnyitása",
    stats: {
      galleries: ["Galériák", "Összes létrehozott galéria"],
      active: ["Aktív", "Publikusan elérhető galériák"],
      media: ["Médiák", "Adatbázisban rögzített képek és videók"],
      storage: ["R2 tárhely", "Feltöltött médiák összmérete"]
    }
  },
  de: {
    eyebrow: "Workspace",
    title: "Galerie-Statistik",
    description: "Hintergrundzahlen zu Galerien, Medien und R2-Speicher dieses Fotografen-Accounts.",
    openStorage: "R2-Speicher öffnen",
    stats: {
      galleries: ["Galerien", "Alle angelegten Galerien"],
      active: ["Aktiv", "Öffentlich erreichbare Galerien"],
      media: ["Medien", "Bilder und Videos in der Datenbank"],
      storage: ["R2 Speicher", "Gesamtgröße der hochgeladenen Medien"]
    }
  },
  en: {
    eyebrow: "Workspace",
    title: "Gallery statistics",
    description: "Background numbers for this photographer account: galleries, media and R2 storage.",
    openStorage: "Open R2 storage",
    stats: {
      galleries: ["Galleries", "All created galleries"],
      active: ["Active", "Publicly available galleries"],
      media: ["Media", "Images and videos recorded in the database"],
      storage: ["R2 storage", "Total uploaded media size"]
    }
  }
} as const;

function deliveryStatusLabel(status: string, language: AdminLanguage) {
  const labels = {
    hu: {
      pending: "Függőben",
      sent: "Elküldve",
      failed: "Hiba",
      retry: "Retry",
      skipped: "Kihagyva"
    },
    de: {
      pending: "Ausstehend",
      sent: "Gesendet",
      failed: "Fehler",
      retry: "Retry",
      skipped: "Übersprungen"
    },
    en: {
      pending: "Pending",
      sent: "Sent",
      failed: "Failed",
      retry: "Retry",
      skipped: "Skipped"
    }
  } as const;

  return labels[language][status as keyof (typeof labels)[AdminLanguage]] ?? status;
}

function deliveryStatusClass(status: string) {
  if (status === "failed") {
    return "bg-red-50 text-red-700 ring-red-200";
  }

  if (status === "retry") {
    return "bg-brass/10 text-brass ring-brass/25";
  }

  if (status === "pending") {
    return "bg-ink/[0.05] text-graphite ring-ink/10";
  }

  if (status === "sent") {
    return "bg-sage/10 text-sage ring-sage/20";
  }

  return "bg-ink/[0.05] text-graphite/70 ring-ink/10";
}

const SYSTEM_EVENT_STATUS_LABELS = {
  hu: {
    started: "Elindult",
    success: "Sikeres",
    failed: "Hiba",
    skipped: "Kihagyva",
    warning: "Figyelmeztetés"
  },
  de: {
    started: "Gestartet",
    success: "Erfolgreich",
    failed: "Fehler",
    skipped: "Übersprungen",
    warning: "Warnung"
  },
  en: {
    started: "Started",
    success: "Successful",
    failed: "Failed",
    skipped: "Skipped",
    warning: "Warning"
  }
} as const;

function systemEventStatusLabel(status: string, language: AdminLanguage) {
  const labels = SYSTEM_EVENT_STATUS_LABELS[language];
  return labels[status as keyof typeof labels] ?? status;
}

function systemEventBadgeClass(event: { severity: string; status: string }) {
  if (event.severity === "error" || event.status === "failed") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (event.severity === "warning" || event.status === "warning") {
    return "border-brass/25 bg-brass/10 text-brass";
  }

  if (event.severity === "success" || event.status === "success") {
    return "border-sage/25 bg-sage/10 text-sage";
  }

  return "border-ink/10 bg-ink/5 text-graphite";
}

function adminIdentity(admin: { name: string; email: string } | null, fallback: string) {
  return admin ? `${admin.name} · ${admin.email}` : fallback;
}

function metadataText(metadata: unknown) {
  if (!metadata) {
    return "";
  }

  try {
    return JSON.stringify(metadata, null, 2);
  } catch {
    return String(metadata);
  }
}

function SystemEventLog({ events, language }: { events: SettingsSystemEvent[]; language: AdminLanguage }) {
  const copy = SETTINGS_COPY[language].logs;

  return (
    <section className="rounded-md border border-ink/10 bg-white p-5 shadow-soft sm:p-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-brass">
            <ClipboardList size={15} />
            {copy.eyebrow}
          </div>
          <h2 className="mt-2 text-xl font-semibold text-ink">{copy.title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-graphite/70">{copy.description}</p>
        </div>
        <span className="inline-flex w-fit rounded-full bg-ink/5 px-3 py-1 text-xs font-medium text-graphite">
          {copy.latest}
        </span>
      </div>

      {events.length === 0 ? (
        <div className="mt-6 rounded-md border border-dashed border-ink/15 bg-paper px-5 py-8 text-center">
          <p className="text-sm font-semibold text-ink">{copy.emptyTitle}</p>
          <p className="mt-2 text-sm text-graphite/65">{copy.emptyBody}</p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {events.map((event) => {
            const details = metadataText(event.metadata);

            return (
              <article key={event.id} className="rounded-md border border-ink/10 bg-paper p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${systemEventBadgeClass(event)}`}>
                        {systemEventStatusLabel(event.status, language)}
                      </span>
                      {event.source ? (
                        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-graphite ring-1 ring-ink/10">
                          {event.source}
                        </span>
                      ) : null}
                    </div>
                    <h3 className="mt-3 text-base font-semibold text-ink">{event.title}</h3>
                    {event.message ? <p className="mt-1 text-sm leading-6 text-graphite/70">{event.message}</p> : null}
                  </div>
                  <time className="shrink-0 text-sm text-graphite/60" dateTime={event.createdAt.toISOString()}>
                    {formatSettingsDateTime(event.createdAt, language, "-")}
                  </time>
                </div>

                <div className="mt-4 grid gap-3 text-xs text-graphite/65 md:grid-cols-3">
                  <div className="rounded-md bg-white px-3 py-2">
                    <span className="block uppercase tracking-[0.12em] text-graphite/45">{copy.actor}</span>
                    <span className="mt-1 block truncate font-medium text-graphite">{adminIdentity(event.actorAdmin, copy.noActor)}</span>
                  </div>
                  <div className="rounded-md bg-white px-3 py-2">
                    <span className="block uppercase tracking-[0.12em] text-graphite/45">{copy.target}</span>
                    <span className="mt-1 block truncate font-medium text-graphite">{adminIdentity(event.targetAdmin, copy.noTarget)}</span>
                  </div>
                  <div className="rounded-md bg-white px-3 py-2">
                    <span className="block uppercase tracking-[0.12em] text-graphite/45">{copy.type}</span>
                    <span className="mt-1 block truncate font-medium text-graphite">{event.type}</span>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {event.href ? (
                    <Link href={event.href} className="inline-flex h-9 items-center justify-center rounded-md border border-ink/10 bg-white px-3 text-xs font-medium text-ink transition hover:bg-ink/5">
                      {copy.open}
                    </Link>
                  ) : null}
                  {details ? (
                    <details className="min-w-0 flex-1">
                      <summary className="cursor-pointer text-xs font-medium text-graphite hover:text-ink">{copy.metadata}</summary>
                      <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-white p-3 text-xs leading-5 text-graphite/75">{details}</pre>
                    </details>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function calendarOptionValue(option: { id: string; summary: string }) {
  return `${option.id}|||${option.summary}`;
}

function StripeConnectSettings({
  language,
  configured,
  missingConfigKeys,
  integration
}: {
  language: AdminLanguage;
  configured: boolean;
  missingConfigKeys: string[];
  integration: StripeConnectIntegrationSettings | null;
}) {
  const copy = {
    hu: {
      eyebrow: "Stripe",
      title: "Fizetős galériák és saját kifizetés",
      description: "Minden fotós a saját Stripe fiókjával értékesít. A Spetly csak a rendelési folyamatot kezeli, a pénz az adott fotós Stripe accountjához kapcsolódik.",
      connected: "Aktív",
      pending: "Beállítás folyamatban",
      disconnected: "Nincs összekötve",
      missingConfigTitle: "A Stripe Connect még nincs konfigurálva.",
      missingConfigDetail: (keys: string) => `Vercelen add meg ezeket az env változókat: ${keys}.`,
      connectButton: "Stripe összekötése",
      continueButton: "Stripe beállítás folytatása",
      account: "Stripe account",
      currency: "Deviza",
      country: "Ország",
      lastSyncError: "Legutóbbi Stripe hiba:",
      noData: "Nincs adat",
      readyDetail: "A fizetős galéria mód választható az új galéria és a galéria beállításai alatt.",
      pendingDetail: "A Stripe onboarding még nem teljes. Folytasd a beállítást, amíg a fizetés fogadása aktív nem lesz."
    },
    de: {
      eyebrow: "Stripe",
      title: "Bezahlgalerien und eigene Auszahlungen",
      description: "Jeder Fotograf verkauft über sein eigenes Stripe-Konto. Spetly steuert nur den Bestellablauf; die Zahlung gehört zum jeweiligen Stripe-Account des Fotografen.",
      connected: "Aktiv",
      pending: "Einrichtung läuft",
      disconnected: "Nicht verbunden",
      missingConfigTitle: "Stripe Connect ist noch nicht konfiguriert.",
      missingConfigDetail: (keys: string) => `Füge diese Vercel-Umgebungsvariablen hinzu: ${keys}.`,
      connectButton: "Stripe verbinden",
      continueButton: "Stripe-Einrichtung fortsetzen",
      account: "Stripe Account",
      currency: "Währung",
      country: "Land",
      lastSyncError: "Letzter Stripe-Fehler:",
      noData: "Keine Daten",
      readyDetail: "Bezahlgalerien können beim Erstellen oder in den Galerie-Einstellungen aktiviert werden.",
      pendingDetail: "Das Stripe-Onboarding ist noch nicht abgeschlossen. Fahre fort, bis Zahlungen aktiv sind."
    },
    en: {
      eyebrow: "Stripe",
      title: "Paid galleries and own payouts",
      description: "Each photographer sells through their own Stripe account. Spetly handles the order flow; the payment belongs to the photographer's connected Stripe account.",
      connected: "Active",
      pending: "Setup in progress",
      disconnected: "Not connected",
      missingConfigTitle: "Stripe Connect is not configured yet.",
      missingConfigDetail: (keys: string) => `Add these Vercel environment variables: ${keys}.`,
      connectButton: "Connect Stripe",
      continueButton: "Continue Stripe setup",
      account: "Stripe account",
      currency: "Currency",
      country: "Country",
      lastSyncError: "Latest Stripe error:",
      noData: "No data",
      readyDetail: "Paid gallery mode is available when creating a gallery or editing gallery settings.",
      pendingDetail: "Stripe onboarding is not complete yet. Continue setup until payments are active."
    }
  }[language];
  const active = Boolean(integration?.chargesEnabled);
  const statusLabel = active ? copy.connected : integration ? copy.pending : copy.disconnected;

  return (
    <section className="rounded-md border border-ink/10 bg-white p-5 shadow-soft sm:p-6">
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-graphite/60">
            <CreditCard size={15} />
            {copy.eyebrow}
          </div>
          <h2 className="mt-2 text-xl font-semibold text-ink">{copy.title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-graphite/70">{copy.description}</p>
        </div>
        <span className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${active ? "bg-sage/10 text-sage" : integration ? "bg-brass/10 text-brass" : "bg-ink/5 text-graphite"}`}>
          {active ? <CheckCircle2 size={14} /> : null}
          {statusLabel}
        </span>
      </div>

      {!configured ? (
        <div className="mt-5 rounded-md border border-brass/20 bg-brass/10 px-4 py-4 text-sm leading-6 text-graphite/75">
          <p className="font-medium text-ink">{copy.missingConfigTitle}</p>
          <p className="mt-1">{copy.missingConfigDetail(missingConfigKeys.join(", "))}</p>
        </div>
      ) : null}

      {integration ? (
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-md border border-ink/10 bg-paper px-4 py-3">
            <p className="text-xs uppercase tracking-[0.14em] text-graphite/55">{copy.account}</p>
            <p className="mt-1 truncate text-sm font-semibold text-ink">{integration.stripeAccountEmail || integration.stripeAccountId}</p>
          </div>
          <div className="rounded-md border border-ink/10 bg-paper px-4 py-3">
            <p className="text-xs uppercase tracking-[0.14em] text-graphite/55">{copy.country}</p>
            <p className="mt-1 text-sm font-semibold text-ink">{integration.country || copy.noData}</p>
          </div>
          <div className="rounded-md border border-ink/10 bg-paper px-4 py-3">
            <p className="text-xs uppercase tracking-[0.14em] text-graphite/55">{copy.currency}</p>
            <p className="mt-1 text-sm font-semibold uppercase text-ink">{integration.defaultCurrency || copy.noData}</p>
          </div>
        </div>
      ) : null}

      <div className="mt-5 rounded-md border border-ink/10 bg-paper px-4 py-4">
        <p className="text-sm leading-6 text-graphite/70">
          {active ? copy.readyDetail : integration ? copy.pendingDetail : copy.description}
        </p>
        {integration?.lastSyncError ? (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {copy.lastSyncError} {integration.lastSyncError}
          </p>
        ) : null}
        <div className="mt-4">
          {configured ? (
            <Link href="/api/stripe/connect" className="inline-flex h-10 items-center justify-center rounded-md bg-ink px-4 text-sm font-medium text-white transition hover:bg-graphite">
              {integration ? copy.continueButton : copy.connectButton}
            </Link>
          ) : (
            <span className="inline-flex h-10 items-center justify-center rounded-md bg-ink/10 px-4 text-sm font-medium text-graphite/60">
              {copy.connectButton}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

function GoogleCalendarSettings({
  language,
  configured,
  missingConfigKeys,
  integration,
  calendarOptions,
  calendarOptionsError
}: {
  language: AdminLanguage;
  configured: boolean;
  missingConfigKeys: string[];
  integration: GoogleCalendarIntegrationSettings | null;
  calendarOptions: GoogleCalendarOption[];
  calendarOptionsError: boolean;
}) {
  const copy = SETTINGS_COPY[language].google;
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
            {copy.eyebrow}
          </div>
          <h2 className="mt-2 text-xl font-semibold text-ink">{copy.title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-graphite/70">
            {copy.description}
          </p>
        </div>
        {integration ? (
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-sage/10 px-3 py-1 text-xs font-medium text-sage">
            <CheckCircle2 size={14} />
            {copy.connected}
          </span>
        ) : (
          <span className="w-fit rounded-full bg-ink/5 px-3 py-1 text-xs font-medium text-graphite">{copy.disconnected}</span>
        )}
      </div>

      {!configured ? (
        <div className="mt-5 rounded-md border border-brass/20 bg-brass/10 px-4 py-4 text-sm leading-6 text-graphite/75">
          <p className="font-medium text-ink">{copy.missingConfigTitle}</p>
          <p className="mt-1">{copy.missingConfigDetail(missingConfigKeys.join(", "))}</p>
        </div>
      ) : null}

      <div className="mt-5 rounded-md border border-ink/10 bg-paper px-4 py-4">
        <div className="flex gap-3">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-white text-ink ring-1 ring-ink/10">
            <ShieldCheck size={17} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">{copy.permissionTitle}</p>
            <p className="mt-1 text-sm leading-6 text-graphite/70">
              {copy.permissionDescription}
            </p>
          </div>
        </div>
      </div>

      {!integration ? (
        <div className="mt-5 rounded-md border border-ink/10 bg-paper p-4">
          <p className="text-sm leading-6 text-graphite/70">
            {copy.connectInfo}
          </p>
          <div className="mt-4">
            {configured ? (
              <Link href="/api/google-calendar/connect" className="inline-flex h-10 items-center justify-center rounded-md bg-ink px-4 text-sm font-medium text-white transition hover:bg-graphite">
                {copy.connectButton}
              </Link>
            ) : (
              <span className="inline-flex h-10 items-center justify-center rounded-md bg-ink/10 px-4 text-sm font-medium text-graphite/60">
                {copy.connectButton}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <form action={updateGoogleCalendarSettingsAction} className="rounded-md border border-ink/10 bg-paper p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-md bg-white px-4 py-3">
                <p className="text-xs uppercase tracking-[0.14em] text-graphite/55">{copy.account}</p>
                <p className="mt-1 truncate text-sm font-semibold text-ink">{integration.googleAccountEmail || copy.account}</p>
              </div>
              <div className="rounded-md bg-white px-4 py-3">
                <p className="text-xs uppercase tracking-[0.14em] text-graphite/55">{copy.connectedAt}</p>
                <p className="mt-1 text-sm font-semibold text-ink">{formatSettingsDateTime(integration.connectedAt, language, copy.noData)}</p>
              </div>
            </div>

            <label className="mt-4 block space-y-2">
              <span className="text-sm font-medium text-graphite">{copy.targetCalendar}</span>
              <select name="calendarId" defaultValue={selectedCalendar ? calendarOptionValue(selectedCalendar) : "primary|||Primary"} className="h-12 w-full rounded-md border border-ink/15 bg-white px-3 text-ink outline-none transition focus:border-ink/50">
                {calendarOptionsWithSelected.length > 0 ? (
                  calendarOptionsWithSelected.map((calendar) => (
                    <option key={calendar.id} value={calendarOptionValue(calendar)}>
                      {calendar.summary}{calendar.primary ? ` (${copy.primarySuffix})` : ""}
                    </option>
                  ))
                ) : (
                  <option value={calendarOptionValue({ id: integration.calendarId, summary: integration.calendarSummary || integration.calendarId })}>
                    {integration.calendarSummary || integration.calendarId}
                  </option>
                )}
              </select>
              {calendarOptionsError ? (
                <span className="block text-xs leading-5 text-brass">{copy.calendarListError}</span>
              ) : null}
            </label>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="flex min-h-12 items-center gap-3 rounded-md bg-white px-3 text-sm text-graphite">
                <input name="syncMiniSessionBookings" type="checkbox" defaultChecked={integration.syncMiniSessionBookings} className="size-4 rounded border-ink/20" />
                {copy.syncBookings}
              </label>
              <label className="flex min-h-12 items-center gap-3 rounded-md bg-white px-3 text-sm text-graphite">
                <input name="syncCustomerProjects" type="checkbox" defaultChecked={integration.syncCustomerProjects} className="size-4 rounded border-ink/20" />
                {copy.syncProjects}
              </label>
              <label className="flex min-h-12 items-center gap-3 rounded-md bg-white px-3 text-sm text-graphite">
                <input name="blockAvailabilityFromGoogleCalendar" type="checkbox" defaultChecked={integration.blockAvailabilityFromGoogleCalendar} className="size-4 rounded border-ink/20" />
                {copy.blockAvailability}
              </label>
              <label className="flex min-h-12 items-center gap-3 rounded-md bg-white px-3 text-sm text-graphite">
                <input name="deleteCancelledEvents" type="checkbox" defaultChecked={integration.deleteCancelledEvents} className="size-4 rounded border-ink/20" />
                {copy.deleteCancelledEvents}
              </label>
            </div>
            <p className="mt-3 rounded-md bg-white px-3 py-3 text-xs leading-5 text-graphite/65">
              {copy.freeBusyHint}
            </p>

            {integration.lastSyncError ? (
              <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-3 text-sm leading-6 text-red-700">
                {copy.lastSyncError} {integration.lastSyncError}
              </p>
            ) : null}

            <div className="mt-5 flex flex-col gap-3 border-t border-ink/10 pt-4 sm:flex-row sm:items-center">
              <FormSubmitButton pendingLabel={copy.saving}>{copy.save}</FormSubmitButton>
              <Link href="/api/google-calendar/connect" className="inline-flex h-10 items-center justify-center rounded-md border border-ink/10 px-4 text-sm font-medium text-ink transition hover:bg-ink/5">
                {copy.reconnect}
              </Link>
            </div>
          </form>

          <aside className="space-y-4">
            <div className="rounded-md border border-ink/10 bg-white p-4">
              <p className="text-sm font-semibold text-ink">{copy.syncTitle}</p>
              <div className="mt-3 space-y-2 text-sm leading-6 text-graphite/70">
                <p>{copy.syncBookingsDetail}</p>
                <p>{copy.syncProjectsDetail}</p>
                <p>{copy.syncBlockingDetail}</p>
              </div>
            </div>
            <form action={disconnectGoogleCalendarAction} className="rounded-md border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-700">{copy.disconnectTitle}</p>
              <p className="mt-2 text-sm leading-6 text-red-700/80">{copy.disconnectDescription}</p>
              <ConfirmSubmitButton variant="danger" className="mt-4" message={copy.disconnectConfirm}>
                {copy.disconnectButton}
              </ConfirmSubmitButton>
            </form>
          </aside>
        </div>
      )}
    </section>
  );
}

function DeliveryReliabilityPanel({
  language,
  deliveryLogs
}: {
  language: AdminLanguage;
  deliveryLogs: SettingsDeliveryLog[];
}) {
  const copy = DELIVERY_PANEL_COPY[language];

  return (
    <section className="rounded-md border border-ink/10 bg-white p-5 shadow-soft sm:p-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-graphite/60">
            <Mail size={15} />
            {copy.eyebrow}
          </div>
          <h2 className="mt-2 text-xl font-semibold text-ink">{copy.title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-graphite/70">{copy.description}</p>
        </div>
        <span className="inline-flex w-fit rounded-full bg-ink/5 px-3 py-1 text-xs font-medium text-graphite">
          {deliveryLogs.length}
        </span>
      </div>

      {deliveryLogs.length === 0 ? (
        <div className="mt-5 rounded-md border border-dashed border-ink/15 bg-paper px-4 py-5">
          <p className="text-sm font-semibold text-ink">{copy.emptyTitle}</p>
          <p className="mt-1 text-sm leading-6 text-graphite/65">{copy.emptyBody}</p>
        </div>
      ) : (
        <div className="mt-5 overflow-hidden rounded-md border border-ink/10">
          <div className="divide-y divide-ink/10">
            {deliveryLogs.map((deliveryLog) => (
              <div key={deliveryLog.id} className="grid gap-3 bg-white px-4 py-4 lg:grid-cols-[minmax(0,1fr)_180px_180px] lg:items-start">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-1 text-[11px] font-medium ring-1 ${deliveryStatusClass(deliveryLog.status)}`}>
                      {deliveryStatusLabel(deliveryLog.status, language)}
                    </span>
                    <span className="rounded-full bg-ink/5 px-2 py-1 text-[11px] font-medium text-graphite">
                      {deliveryLog.channel === "google_calendar" ? "Google Calendar" : "E-mail"}
                    </span>
                  </div>
                  <p className="mt-2 truncate text-sm font-semibold text-ink">{deliveryLog.subject || deliveryLog.type}</p>
                  <p className="mt-1 truncate text-xs text-graphite/60">{deliveryLog.type}</p>
                  {deliveryLog.lastError ? (
                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-red-700">
                      {copy.error}: {deliveryLog.lastError}
                    </p>
                  ) : null}
                </div>
                <div className="text-xs leading-5 text-graphite/65">
                  <p className="font-medium uppercase tracking-[0.12em] text-graphite/45">{copy.recipient}</p>
                  <p className="mt-1 truncate text-sm normal-case tracking-normal text-graphite">{deliveryLog.recipient || "-"}</p>
                </div>
                <div className="text-xs leading-5 text-graphite/65">
                  <p className="font-medium uppercase tracking-[0.12em] text-graphite/45">{copy.updated}</p>
                  <p className="mt-1 text-sm normal-case tracking-normal text-graphite">
                    {formatSettingsDateTime(deliveryLog.sentAt ?? deliveryLog.createdAt, language, "-")}
                  </p>
                  {deliveryLog.nextAttemptAt ? (
                    <p className="mt-1 text-xs text-brass">
                      {copy.nextRetry}: {formatSettingsDateTime(deliveryLog.nextAttemptAt, language, "-")}
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function WorkspaceStatsPanel({ stats, language }: { stats: WorkspaceGalleryStats; language: AdminLanguage }) {
  const copy = WORKSPACE_STATS_COPY[language];
  const cards = [
    {
      label: copy.stats.galleries[0],
      value: formatNumber(stats.galleryCount),
      detail: copy.stats.galleries[1]
    },
    {
      label: copy.stats.active[0],
      value: formatNumber(stats.activeGalleryCount),
      detail: copy.stats.active[1]
    },
    {
      label: copy.stats.media[0],
      value: formatNumber(stats.mediaCount),
      detail: copy.stats.media[1]
    },
    {
      label: copy.stats.storage[0],
      value: formatBytes(stats.storageBytes),
      detail: copy.stats.storage[1]
    }
  ];

  return (
    <section className="rounded-md border border-ink/10 bg-white p-5 shadow-soft sm:p-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-graphite/60">
            <Layers size={15} />
            {copy.eyebrow}
          </div>
          <h2 className="mt-2 text-xl font-semibold text-ink">{copy.title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-graphite/70">{copy.description}</p>
        </div>
        <Link
          href="/admin/r2-storage"
          className="inline-flex h-10 w-fit items-center gap-2 rounded-md border border-ink/12 bg-white px-3 text-sm font-medium text-ink transition hover:border-ink/25 hover:bg-paper"
        >
          <HardDrive size={16} />
          {copy.openStorage}
        </Link>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-md border border-ink/10 bg-paper px-4 py-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-graphite/55">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold leading-tight text-ink">{card.value}</p>
            <div className="mt-2 h-0.5 w-8 rounded-full bg-brass/45" />
            <p className="mt-2 text-sm leading-5 text-graphite/70">{card.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

async function getWorkspaceGalleryStats(adminId: string): Promise<WorkspaceGalleryStats> {
  const [galleryCount, activeGalleryCount, mediaCount, photoStorage] = await Promise.all([
    prisma.gallery.count({ where: { adminId } }),
    prisma.gallery.count({ where: { adminId, isActive: true } }),
    prisma.photo.count({ where: { gallery: { adminId } } }),
    prisma.photo.aggregate({
      where: { gallery: { adminId } },
      _sum: { fileSize: true }
    })
  ]);

  return {
    galleryCount,
    activeGalleryCount,
    mediaCount,
    storageBytes: toBigInt(photoStorage._sum.fileSize)
  };
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
    stripe?: string;
  }>;
}) {
  const [admin, params, language] = await Promise.all([requireAdmin(), searchParams, getAdminLanguage()]);
  const isTeamWorkspace = admin.isTeamWorkspace;
  const workspaceAdminId = ownerAdminId(admin);
  const activeTab: SettingsTab =
    params.tab === "security"
      ? "security"
      : params.tab === "logs" && admin.role === "super_admin"
        ? "logs"
      : params.tab === "integrations" && !isTeamWorkspace
        ? "integrations"
      : params.tab === "providers" && admin.role === "super_admin"
        ? "providers"
        : params.tab === "brand" && !isTeamWorkspace
          ? "brand"
          : params.tab === "profile" || isTeamWorkspace
            ? "profile"
            : "brand";
  const [settings, photographerProfile, serviceUsage, googleIntegration, stripeIntegration, systemEvents, deliveryLogs, workspaceStats] = await Promise.all([
    prisma.siteSettings.findFirst({
      where: {
        OR: [{ adminId: admin.id }, ...(admin.role === "super_admin" ? [{ id: "default" }] : [])]
      },
      select: {
        businessName: true,
        publicSubdomain: true,
        logoUrl: true,
        logoHeight: true,
        signatureUrl: true,
        websiteUrl: true,
        instagramUrl: true,
        facebookUrl: true,
        tiktokUrl: true,
        youtubeUrl: true,
        contactEmail: true,
        contactPhone: true,
        galleryWatermarkEnabled: true,
        galleryWatermarkText: true,
        galleryWatermarkPosition: true,
        galleryWatermarkOpacity: true
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
      : Promise.resolve(null),
    !isTeamWorkspace
      ? prisma.stripeConnectIntegration.findUnique({
          where: { adminId: workspaceAdminId },
          select: {
            stripeAccountId: true,
            stripeAccountEmail: true,
            country: true,
            defaultCurrency: true,
            chargesEnabled: true,
            payoutsEnabled: true,
            detailsSubmitted: true,
            onboardingCompletedAt: true,
            lastSyncError: true,
            connectedAt: true,
            updatedAt: true
          }
        })
      : Promise.resolve(null),
    admin.role === "super_admin"
      ? prisma.systemEvent.findMany({
          orderBy: { createdAt: "desc" },
          take: 100,
          include: {
            actorAdmin: {
              select: {
                name: true,
                email: true
              }
            },
            targetAdmin: {
              select: {
                name: true,
                email: true
              }
            }
          }
        })
      : Promise.resolve([]),
    !isTeamWorkspace
      ? prisma.deliveryLog.findMany({
          where: {
            adminId: workspaceAdminId,
            status: { in: ["pending", "retry", "failed"] }
          },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            channel: true,
            type: true,
            status: true,
            recipient: true,
            subject: true,
            lastError: true,
            sentAt: true,
            nextAttemptAt: true,
            createdAt: true
          }
        })
      : Promise.resolve([]),
    getWorkspaceGalleryStats(workspaceAdminId)
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
  const stripeConfigured = isStripeConnectConfigured();
  const stripeMissingConfigKeys = stripeConnectMissingConfigKeys();
  const settingsTabColumns = admin.role === "super_admin" ? "sm:grid-cols-2 xl:grid-cols-6" : isTeamWorkspace ? "sm:grid-cols-2" : "sm:grid-cols-4";
  const copy = SETTINGS_COPY[language];

  return (
    <AdminShell>
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.16em] text-graphite/60">{copy.area}</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">{copy.title}</h1>
        <p className="mt-3 max-w-2xl text-graphite/70">
          {copy.intro}
        </p>
      </div>

      <div className="mb-6 rounded-md border border-ink/10 bg-white p-2">
        <nav className={`grid gap-2 ${settingsTabColumns}`} aria-label={copy.navLabel}>
          {!isTeamWorkspace ? (
            <Link
              href="/admin/settings?tab=brand"
              className={`flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition ${
                activeTab === "brand" ? "bg-ink text-white shadow-sm" : "text-graphite hover:bg-ink/5 hover:text-ink"
              }`}
            >
              <Globe2 size={16} />
              {copy.tabs.brand}
            </Link>
          ) : null}
          <Link
            href="/admin/settings?tab=profile"
            className={`flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition ${
              activeTab === "profile" ? "bg-ink text-white shadow-sm" : "text-graphite hover:bg-ink/5 hover:text-ink"
            }`}
          >
            <UserRound size={16} />
            {copy.tabs.profile}
          </Link>
          <Link
            href="/admin/settings?tab=security"
            className={`flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition ${
              activeTab === "security" ? "bg-ink text-white shadow-sm" : "text-graphite hover:bg-ink/5 hover:text-ink"
            }`}
          >
            <ShieldCheck size={16} />
            {copy.tabs.security}
          </Link>
          {!isTeamWorkspace ? (
            <Link
              href="/admin/settings?tab=integrations"
              className={`flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition ${
                activeTab === "integrations" ? "bg-ink text-white shadow-sm" : "text-graphite hover:bg-ink/5 hover:text-ink"
              }`}
            >
              <CalendarDays size={16} />
              {copy.tabs.integrations}
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
              {copy.tabs.providers}
            </Link>
          ) : null}
          {admin.role === "super_admin" ? (
            <Link
              href="/admin/settings?tab=logs"
              className={`flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition ${
                activeTab === "logs" ? "bg-ink text-white shadow-sm" : "text-graphite hover:bg-ink/5 hover:text-ink"
              }`}
            >
              <ClipboardList size={16} />
              {copy.tabs.logs}
            </Link>
          ) : null}
        </nav>
      </div>

      <div className="mb-5 space-y-3">
        {params.saved ? <Alert title={copy.alerts.saved} variant="success" /> : null}
        {params.error === "logo" ? (
          <Alert title={copy.alerts.logoTitle} variant="error">
            {copy.alerts.logoBody}
          </Alert>
        ) : null}
        {params.error === "signature" ? (
          <Alert title={copy.alerts.signatureTitle} variant="error">
            {copy.alerts.signatureBody}
          </Alert>
        ) : null}
        {params.error === "profile_required" ? (
          <Alert title={copy.alerts.profileRequiredTitle} variant="error">
            {copy.alerts.profileRequiredBody}
          </Alert>
        ) : null}
        {params.error === "profile_email" ? (
          <Alert title={copy.alerts.profileEmailTitle} variant="error">
            {copy.alerts.profileEmailBody}
          </Alert>
        ) : null}
        {params.error === "profile_email_taken" ? (
          <Alert title={copy.alerts.profileEmailTakenTitle} variant="error">
            {copy.alerts.profileEmailTakenBody}
          </Alert>
        ) : null}
        {params.error === "public_subdomain" ? (
          <Alert title={copy.alerts.publicSubdomainTitle} variant="error">
            {copy.alerts.publicSubdomainBody}
          </Alert>
        ) : null}
        {params.error === "public_subdomain_taken" ? (
          <Alert title={copy.alerts.publicSubdomainTakenTitle} variant="error">
            {copy.alerts.publicSubdomainTakenBody}
          </Alert>
        ) : null}
        {params.google === "connected" ? <Alert title={copy.alerts.googleConnected} variant="success" /> : null}
        {params.google === "saved" ? <Alert title={copy.alerts.googleSaved} variant="success" /> : null}
        {params.google === "disconnected" ? <Alert title={copy.alerts.googleDisconnected} variant="success" /> : null}
        {params.google === "missing-config" ? <Alert title={copy.alerts.googleMissingConfigTitle} variant="error">{copy.alerts.googleMissingConfigBody}</Alert> : null}
        {params.google === "state-error" ? <Alert title={copy.alerts.googleStateTitle} variant="error">{copy.alerts.googleStateBody}</Alert> : null}
        {params.google === "no-refresh-token" ? <Alert title={copy.alerts.googleRefreshTitle} variant="error">{copy.alerts.googleRefreshBody}</Alert> : null}
        {params.google === "oauth-error" || params.google === "callback-error" ? <Alert title={copy.alerts.googleErrorTitle} variant="error">{copy.alerts.googleErrorBody}</Alert> : null}
        {params.stripe === "connected" ? <Alert title="Stripe összekötve, a fizetős galériák aktiválhatók." variant="success" /> : null}
        {params.stripe === "pending" ? <Alert title="A Stripe beállítás még nem teljes." variant="info">Folytasd az onboardingot, amíg a fizetés fogadása aktív nem lesz.</Alert> : null}
        {params.stripe === "missing-config" ? <Alert title="A Stripe Connect nincs konfigurálva." variant="error">Add meg a STRIPE_SECRET_KEY env változót Vercelben.</Alert> : null}
        {params.stripe === "missing-account" || params.stripe === "error" ? <Alert title="A Stripe összekötése nem sikerült." variant="error">Próbáld újra pár perc múlva, vagy ellenőrizd a Stripe beállításokat.</Alert> : null}
      </div>

      {activeTab === "brand" && !isTeamWorkspace ? <SiteSettingsForm adminName={admin.name} settings={settings ?? emptySettings} /> : null}

      {activeTab === "profile" ? (
        <div className="space-y-5">
          <PhotographerProfileSettings profile={photographerProfile} />
          <WorkspaceStatsPanel stats={workspaceStats} language={language} />
        </div>
      ) : null}

      {activeTab === "security" ? <AdminSecuritySettings enabled={params.enabled} disabled={params.disabled} error={params.error} /> : null}

      {activeTab === "integrations" ? (
        <div className="space-y-5">
          <StripeConnectSettings
            language={language}
            configured={stripeConfigured}
            missingConfigKeys={stripeMissingConfigKeys}
            integration={stripeIntegration}
          />
          <GoogleCalendarSettings
            language={language}
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
          <DeliveryReliabilityPanel language={language} deliveryLogs={deliveryLogs} />
        </div>
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

      {activeTab === "logs" && admin.role === "super_admin" ? <SystemEventLog events={systemEvents} language={language} /> : null}
    </AdminShell>
  );
}
