import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const INVOICE_TAX_NOTICE = "Umsatzsteuerbefreit – Kleinunternehmer gem. § 6 Abs. 1 Z 27 UStG";
export const INVOICE_STANDARD_TAX_NOTICE = "Umsatzsteuer gemäß ausgewiesenem Steuersatz.";
export const INVOICE_UNITS = ["Stk", "pauschal", "Std", "UE", "%", "Tag(e)", "m²", "m", "kg", "t", "lfm", "m³", "km", "L"] as const;
export const INVOICE_VAT_RATES = [10, 13, 20] as const;

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

export type InvoiceSettings = {
  invoicePrefix: string;
  invoiceCancellationPrefix: string;
  invoiceSequenceStart: number;
  invoiceDueDays: number;
  invoiceTaxMode: string;
  invoiceDefaultVatRate: number;
  invoiceRemindersEnabled: boolean;
  invoiceReminderDaysBefore: number;
  invoiceOverdueDays: number;
  invoiceFollowupDays: number;
};

export function formatInvoiceMoney(cents: number, currency = "EUR", locale = "de-AT") {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(cents / 100);
}

export function formatInvoiceDate(value: Date) {
  return new Intl.DateTimeFormat("de-AT", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(value);
}

export function inputDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function invoiceDate(value: string) {
  return new Date(`${value}T12:00:00.000Z`);
}

export function createInvoicePublicToken() {
  return randomBytes(24).toString("base64url");
}

export function createDraftInvoiceNumber() {
  return `ENTWURF-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

export function parseInvoiceParty(value: unknown): InvoiceParty {
  const data = record(value);
  return {
    name: stringValue(data.name),
    email: stringValue(data.email) || null,
    secondaryEmail: stringValue(data.secondaryEmail) || null,
    addressLine1: stringValue(data.addressLine1) || null,
    postalCode: stringValue(data.postalCode) || null,
    city: stringValue(data.city) || null,
    country: stringValue(data.country) || null,
    uid: stringValue(data.uid) || null
  };
}

export function parseInvoiceIssuer(value: unknown): InvoiceIssuer {
  const data = record(value);
  return {
    name: stringValue(data.name),
    addressLine1: stringValue(data.addressLine1),
    postalCode: stringValue(data.postalCode),
    city: stringValue(data.city),
    country: stringValue(data.country, "Österreich"),
    iban: stringValue(data.iban),
    bic: stringValue(data.bic) || null,
    taxNumber: stringValue(data.taxNumber),
    uid: stringValue(data.uid) || null
  };
}

export async function loadInvoiceWorkspaceSettings(adminId: string) {
  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
    select: {
      id: true,
      name: true,
      legalName: true,
      addressLine: true,
      postalCode: true,
      city: true,
      country: true,
      taxNumber: true,
      siteSettings: true
    }
  });
  if (!admin) return null;
  const settings = admin.siteSettings;
  const issuer: InvoiceIssuer = {
    name: settings?.invoiceName?.trim() || admin.legalName?.trim() || admin.name,
    addressLine1: settings?.invoiceAddressLine1?.trim() || admin.addressLine?.trim() || "",
    postalCode: settings?.invoicePostalCode?.trim() || admin.postalCode?.trim() || "",
    city: settings?.invoiceCity?.trim() || admin.city?.trim() || "",
    country: settings?.invoiceCountry?.trim() || admin.country?.trim() || "Österreich",
    iban: settings?.invoiceIban?.trim() || "",
    bic: settings?.invoiceBic?.trim() || null,
    taxNumber: settings?.invoiceTaxNumber?.trim() || admin.taxNumber?.trim() || "",
    uid: settings?.invoiceUid?.trim() || null
  };
  const invoiceSettings: InvoiceSettings = {
    invoicePrefix: settings?.invoicePrefix?.trim() || "RE",
    invoiceCancellationPrefix: settings?.invoiceCancellationPrefix?.trim() || "ST",
    invoiceSequenceStart: settings?.invoiceSequenceStart ?? 1,
    invoiceDueDays: settings?.invoiceDueDays ?? 14,
    invoiceTaxMode: settings?.invoiceTaxMode === "taxable" ? "taxable" : "small_business",
    invoiceDefaultVatRate: INVOICE_VAT_RATES.includes((settings?.invoiceDefaultVatRate ?? 20) as 10 | 13 | 20) ? settings?.invoiceDefaultVatRate ?? 20 : 20,
    invoiceRemindersEnabled: settings?.invoiceRemindersEnabled ?? false,
    invoiceReminderDaysBefore: settings?.invoiceReminderDaysBefore ?? 3,
    invoiceOverdueDays: settings?.invoiceOverdueDays ?? 1,
    invoiceFollowupDays: settings?.invoiceFollowupDays ?? 7
  };
  return { admin, settings, issuer, invoiceSettings };
}

export function missingIssuerFields(issuer: InvoiceIssuer, taxMode: string) {
  const missing = [
    ["Kibocsátó neve", issuer.name],
    ["Cím", issuer.addressLine1],
    ["Irányítószám", issuer.postalCode],
    ["Város", issuer.city],
    ["Ország", issuer.country],
    ["IBAN", issuer.iban],
    ["Steuernummer", issuer.taxNumber]
  ].filter(([, value]) => !value).map(([label]) => label);
  if (taxMode === "taxable" && !issuer.uid) missing.push("UID");
  return missing;
}

export async function allocateInvoiceNumber(
  tx: Prisma.TransactionClient,
  input: { adminId: string; issueDate: Date; kind: "invoice" | "cancellation"; prefix: string; sequenceStart: number }
) {
  const year = input.issueDate.getUTCFullYear();
  const prefix = input.prefix.trim() || (input.kind === "cancellation" ? "ST" : "RE");
  const numberPrefix = `${prefix}-${year}-`;
  const existing = await tx.customerInvoice.findMany({
    where: { adminId: input.adminId, number: { startsWith: numberPrefix } },
    select: { number: true }
  });
  const highest = existing.reduce((max, row) => {
    const value = Number(row.number?.slice(numberPrefix.length));
    return Number.isInteger(value) ? Math.max(max, value) : max;
  }, 0);
  const seed = Math.max(highest + 1, Math.max(1, input.sequenceStart));
  const sequenceId = `${input.adminId}:${year}:${input.kind}`;
  const rows = await tx.$queryRaw<Array<{ value: number }>>`
    INSERT INTO "InvoiceNumberSequence" ("id", "adminId", "year", "kind", "nextValue", "createdAt", "updatedAt")
    VALUES (${sequenceId}, ${input.adminId}, ${year}, ${input.kind}, ${seed + 1}, NOW(), NOW())
    ON CONFLICT ("adminId", "year", "kind") DO UPDATE
    SET "nextValue" = GREATEST("InvoiceNumberSequence"."nextValue", ${seed}) + 1,
        "updatedAt" = NOW()
    RETURNING "nextValue" - 1 AS value
  `;
  const value = Number(rows[0]?.value ?? seed);
  return `${numberPrefix}${String(value).padStart(3, "0")}`;
}

export function invoiceStatusLabel(status: string, documentType = "invoice") {
  if (documentType === "cancellation") return "Sztornóbizonylat";
  return ({ draft: "Piszkozat", open: "Nyitott", final: "Végleges", sent: "Elküldött", partial: "Részben fizetett", paid: "Fizetett", cancelled: "Sztornózott" } as Record<string, string>)[status] ?? status;
}

export function invoiceTitle(documentType: string) {
  return documentType === "cancellation" ? "Stornorechnung" : documentType === "correction" ? "Berichtigte Rechnung" : "Rechnung";
}
