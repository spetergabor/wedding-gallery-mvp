export type CustomerLanguage = "de" | "hu";

export const CUSTOMER_LANGUAGES = [
  { value: "de", label: "Deutsch" },
  { value: "hu", label: "Magyar" }
] as const;

export const CUSTOMER_LOCALES = {
  de: "de-AT",
  hu: "hu-HU"
} as const;

export function normalizeCustomerLanguage(value: string | null | undefined): CustomerLanguage {
  return value === "hu" ? "hu" : "de";
}

export function dateLocaleForCustomer(language?: CustomerLanguage) {
  return CUSTOMER_LOCALES[language ?? "de"];
}

export function customerLanguageLabel(value: string | null | undefined) {
  return CUSTOMER_LANGUAGES.find((item) => item.value === normalizeCustomerLanguage(value))?.label ?? "Deutsch";
}
