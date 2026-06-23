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

export function normalizeCustomerProjectType(value: string | null | undefined) {
  return CUSTOMER_PROJECT_TYPES.some((item) => item.value === value) ? value! : "general";
}

export function normalizeCustomerProjectStatus(value: string | null | undefined) {
  return CUSTOMER_PROJECT_STATUSES.some((item) => item.value === value) ? value! : "planned";
}

export function customerProjectTypeLabel(value: string | null | undefined) {
  const normalizedValue = normalizeCustomerProjectType(value);
  return CUSTOMER_PROJECT_TYPES.find((item) => item.value === normalizedValue)?.label ?? "Általános projekt";
}

export function customerProjectStatusLabel(value: string | null | undefined) {
  const normalizedValue = normalizeCustomerProjectStatus(value);
  return CUSTOMER_PROJECT_STATUSES.find((item) => item.value === normalizedValue)?.label ?? "Tervezve";
}
