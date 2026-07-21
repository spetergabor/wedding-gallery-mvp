import { cookies } from "next/headers";

export type AdminLanguage = "hu" | "de" | "en";

export const ADMIN_LANGUAGE_COOKIE = "speter_admin_language";

export const ADMIN_LANGUAGES = [
  { value: "hu", label: "Magyar", shortLabel: "HU" },
  { value: "de", label: "Deutsch", shortLabel: "DE" },
  { value: "en", label: "English", shortLabel: "EN" }
] as const;

export const ADMIN_LOCALES = {
  hu: "hu-HU",
  de: "de-AT",
  en: "en-US"
} as const;

export function normalizeAdminLanguage(value: string | null | undefined): AdminLanguage {
  return value === "de" || value === "en" ? value : "hu";
}

export async function getAdminLanguage(): Promise<AdminLanguage> {
  const cookieStore = await cookies();
  return normalizeAdminLanguage(cookieStore.get(ADMIN_LANGUAGE_COOKIE)?.value);
}

export function dateLocaleForAdmin(language: AdminLanguage) {
  return ADMIN_LOCALES[language];
}

export const ADMIN_SHELL_COPY = {
  hu: {
    appArea: "Admin MVP",
    navigationLabel: "Admin menü",
    mobileNavigationLabel: "Mobil admin menü",
    menu: "Menü",
    language: "Felület nyelve",
    dashboard: "Dashboard",
    clients: "Ügyfelek",
    galleries: "Galériák",
    albumEditor: "Album szerkesztő",
    bookings: "Időpontfoglaló",
    team: "Csapat",
    workspace: "Munkaterület",
    activeWorkspace: "Most itt dolgozol",
    ownWorkspace: "Saját",
    teamWorkspace: "Csapat",
    ownWorkspaceHint: "Az új ügyfelek, galériák és beállítások a saját fiókodhoz kerülnek.",
    teamWorkspaceHint: "Az új ügyfelek, galériák és szerződések a csapat fiókjába kerülnek.",
    switchToOwnWorkspace: "Váltás sajátra",
    switchToTeamWorkspace: "Váltás csapatra",
    superAdmin: "Szuperadmin",
    photographers: "Fotósok",
    r2Storage: "R2 tárhely",
    zipBenchmark: "ZIP benchmark",
    monetization: "Monetizáció",
    providers: "Szolgáltatók",
    systemLogs: "Rendszer napló",
    newClient: "Új ügyfél",
    notifications: "Értesítések",
    settings: "Beállítások",
    stripeBalance: "Stripe egyenleg",
    stripeAvailable: "Elérhető",
    stripePending: "Függőben",
    stripeHasFunds: "Van pénz",
    stripeNoFunds: "Nincs elérhető pénz",
    stripeErrorShort: "Hiba",
    stripeBalanceError: "Nem sikerült lekérni",
    stripeLiveHint: "Élő Stripe adat",
    logout: "Kilépés"
  },
  de: {
    appArea: "Admin MVP",
    navigationLabel: "Admin-Menü",
    mobileNavigationLabel: "Mobiles Admin-Menü",
    menu: "Menü",
    language: "Sprache der Oberfläche",
    dashboard: "Dashboard",
    clients: "Kunden",
    galleries: "Galerien",
    albumEditor: "Album-Editor",
    bookings: "Terminbuchung",
    team: "Team",
    workspace: "Arbeitsbereich",
    activeWorkspace: "Du arbeitest gerade hier",
    ownWorkspace: "Eigene",
    teamWorkspace: "Team",
    ownWorkspaceHint: "Neue Kunden, Galerien und Einstellungen landen in deinem eigenen Konto.",
    teamWorkspaceHint: "Neue Kunden, Galerien und Verträge landen im Team-Konto.",
    switchToOwnWorkspace: "Zu eigener wechseln",
    switchToTeamWorkspace: "Zum Team wechseln",
    superAdmin: "Superadmin",
    photographers: "Fotografen",
    r2Storage: "R2-Speicher",
    zipBenchmark: "ZIP-Benchmark",
    monetization: "Monetarisierung",
    providers: "Dienstleister",
    systemLogs: "Systemprotokoll",
    newClient: "Neuer Kunde",
    notifications: "Benachrichtigungen",
    settings: "Einstellungen",
    stripeBalance: "Stripe-Guthaben",
    stripeAvailable: "Verfügbar",
    stripePending: "Ausstehend",
    stripeHasFunds: "Geld verfügbar",
    stripeNoFunds: "Kein verfügbares Geld",
    stripeErrorShort: "Fehler",
    stripeBalanceError: "Konnte nicht geladen werden",
    stripeLiveHint: "Live von Stripe",
    logout: "Abmelden"
  },
  en: {
    appArea: "Admin",
    navigationLabel: "Admin menu",
    mobileNavigationLabel: "Mobile admin menu",
    menu: "Menu",
    language: "Interface language",
    dashboard: "Dashboard",
    clients: "Clients",
    galleries: "Galleries",
    albumEditor: "Album editor",
    bookings: "Bookings",
    team: "Team",
    workspace: "Workspace",
    activeWorkspace: "You are working here",
    ownWorkspace: "Own",
    teamWorkspace: "Team",
    ownWorkspaceHint: "New clients, galleries and settings are saved to your own account.",
    teamWorkspaceHint: "New clients, galleries and contracts are saved to the team account.",
    switchToOwnWorkspace: "Switch to own",
    switchToTeamWorkspace: "Switch to team",
    superAdmin: "Superadmin",
    photographers: "Photographers",
    r2Storage: "R2 storage",
    zipBenchmark: "ZIP benchmark",
    monetization: "Monetization",
    providers: "Providers",
    systemLogs: "System log",
    newClient: "New client",
    notifications: "Notifications",
    settings: "Settings",
    stripeBalance: "Stripe balance",
    stripeAvailable: "Available",
    stripePending: "Pending",
    stripeHasFunds: "Funds available",
    stripeNoFunds: "No available funds",
    stripeErrorShort: "Error",
    stripeBalanceError: "Could not load",
    stripeLiveHint: "Live from Stripe",
    logout: "Log out"
  }
} as const;
