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

export function customerStatusLabel(value: string | null | undefined) {
  const normalizedValue = normalizeCustomerStatus(value);
  return CUSTOMER_STATUSES.find((item) => item.value === normalizedValue)?.label ?? "Érdeklődő";
}

export function customerStatusDisplayLabel(
  value: string | null | undefined,
  options: {
    hasKnownWorkDate?: boolean;
    referenceDate?: Date;
    workDate?: Date | null;
  } = {}
) {
  const normalizedValue = normalizeCustomerStatus(value);

  if (normalizedValue === "shoot_done") {
    const referenceDate = options.referenceDate ?? new Date();

    if (options.workDate && options.workDate.getTime() >= referenceDate.getTime()) {
      return "Fotózás előtt";
    }

    if (options.hasKnownWorkDate === false) {
      return "Dátum hiányzik";
    }
  }

  return customerStatusLabel(normalizedValue);
}
