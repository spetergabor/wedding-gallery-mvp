export const CUSTOMER_TASK_TYPES = [
  { value: "general", label: "Általános" },
  { value: "album", label: "Album" },
  { value: "editing", label: "Kidolgozás" },
  { value: "delivery", label: "Átadás" },
  { value: "contract", label: "Szerződés" },
  { value: "invoice", label: "Számla" },
  { value: "communication", label: "Kommunikáció" },
  { value: "logistics", label: "Logisztika" }
];

export const CUSTOMER_TASK_STATUSES = [
  { value: "planned", label: "Tervezett" },
  { value: "in_progress", label: "Folyamatban" },
  { value: "delivered", label: "Átadva" },
  { value: "closed", label: "Lezárva" }
];

export const CUSTOMER_TASK_PRIORITIES = [
  { value: "normal", label: "Normál" },
  { value: "high", label: "Fontos" },
  { value: "low", label: "Alacsony" }
];

export function normalizeCustomerTaskType(value: string | null | undefined) {
  return CUSTOMER_TASK_TYPES.some((item) => item.value === value) ? value! : "general";
}

export function normalizeCustomerTaskStatus(value: string | null | undefined) {
  if (value === "open" || value === "postponed") {
    return "planned";
  }

  if (value === "done" || value === "cancelled") {
    return "closed";
  }

  return CUSTOMER_TASK_STATUSES.some((item) => item.value === value) ? value! : "planned";
}

export function normalizeCustomerTaskPriority(value: string | null | undefined) {
  return CUSTOMER_TASK_PRIORITIES.some((item) => item.value === value) ? value! : "normal";
}

export function customerTaskTypeLabel(value: string | null | undefined) {
  const normalizedValue = normalizeCustomerTaskType(value);
  return CUSTOMER_TASK_TYPES.find((item) => item.value === normalizedValue)?.label ?? "Általános";
}

export function customerTaskStatusLabel(value: string | null | undefined) {
  const normalizedValue = normalizeCustomerTaskStatus(value);
  return CUSTOMER_TASK_STATUSES.find((item) => item.value === normalizedValue)?.label ?? "Tervezett";
}

export function customerTaskPriorityLabel(value: string | null | undefined) {
  const normalizedValue = normalizeCustomerTaskPriority(value);
  return CUSTOMER_TASK_PRIORITIES.find((item) => item.value === normalizedValue)?.label ?? "Normál";
}

export function isClosedCustomerTaskStatus(value: string | null | undefined) {
  const normalizedValue = normalizeCustomerTaskStatus(value);
  return normalizedValue === "closed";
}
