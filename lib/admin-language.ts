import { cookies } from "next/headers";

export type AdminLanguage = "hu" | "de";

export const ADMIN_LANGUAGE_COOKIE = "speter_admin_language";

export const ADMIN_LANGUAGES = [
  { value: "hu", label: "Magyar", shortLabel: "HU" },
  { value: "de", label: "Deutsch", shortLabel: "DE" }
] as const;

export const ADMIN_LOCALES = {
  hu: "hu-HU",
  de: "de-AT"
} as const;

export function normalizeAdminLanguage(value: string | null | undefined): AdminLanguage {
  return value === "de" ? "de" : "hu";
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
    photographers: "Fotósok",
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
    photographers: "Fotografen",
    newClient: "Neuer Kunde",
    notifications: "Benachrichtigungen",
    settings: "Einstellungen",
    logout: "Abmelden"
  }
} as const;
