"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ownerAdminId } from "@/lib/admin-scope";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function value(formData: FormData, key: string) { const item = formData.get(key); return typeof item === "string" ? item.trim() : ""; }
function number(formData: FormData, key: string, fallback: number, min: number, max: number) { const parsed = Number.parseInt(value(formData, key), 10); return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback; }

export async function saveInvoiceSettingsAction(formData: FormData) {
  const session = await requireAdmin();
  const adminId = ownerAdminId(session);
  const prefix = value(formData, "invoicePrefix").toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 12) || "RE";
  const cancellationPrefix = value(formData, "invoiceCancellationPrefix").toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 12) || "ST";
  const data = {
    invoiceName: value(formData, "invoiceName") || null,
    invoiceAddressLine1: value(formData, "invoiceAddressLine1") || null,
    invoicePostalCode: value(formData, "invoicePostalCode") || null,
    invoiceCity: value(formData, "invoiceCity") || null,
    invoiceCountry: value(formData, "invoiceCountry") || "Österreich",
    invoiceIban: value(formData, "invoiceIban") || null,
    invoiceBic: value(formData, "invoiceBic") || null,
    invoiceTaxNumber: value(formData, "invoiceTaxNumber") || null,
    invoiceUid: value(formData, "invoiceUid") || null,
    invoicePrefix: prefix,
    invoiceCancellationPrefix: cancellationPrefix,
    invoiceSequenceStart: number(formData, "invoiceSequenceStart", 1, 1, 999999),
    invoiceDueDays: number(formData, "invoiceDueDays", 14, 0, 365),
    invoiceTaxMode: value(formData, "invoiceTaxMode") === "taxable" ? "taxable" : "small_business",
    invoiceDefaultVatRate: [10, 13, 20].includes(number(formData, "invoiceDefaultVatRate", 20, 10, 20)) ? number(formData, "invoiceDefaultVatRate", 20, 10, 20) : 20,
    invoiceRemindersEnabled: formData.get("invoiceRemindersEnabled") === "on",
    invoiceReminderDaysBefore: number(formData, "invoiceReminderDaysBefore", 3, 0, 90),
    invoiceOverdueDays: number(formData, "invoiceOverdueDays", 1, 0, 90),
    invoiceFollowupDays: number(formData, "invoiceFollowupDays", 7, 1, 180)
  };
  await prisma.siteSettings.upsert({ where: { adminId }, create: { id: adminId, adminId, businessName: "", ...data }, update: data });
  revalidatePath("/admin/settings/invoices");
  revalidatePath("/admin/invoices");
  redirect("/admin/settings/invoices?saved=1");
}

export async function createInvoiceIssuerProfileAction(formData: FormData) {
  const session = await requireAdmin();
  const adminId = ownerAdminId(session);
  const label = value(formData, "label").slice(0, 100);
  const name = value(formData, "name").slice(0, 200);
  const addressLine1 = value(formData, "addressLine1").slice(0, 250);
  const postalCode = value(formData, "postalCode").slice(0, 30);
  const city = value(formData, "city").slice(0, 120);
  const country = value(formData, "country").slice(0, 120) || "Österreich";
  const iban = value(formData, "iban").replace(/\s+/g, " ").slice(0, 80);
  const taxNumber = value(formData, "taxNumber").slice(0, 80);
  if (!label || !name || !addressLine1 || !postalCode || !city || !iban || !taxNumber) {
    redirect("/admin/settings/invoices?issuerError=missing");
  }
  const prefix = value(formData, "invoicePrefix").toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 12) || "RE";
  const cancellationPrefix = value(formData, "invoiceCancellationPrefix").toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 12) || "ST";
  try {
    await prisma.invoiceIssuerProfile.create({ data: {
      adminId,
      label,
      name,
      addressLine1,
      postalCode,
      city,
      country,
      iban,
      bic: value(formData, "bic").slice(0, 50) || null,
      taxNumber,
      uid: value(formData, "uid").slice(0, 80) || null,
      invoicePrefix: prefix,
      invoiceCancellationPrefix: cancellationPrefix,
      invoiceSequenceStart: number(formData, "invoiceSequenceStart", 1, 1, 999999),
      invoiceDueDays: number(formData, "invoiceDueDays", 14, 0, 365),
      invoiceTaxMode: value(formData, "invoiceTaxMode") === "taxable" ? "taxable" : "small_business",
      invoiceDefaultVatRate: [10, 13, 20].includes(number(formData, "invoiceDefaultVatRate", 20, 10, 20))
        ? number(formData, "invoiceDefaultVatRate", 20, 10, 20) : 20
    } });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
      redirect("/admin/settings/invoices?issuerError=duplicate");
    }
    throw error;
  }
  revalidatePath("/admin/settings/invoices");
  revalidatePath("/admin/invoices/new");
  redirect("/admin/settings/invoices?issuerSaved=1");
}
