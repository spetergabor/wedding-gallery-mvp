import "server-only";

import { appBaseUrl, sendCustomerInvoiceEmail } from "@/lib/email";
import {
  INVOICE_TAX_NOTICE,
  formatInvoiceMoney,
  parseInvoiceIssuer,
  parseInvoiceParty
} from "@/lib/customer-invoices";
import { createCustomerInvoicePdf } from "@/lib/customer-invoice-pdf";
import { normalizeCustomerLanguage } from "@/lib/customer-language";
import { prisma } from "@/lib/prisma";
import { createInvoiceObjectKey, getPhotoPublicUrl, savePhotoObject } from "@/lib/storage";

async function generatedInvoiceForDocument(invoiceId: string, adminId?: string) {
  return prisma.customerInvoice.findFirst({
    where: { id: invoiceId, ...(adminId ? { adminId } : {}) },
    include: {
      items: { orderBy: { position: "asc" } },
      payments: { orderBy: { paidAt: "desc" } },
      relatedInvoice: { select: { number: true } },
      customer: { select: { preferredLanguage: true } }
    }
  });
}

function paymentMethodLabel(method: string | null | undefined) {
  if (method === "card") return "Karte";
  if (method === "cash") return "Barzahlung";
  if (method === "bank_transfer") return "Überweisung";
  return "Bezahlt";
}

export async function persistGeneratedInvoicePdf(invoiceId: string, adminId: string) {
  const invoice = await generatedInvoiceForDocument(invoiceId, adminId);
  if (!invoice?.number || !invoice.issueDate || !invoice.dueDate || !invoice.issuerSnapshot ||
      !invoice.customerSnapshot || invoice.totalCents === null || invoice.status === "draft") return null;
  const buffer = await createCustomerInvoicePdf({
    number: invoice.number,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    serviceDateFrom: invoice.serviceDateFrom,
    serviceDateTo: invoice.serviceDateTo,
    currency: invoice.currency,
    taxMode: invoice.taxMode,
    taxNotice: invoice.taxNotice || INVOICE_TAX_NOTICE,
    subtotalCents: invoice.subtotalCents ?? invoice.totalCents,
    taxCents: invoice.taxCents ?? 0,
    totalCents: invoice.totalCents,
    paidCents: invoice.paidCents,
    paidAt: invoice.paidAt,
    paymentMethod: invoice.payments[0]?.method ?? null,
    documentType: invoice.documentType,
    relatedNumber: invoice.relatedInvoice?.number,
    cancellationReason: invoice.cancellationReason,
    issuer: parseInvoiceIssuer(invoice.issuerSnapshot),
    customer: parseInvoiceParty(invoice.customerSnapshot),
    items: invoice.items.map((item) => ({
      description: item.description,
      quantity: Number(item.quantity),
      unit: item.unit,
      unitPriceCents: item.unitPriceCents,
      vatRate: item.vatRate,
      amountCents: item.amountCents
    }))
  });
  const filename = `${invoice.number.replace(/[^a-zA-Z0-9_-]/g, "-")}.pdf`;
  const r2Key = createInvoiceObjectKey({
    customerId: invoice.customerId || `manual-${adminId}`,
    originalFilename: filename
  });
  await savePhotoObject({ r2Key, bytes: buffer, contentType: "application/pdf" });
  const fileUrl = getPhotoPublicUrl(r2Key);
  await prisma.customerInvoice.update({
    where: { id: invoice.id },
    data: { originalFilename: filename, r2Key, fileUrl, fileSize: buffer.length }
  });
  return { buffer, filename, r2Key, fileUrl };
}

