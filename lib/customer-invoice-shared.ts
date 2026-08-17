export const INVOICE_TAX_NOTICE = "Umsatzsteuerbefreit – Kleinunternehmer gem. § 6 Abs. 1 Z 27 UStG";
export const INVOICE_STANDARD_TAX_NOTICE = "Umsatzsteuer gemäß ausgewiesenem Steuersatz.";

export type InvoiceParty = {
  name: string;
  email?: string | null;
  secondaryEmail?: string | null;
  addressLine1?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
  uid?: string | null;
};

export type InvoiceIssuer = {
  name: string;
  addressLine1: string;
  postalCode: string;
  city: string;
  country: string;
  iban: string;
  bic?: string | null;
  taxNumber: string;
  uid?: string | null;
};

export function formatInvoiceMoney(cents: number, currency = "EUR", locale = "de-AT") {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(cents / 100);
}

export function formatInvoiceDate(value: Date) {
  return new Intl.DateTimeFormat("de-AT", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(value);
}

export function invoiceTitle(documentType: string) {
  return documentType === "cancellation" ? "Stornorechnung" : documentType === "correction" ? "Berichtigte Rechnung" : "Rechnung";
}
