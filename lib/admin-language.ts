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
    photographers: "Fotósok",
    r2Storage: "R2 tárhely",
    newClient: "Új ügyfél",
    notifications: "Értesítések",
    settings: "Beállítások",
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
    photographers: "Fotografen",
    r2Storage: "R2-Speicher",
    newClient: "Neuer Kunde",
    notifications: "Benachrichtigungen",
    settings: "Einstellungen",
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
    photographers: "Photographers",
    r2Storage: "R2 storage",
    newClient: "New client",
    notifications: "Notifications",
    settings: "Settings",
    logout: "Log out"
  }
} as const;