export async function deliverGeneratedInvoice(
  invoiceId: string,
  adminId: string,
  type: "invoice" | "reminder" = "invoice"
) {
  const invoice = await generatedInvoiceForDocument(invoiceId, adminId);
  if (!invoice || !invoice.number || invoice.status === "draft" || invoice.status === "cancelled") {
    return "ineligible" as const;
  }
  const party = parseInvoiceParty(invoice.customerSnapshot);
  const recipients = [...new Set([party.email, party.secondaryEmail].filter((email): email is string => Boolean(email)))];
  if (!recipients.length) return "no-email" as const;
  if (!process.env.RESEND_API_KEY) return "unavailable" as const;
  const publicUrl = `${appBaseUrl()}/rechnung/${invoice.publicToken}`;
  const totalCents = invoice.totalCents ?? invoice.amountCents ?? 0;
  const fullyPaid = totalCents > 0 && invoice.paidCents >= totalCents;
  const openAmount = formatInvoiceMoney(
    Math.max(0, totalCents - invoice.paidCents),
    invoice.currency
  );
  const totalAmount = formatInvoiceMoney(totalCents, invoice.currency);
  const payment = invoice.payments[0];
  const paymentDateLabel = (payment?.paidAt ?? invoice.paidAt)?.toLocaleDateString("de-AT", { timeZone: "Europe/Vienna" }) ?? null;
  const paymentLabel = paymentMethodLabel(payment?.method);
  const paymentPhrase = payment?.method === "cash" ? "in bar" : payment?.method === "card" ? "mit Karte" : `per ${paymentLabel}`;
  const dueDateLabel = !fullyPaid && invoice.dueDate
    ? invoice.dueDate.toLocaleDateString("de-AT", { timeZone: "UTC" })
    : null;
  const emailSubject = `${type === "reminder" ? "Zahlungserinnerung" : fullyPaid ? "Zahlungsbestätigung und Rechnung" : "Rechnung"}: ${invoice.number}`;
  const emailMessage = type === "reminder"
    ? `Bitte beachte den noch offenen Betrag von ${openAmount}${dueDateLabel ? ` zur Rechnung mit Fälligkeit ${dueDateLabel}` : ""}.`
    : fullyPaid
      ? `Vielen Dank! Der Gesamtbetrag von ${totalAmount} wurde${paymentDateLabel ? ` am ${paymentDateLabel}` : ""} vor Ort ${paymentPhrase} bezahlt. Es besteht kein offener Betrag.`
      : `Die Rechnung ${invoice.number} ist bereit.`;
  const delivery = await prisma.deliveryLog.create({ data: {
    adminId,
    channel: "email",
    type: type === "reminder" ? "invoice_reminder" : "invoice",
    status: "pending",
    recipient: recipients.join(", "),
    subject: emailSubject,
    provider: "resend",
    entityType: "customer_invoice",
    entityId: invoice.id,
    attemptCount: 1,
    metadata: { publicUrl, invoiceNumber: invoice.number, openAmount, dueDate: dueDateLabel, message: emailMessage }
  } });
  try {
    await sendCustomerInvoiceEmail({
      to: recipients,
      coupleName: party.name,
      invoiceTitle: type === "reminder" ? `Zahlungserinnerung ${invoice.number}` : invoice.number,
      invoiceUrl: publicUrl,
      amountLabel: fullyPaid ? totalAmount : openAmount,
      dueDateLabel,
      subject: emailSubject,
      heading: type === "reminder" ? "Zahlungserinnerung" : fullyPaid ? "Zahlungsbestätigung und Rechnung" : "Rechnung",
      message: emailMessage,
      ctaLabel: type === "reminder" ? "Rechnung öffnen" : undefined,
      language: normalizeCustomerLanguage(invoice.customer?.preferredLanguage ?? "de")
    });
    await prisma.$transaction([
      prisma.deliveryLog.update({ where: { id: delivery.id }, data: { status: "sent", sentAt: new Date() } }),
      prisma.customerInvoice.update({
        where: { id: invoice.id },
        data: type === "invoice"
          ? { status: invoice.status === "final" ? "sent" : invoice.status, sentAt: new Date(), sentTo: recipients.join(", "), emailError: null }
          : { emailError: null }
      })
    ]);
    return "sent" as const;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invoice email failed";
    await prisma.$transaction([
      prisma.deliveryLog.update({ where: { id: delivery.id }, data: { status: "failed", lastError: message } }),
      prisma.customerInvoice.update({ where: { id: invoice.id }, data: { emailError: message } })
    ]);
    return "failed" as const;
  }
}
