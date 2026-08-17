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
