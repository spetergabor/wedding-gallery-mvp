import type { AdminLanguage } from "@/lib/admin-language";

export const CUSTOMER_PROJECT_TYPES = [
  { value: "wedding", label: "Esküvő" },
  { value: "couple_session", label: "Párfotózás" },
  { value: "mini_session", label: "Mini fotózás" },
  { value: "family", label: "Családi fotózás" },
  { value: "event", label: "Esemény" },
  { value: "business", label: "Céges / brand" },
  { value: "album", label: "Album" },
  { value: "general", label: "Általános projekt" }
];

export const CUSTOMER_PROJECT_STATUSES = [
  { value: "lead", label: "Érdeklődő" },
  { value: "planned", label: "Tervezve" },
  { value: "in_progress", label: "Folyamatban" },
  { value: "proofing", label: "Válogatás / ellenőrzés" },
  { value: "editing", label: "Kidolgozás alatt" },
  { value: "delivered", label: "Átadva" },
  { value: "archived", label: "Archivált" }
];

const CUSTOMER_PROJECT_TYPE_LABELS: Record<AdminLanguage, Record<string, string>> = {
  hu: {
    wedding: "Esküvő",
    couple_session: "Párfotózás",
    mini_session: "Mini fotózás",
    family: "Családi fotózás",
    event: "Esemény",
    business: "Céges / brand",
    album: "Album",
    general: "Általános projekt"
  },
  de: {
    wedding: "Hochzeit",
    couple_session: "Paarshooting",
    mini_session: "Mini Shooting",
    family: "Familienshooting",
    event: "Event",
    business: "Business / Brand",
    album: "Album",
    general: "Allgemeines Projekt"
  },
  en: {
    wedding: "Wedding",
    couple_session: "Couple session",
    mini_session: "Mini session",
    family: "Family session",
    event: "Event",
    business: "Business / brand",
    album: "Album",
    general: "General project"
  }
};

const CUSTOMER_PROJECT_STATUS_LABELS: Record<AdminLanguage, Record<string, string>> = {
  hu: {
    lead: "Érdeklődő",
    planned: "Tervezve",
    in_progress: "Folyamatban",
    proofing: "Válogatás / ellenőrzés",
    editing: "Kidolgozás alatt",
    delivered: "Átadva",
    archived: "Archivált"
  },
  de: {
    lead: "Anfrage",
    planned: "Geplant",
    in_progress: "In Arbeit",
    proofing: "Auswahl / Prüfung",
    editing: "In Bearbeitung",
    delivered: "Ausgeliefert",
    archived: "Archiviert"
  },
  en: {
    lead: "Lead",
    planned: "Planned",
    in_progress: "In progress",
    proofing: "Selection / review",
    editing: "Editing",
    delivered: "Delivered",
    archived: "Archived"
  }
};

export function normalizeCustomerProjectType(value: string | null | undefined) {
  return CUSTOMER_PROJECT_TYPES.some((item) => item.value === value) ? value! : "general";
}

export function normalizeCustomerProjectStatus(value: string | null | undefined) {
  return CUSTOMER_PROJECT_STATUSES.some((item) => item.value === value) ? value! : "planned";
}

export function customerProjectTypeLabel(value: string | null | undefined, language: AdminLanguage = "hu") {
  const normalizedValue = normalizeCustomerProjectType(value);
  return CUSTOMER_PROJECT_TYPE_LABELS[language][normalizedValue] ?? CUSTOMER_PROJECT_TYPE_LABELS[language].general;
}

export function customerProjectStatusLabel(value: string | null | undefined, language: AdminLanguage = "hu") {
  const normalizedValue = normalizeCustomerProjectStatus(value);
  return CUSTOMER_PROJECT_STATUS_LABELS[language][normalizedValue] ?? CUSTOMER_PROJECT_STATUS_LABELS[language].planned;
}
