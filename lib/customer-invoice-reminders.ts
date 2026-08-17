import { deliverGeneratedInvoice } from "@/lib/generated-invoice-actions";
import { prisma } from "@/lib/prisma";

function startOfUtcDay(date = new Date()) { return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())); }
function addDays(date: Date, days: number) { return new Date(date.getTime() + days * 86_400_000); }

export async function runCustomerInvoiceReminders(now = new Date()) {
  const today = startOfUtcDay(now);
  const invoices = await prisma.customerInvoice.findMany({
    where: { status: { in: ["final", "sent", "partial"] }, documentType: { not: "cancellation" }, remindersEnabled: true, number: { not: null }, dueDate: { not: null }, admin: { siteSettings: { invoiceRemindersEnabled: true } } },
    include: { admin: { select: { siteSettings: true } } },
    orderBy: { dueDate: "asc" },
    take: 500
  });
  const result = { checked: invoices.length, sent: 0, failed: 0, skipped: 0 };
  for (const invoice of invoices) {
    if (!invoice.dueDate || (invoice.totalCents ?? invoice.amountCents ?? 0) <= invoice.paidCents) { result.skipped++; continue; }
    const settings = invoice.admin.siteSettings;
    if (!settings) { result.skipped++; continue; }
    let field: "preDueReminderSentAt" | "overdueReminderSentAt" | "followupReminderSentAt" | null = null;
    if (invoice.dueDate < today) {
      if (!invoice.overdueReminderSentAt && invoice.dueDate <= addDays(today, -settings.invoiceOverdueDays)) field = "overdueReminderSentAt";
      else if (invoice.overdueReminderSentAt && !invoice.followupReminderSentAt && invoice.dueDate <= addDays(today, -settings.invoiceFollowupDays)) field = "followupReminderSentAt";
    } else if (!invoice.preDueReminderSentAt && invoice.dueDate <= addDays(today, settings.invoiceReminderDaysBefore)) field = "preDueReminderSentAt";
    if (!field) { result.skipped++; continue; }
    const claimed = await prisma.customerInvoice.updateMany({ where: { id: invoice.id, adminId: invoice.adminId, [field]: null, status: { in: ["final", "sent", "partial"] } }, data: { [field]: now } });
    if (!claimed.count) { result.skipped++; continue; }
    const delivery = await deliverGeneratedInvoice(invoice.id, invoice.adminId, "reminder");
    if (delivery === "sent") result.sent++;
    else {
      await prisma.customerInvoice.update({ where: { id: invoice.id }, data: { [field]: null } });
      if (delivery === "failed") result.failed++; else result.skipped++;
    }
  }
  return result;
}
