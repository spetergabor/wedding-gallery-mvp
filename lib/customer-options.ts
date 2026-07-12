import type { AdminLanguage } from "@/lib/admin-language";

export const CUSTOMER_TYPES = [
  { value: "wedding_couple", label: "Esküvős pár" },
  { value: "mini_session", label: "Mini shooting" },
  { value: "couple_session", label: "Párfotózás" },
  { value: "individual", label: "Egyéni ügyfél" },
  { value: "family", label: "Család" },
  { value: "event", label: "Esemény / rendezvény" },
  { value: "company", label: "Cég / brand" }
];

export const CUSTOMER_STATUSES = [
  { value: "lead", label: "Érdeklődő" },
  { value: "offer_sent", label: "Ajánlat elküldve" },
  { value: "booked", label: "Foglalva / szerződött" },
  { value: "shoot_done", label: "Fotózás után / utómunka" },
  { value: "selection", label: "Válogatás alatt" },
  { value: "editing", label: "Kidolgozás alatt" },
  { value: "delivered", label: "Átadva" },
  { value: "archived", label: "Archivált" }
];

const CUSTOMER_TYPE_LABELS: Record<AdminLanguage, Record<string, string>> = {
  hu: {
    wedding_couple: "Esküvős pár",
    mini_session: "Mini shooting",
    couple_session: "Párfotózás",
    individual: "Egyéni ügyfél",
    family: "Család",
    event: "Esemény / rendezvény",
    company: "Cég / brand",
    fallback: "Ügyfél"
  },
  de: {
    wedding_couple: "Hochzeitspaar",
    mini_session: "Mini Shooting",
    couple_session: "Paarshooting",
    individual: "Einzelkunde",
    family: "Familie",
    event: "Event / Veranstaltung",
    company: "Firma / Brand",
    fallback: "Kunde"
  },
  en: {
    wedding_couple: "Wedding couple",
    mini_session: "Mini session",
    couple_session: "Couple session",
    individual: "Individual client",
    family: "Family",
    event: "Event",
    company: "Company / brand",
    fallback: "Client"
  }
};

const CUSTOMER_STATUS_LABELS: Record<AdminLanguage, Record<string, string>> = {
  hu: {
    lead: "Érdeklődő",
    offer_sent: "Ajánlat elküldve",
    booked: "Foglalva / szerződött",
    shoot_done: "Fotózás után / utómunka",
    selection: "Válogatás alatt",
    editing: "Kidolgozás alatt",
    delivered: "Átadva",
    archived: "Archivált",
    beforeShoot: "Fotózás előtt",
    missingDate: "Dátum hiányzik"
  },
  de: {
    lead: "Anfrage",
    offer_sent: "Angebot gesendet",
    booked: "Gebucht / Vertrag",
    shoot_done: "Nach dem Shooting / Bearbeitung",
    selection: "Auswahl läuft",
    editing: "In Bearbeitung",
    delivered: "Ausgeliefert",
    archived: "Archiviert",
    beforeShoot: "Vor dem Shooting",
    missingDate: "Datum fehlt"
  },
  en: {
    lead: "Lead",
    offer_sent: "Offer sent",
    booked: "Booked / contracted",
    shoot_done: "After shoot / editing",
    selection: "Selection in progress",
    editing: "Editing",
    delivered: "Delivered",
    archived: "Archived",
    beforeShoot: "Before shoot",
    missingDate: "Date missing"
  }
};

const legacyStatusMap: Record<string, string> = {
  contract_pending: "offer_sent",
  completed: "delivered"
};

export function normalizeCustomerType(value: string | null | undefined) {
  return CUSTOMER_TYPES.some((item) => item.value === value) ? value! : "wedding_couple";
}

export function normalizeCustomerStatus(value: string | null | undefined) {
  const normalizedValue = value ? legacyStatusMap[value] ?? value : "lead";
  return CUSTOMER_STATUSES.some((item) => item.value === normalizedValue) ? normalizedValue : "lead";
}

export function customerTypeLabel(value: string | null | undefined) {
  const normalizedValue = normalizeCustomerType(value);
  return CUSTOMER_TYPES.find((item) => item.value === normalizedValue)?.label ?? "Ügyfél";
}

export function customerTypeLabelForLanguage(value: string | null | undefined, language: AdminLanguage = "hu") {
  const normalizedValue = normalizeCustomerType(value);
  return CUSTOMER_TYPE_LABELS[language][normalizedValue] ?? CUSTOMER_TYPE_LABELS[language].fallback;
}

export function customerStatusLabel(value: string | null | undefined, language: AdminLanguage = "hu") {
  const normalizedValue = normalizeCustomerStatus(value);
  return CUSTOMER_STATUS_LABELS[language][normalizedValue] ?? CUSTOMER_STATUS_LABELS[language].lead;
}

export function customerStatusDisplayLabel(
  value: string | null | undefined,
  options: {
    hasKnownWorkDate?: boolean;
    referenceDate?: Date;
    workDate?: Date | null;
    language?: AdminLanguage;
  } = {}
) {
  const normalizedValue = normalizeCustomerStatus(value);
  const language = options.language ?? "hu";

  if (normalizedValue === "shoot_done") {
    const referenceDate = options.referenceDate ?? new Date();

    if (options.workDate && options.workDate.getTime() >= referenceDate.getTime()) {
      return CUSTOMER_STATUS_LABELS[language].beforeShoot;
    }

    if (options.hasKnownWorkDate === false) {
      return CUSTOMER_STATUS_LABELS[language].missingDate;
    }
  }

  return customerStatusLabel(normalizedValue, language);
}
