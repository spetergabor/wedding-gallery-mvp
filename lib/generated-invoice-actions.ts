"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { appBaseUrl, sendCustomerInvoiceEmail } from "@/lib/email";
import { ownerAdminId } from "@/lib/admin-scope";
import { requireAdmin } from "@/lib/auth";
import {
  INVOICE_STANDARD_TAX_NOTICE,
  INVOICE_TAX_NOTICE,
  INVOICE_UNITS,
  INVOICE_VAT_RATES,
  allocateInvoiceNumber,
  createDraftInvoiceNumber,
  createInvoicePublicToken,
  formatInvoiceMoney,
  invoiceDate,
  loadInvoiceWorkspaceSettings,
  missingIssuerFields,
  parseInvoiceIssuer,
  parseInvoiceParty
} from "@/lib/customer-invoices";
import { createCustomerInvoicePdf } from "@/lib/customer-invoice-pdf";
import { normalizeCustomerLanguage } from "@/lib/customer-language";
import { prisma } from "@/lib/prisma";
import { createInvoiceObjectKey, getPhotoPublicUrl, savePhotoObject } from "@/lib/storage";

export type GeneratedInvoiceActionState = { error?: string };

type ParsedItem = {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  vatRate: number;
};

function value(formData: FormData, key: string) {
  const item = formData.get(key);
  return typeof item === "string" ? item.trim() : "";
}

function parseItems(raw: string): ParsedItem[] | null {
  try {
    const items = JSON.parse(raw) as unknown;
    if (!Array.isArray(items) || items.length < 1 || items.length > 100) return null;
    return items.map((row) => {
      if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error("invalid");
      const item = row as Record<string, unknown>;
      const description = typeof item.description === "string" ? item.description.trim() : "";
      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unitPrice);
      const unit = typeof item.unit === "string" ? item.unit : "";
      const vatRate = Number(item.vatRate);
      if (!description || description.length > 500 || !Number.isFinite(quantity) || quantity <= 0 || quantity > 9999 || !Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > 10_000_000 || !INVOICE_UNITS.includes(unit as (typeof INVOICE_UNITS)[number]) || !INVOICE_VAT_RATES.includes(vatRate as 10 | 13 | 20)) throw new Error("invalid");
      return { description, quantity, unit, unitPrice, vatRate };
    });
  } catch {
    return null;
  }
}

function calculateItems(items: ParsedItem[], taxMode: "small_business" | "taxable") {
  const calculated = items.map((item, position) => {
    const unitPriceCents = Math.round(item.unitPrice * 100);
    const netAmountCents = Math.round(item.quantity * unitPriceCents);
    const vatRate = taxMode === "taxable" ? item.vatRate : 0;
    const taxAmountCents = Math.round(netAmountCents * vatRate / 100);
    return {
      position,
      description: item.description,
      quantity: new Prisma.Decimal(item.quantity),
      unit: item.unit,
      unitPriceCents,
      vatRate,
      netAmountCents,
      taxAmountCents,
      amountCents: netAmountCents + taxAmountCents
    };
  });
  const subtotalCents = calculated.reduce((sum, item) => sum + item.netAmountCents, 0);
  const taxCents = calculated.reduce((sum, item) => sum + item.taxAmountCents, 0);
  return { calculated, subtotalCents, taxCents, totalCents: subtotalCents + taxCents };
}

function invoicePath(id: string, result?: string) {
  return `/admin/invoices/${id}${result ? `?result=${encodeURIComponent(result)}` : ""}`;
}

function validDateInput(raw: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(raw);
}

async function invoiceFormData(adminId: string, formData: FormData) {
  const customerIdInput = value(formData, "customerId");
  const projectIdInput = value(formData, "projectId");
  const customerName = value(formData, "customerName");
  const customerEmail = value(formData, "customerEmail").toLowerCase();
  const secondaryEmail = value(formData, "secondaryEmail").toLowerCase();
  const issueDateInput = value(formData, "issueDate");
  const dueDateInput = value(formData, "dueDate");
  const serviceDateFromInput = value(formData, "serviceDateFrom");
  const serviceDateToInput = value(formData, "serviceDateTo");
  const taxMode = value(formData, "taxMode") === "taxable" ? "taxable" as const : "small_business" as const;
  const intentInput = value(formData, "intent");
  const intent = intentInput === "send" ? "send" as const : intentInput === "finalize" ? "finalize" as const : "draft" as const;
  const items = parseItems(value(formData, "itemsJson"));
  if (customerName.length < 2) return { error: "Add meg az ügyfél nevét." } as const;
  if (customerEmail && !/^\S+@\S+\.\S+$/.test(customerEmail)) return { error: "Ellenőrizd az ügyfél e-mail-címét." } as const;
  if (secondaryEmail && !/^\S+@\S+\.\S+$/.test(secondaryEmail)) return { error: "Ellenőrizd a másodlagos e-mail-címet." } as const;
  if (intent === "send" && !customerEmail && !secondaryEmail) return { error: "E-mailes küldéshez add meg az ügyfél e-mail-címét." } as const;
  if (![issueDateInput, dueDateInput, serviceDateFromInput, serviceDateToInput].every(validDateInput)) return { error: "Ellenőrizd a számla dátumait." } as const;
  if (!items) return { error: "Ellenőrizd a számlatételeket." } as const;
  const issueDate = invoiceDate(issueDateInput);
  const dueDate = invoiceDate(dueDateInput);
  const serviceDateFrom = invoiceDate(serviceDateFromInput);
  const serviceDateTo = invoiceDate(serviceDateToInput);
  if (dueDate < issueDate) return { error: "A fizetési határidő nem lehet korábbi a számla dátumánál." } as const;
  if (serviceDateTo < serviceDateFrom) return { error: "A teljesítési időszak vége nem lehet korábbi a kezdeténél." } as const;

  const customer = customerIdInput ? await prisma.customer.findFirst({ where: { id: customerIdInput, adminId }, select: { id: true, primaryEmail: true, secondaryEmail: true, preferredLanguage: true } }) : null;
  if (customerIdInput && !customer) return { error: "A kiválasztott ügyfél nem található ebben a workspace-ben." } as const;
  const project = projectIdInput ? await prisma.customerProject.findFirst({ where: { id: projectIdInput, customer: { adminId } }, select: { id: true, customerId: true } }) : null;
  if (projectIdInput && !project) return { error: "A kiválasztott projekt nem található ebben a workspace-ben." } as const;
  if (project && customer && project.customerId !== customer.id) return { error: "A projekt nem a kiválasztott ügyfélhez tartozik." } as const;
  if (project && !customer) return { error: "Projekthez kapcsoláshoz válassz Spetly-ügyfelet." } as const;

  const party = {
    name: customerName,
    email: customerEmail || null,
    secondaryEmail: secondaryEmail || null,
    addressLine1: value(formData, "addressLine1") || null,
    postalCode: value(formData, "postalCode") || null,
    city: value(formData, "city") || null,
    country: value(formData, "country") || null,
    uid: value(formData, "customerUid") || null
  };
  const calculated = calculateItems(items, taxMode);
  if (intent !== "draft" && calculated.totalCents > 1_000_000 && !party.uid) return { error: "10 000 EUR feletti számlához add meg az ügyfél UID-számát." } as const;
  return {
    error: null,
    customer,
    customerId: customer?.id ?? null,
    projectId: project?.id ?? null,
    preferredLanguage: customer?.preferredLanguage ?? "de",
    party,
    issueDate,
    dueDate,
    serviceDateFrom,
    serviceDateTo,
    taxMode,
    intent,
    notes: value(formData, "notes") || null,
    ...calculated
  } as const;
}

async function generatedInvoiceForDocument(invoiceId: string, adminId?: string) {
  return prisma.customerInvoice.findFirst({
    where: { id: invoiceId, ...(adminId ? { adminId } : {}) },
    include: { items: { orderBy: { position: "asc" } }, relatedInvoice: { select: { number: true } }, customer: { select: { preferredLanguage: true } } }
  });
}

export async function persistGeneratedInvoicePdf(invoiceId: string, adminId: string) {
  const invoice = await generatedInvoiceForDocument(invoiceId, adminId);
  if (!invoice?.number || !invoice.issueDate || !invoice.dueDate || !invoice.issuerSnapshot || !invoice.customerSnapshot || invoice.totalCents === null || invoice.status === "draft") return null;
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
    documentType: invoice.documentType,
    relatedNumber: invoice.relatedInvoice?.number,
    cancellationReason: invoice.cancellationReason,
    issuer: parseInvoiceIssuer(invoice.issuerSnapshot),
    customer: parseInvoiceParty(invoice.customerSnapshot),
    items: invoice.items.map((item) => ({ description: item.description, quantity: Number(item.quantity), unit: item.unit, unitPriceCents: item.unitPriceCents, vatRate: item.vatRate, amountCents: item.amountCents }))
  });
  const filename = `${invoice.number.replace(/[^a-zA-Z0-9_-]/g, "-")}.pdf`;
  const r2Key = createInvoiceObjectKey({ customerId: invoice.customerId || `manual-${adminId}`, originalFilename: filename });
  await savePhotoObject({ r2Key, bytes: buffer, contentType: "application/pdf" });
  const fileUrl = getPhotoPublicUrl(r2Key);
  await prisma.customerInvoice.update({ where: { id: invoice.id }, data: { originalFilename: filename, r2Key, fileUrl, fileSize: buffer.length } });
  return { buffer, filename, r2Key, fileUrl };
}

export async function deliverGeneratedInvoice(invoiceId: string, adminId: string, type: "invoice" | "reminder" = "invoice") {
  const invoice = await generatedInvoiceForDocument(invoiceId, adminId);
  if (!invoice || !invoice.number || invoice.status === "draft" || invoice.status === "cancelled") return "ineligible" as const;
  const party = parseInvoiceParty(invoice.customerSnapshot);
  const recipients = [...new Set([party.email, party.secondaryEmail].filter((email): email is string => Boolean(email)))];
  if (!recipients.length) return "no-email" as const;
  if (!process.env.RESEND_API_KEY) return "unavailable" as const;
  const publicUrl = `${appBaseUrl()}/rechnung/${invoice.publicToken}`;
  const openAmount = formatInvoiceMoney(Math.max(0, (invoice.totalCents ?? invoice.amountCents ?? 0) - invoice.paidCents), invoice.currency);
  const dueDateLabel = invoice.dueDate ? invoice.dueDate.toLocaleDateString("de-AT", { timeZone: "UTC" }) : null;
  const emailSubject = `${type === "reminder" ? "Zahlungserinnerung" : "Rechnung"}: ${invoice.number}`;
  const emailMessage = type === "reminder"
    ? `Bitte beachte den noch offenen Betrag von ${openAmount}${dueDateLabel ? ` zur Rechnung mit Fälligkeit ${dueDateLabel}` : ""}.`
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
      amountLabel: openAmount,
      dueDateLabel,
      subject: emailSubject,
      heading: type === "reminder" ? "Zahlungserinnerung" : "Rechnung",
      message: emailMessage,
      ctaLabel: type === "reminder" ? "Rechnung öffnen" : undefined,
      language: normalizeCustomerLanguage(invoice.customer?.preferredLanguage ?? "de")
    });
    await prisma.$transaction([
      prisma.deliveryLog.update({ where: { id: delivery.id }, data: { status: "sent", sentAt: new Date() } }),
      prisma.customerInvoice.update({ where: { id: invoice.id }, data: type === "invoice" ? { status: invoice.status === "final" ? "sent" : invoice.status, sentAt: new Date(), sentTo: recipients.join(", "), emailError: null } : { emailError: null } })
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

async function finalizeStoredInvoice(invoiceId: string, adminId: string) {
  const workspace = await loadInvoiceWorkspaceSettings(adminId);
  if (!workspace) return { error: "A workspace nem található." };
  const invoice = await prisma.customerInvoice.findFirst({ where: { id: invoiceId, adminId, status: "draft" }, select: { id: true, issueDate: true, taxMode: true, totalCents: true, customerSnapshot: true, documentType: true } });
  if (!invoice?.issueDate || invoice.totalCents === null) return { error: "A piszkozat nem véglegesíthető." };
  const missing = missingIssuerFields(workspace.issuer, invoice.taxMode);
  if (missing.length) return { error: `A Beállítások / Számlázás részben töltsd ki: ${missing.join(", ")}.` };
  const party = parseInvoiceParty(invoice.customerSnapshot);
  if (invoice.totalCents > 1_000_000 && !party.uid) return { error: "10 000 EUR feletti számlához add meg az ügyfél UID-számát." };
  try {
    const number = await prisma.$transaction(async (tx) => {
      const official = await allocateInvoiceNumber(tx, {
        adminId,
        issueDate: invoice.issueDate!,
        kind: "invoice",
        prefix: workspace.invoiceSettings.invoicePrefix,
        sequenceStart: workspace.invoiceSettings.invoiceSequenceStart
      });
      const changed = await tx.customerInvoice.updateMany({ where: { id: invoice.id, adminId, status: "draft" }, data: { number: official, title: `${invoice.documentType === "correction" ? "Berichtigte Rechnung" : "Rechnung"} ${official}`, status: "final", finalizedAt: new Date(), issuerSnapshot: workspace.issuer } });
      if (changed.count !== 1) throw new Error("INVOICE_ALREADY_FINALIZED");
      return official;
    });
    await persistGeneratedInvoicePdf(invoice.id, adminId).catch((error) => console.error("Invoice PDF persistence failed", error));
    return { number };
  } catch (error) {
    if (error instanceof Error && error.message === "INVOICE_ALREADY_FINALIZED") return { error: "A számla időközben már véglegesítve lett." };
    throw error;
  }
}

export async function saveGeneratedInvoiceAction(_: GeneratedInvoiceActionState, formData: FormData): Promise<GeneratedInvoiceActionState> {
  const session = await requireAdmin();
  const adminId = ownerAdminId(session);
  const parsed = await invoiceFormData(adminId, formData);
  if (parsed.error) return { error: parsed.error };
  const workspace = await loadInvoiceWorkspaceSettings(adminId);
  if (!workspace) return { error: "A workspace nem található." };
  if (parsed.intent !== "draft") {
    const missing = missingIssuerFields(workspace.issuer, parsed.taxMode);
    if (missing.length) return { error: `A Beállítások / Számlázás részben töltsd ki: ${missing.join(", ")}.` };
  }
  const draftNumber = createDraftInvoiceNumber();
  const invoice = await prisma.$transaction(async (tx) => {
    let number = draftNumber;
    if (parsed.intent !== "draft") {
      number = await allocateInvoiceNumber(tx, { adminId, issueDate: parsed.issueDate, kind: "invoice", prefix: workspace.invoiceSettings.invoicePrefix, sequenceStart: workspace.invoiceSettings.invoiceSequenceStart });
    }
    return tx.customerInvoice.create({ data: {
      adminId,
      customerId: parsed.customerId,
      projectId: parsed.projectId,
      title: `${parsed.intent === "draft" ? "Piszkozat" : "Rechnung"} ${number}`,
      status: parsed.intent === "draft" ? "draft" : "final",
      number,
      issueDate: parsed.issueDate,
      dueDate: parsed.dueDate,
      serviceDateFrom: parsed.serviceDateFrom,
      serviceDateTo: parsed.serviceDateTo,
      currency: "EUR",
      taxMode: parsed.taxMode,
      issuerSnapshot: workspace.issuer,
      customerSnapshot: parsed.party,
      taxNotice: parsed.taxMode === "taxable" ? INVOICE_STANDARD_TAX_NOTICE : INVOICE_TAX_NOTICE,
      subtotalCents: parsed.subtotalCents,
      taxCents: parsed.taxCents,
      totalCents: parsed.totalCents,
      amountCents: parsed.totalCents,
      publicToken: createInvoicePublicToken(),
      finalizedAt: parsed.intent === "draft" ? null : new Date(),
      notes: parsed.notes,
      items: { create: parsed.calculated }
    }, select: { id: true } });
  });
  if (parsed.intent !== "draft") await persistGeneratedInvoicePdf(invoice.id, adminId).catch((error) => console.error("Invoice PDF persistence failed", error));
  const result = parsed.intent === "send" ? await deliverGeneratedInvoice(invoice.id, adminId) : parsed.intent === "finalize" ? "finalized" : "saved";
  revalidatePath("/admin/invoices");
  redirect(invoicePath(invoice.id, result));
}

export async function updateGeneratedInvoiceAction(invoiceId: string, _: GeneratedInvoiceActionState, formData: FormData): Promise<GeneratedInvoiceActionState> {
  const session = await requireAdmin();
  const adminId = ownerAdminId(session);
  const current = await prisma.customerInvoice.findFirst({ where: { id: invoiceId, adminId, status: "draft" }, select: { id: true, documentType: true } });
  if (!current) return { error: "Csak piszkozat szerkeszthető." };
  const parsed = await invoiceFormData(adminId, formData);
  if (parsed.error) return { error: parsed.error };
  const workspace = await loadInvoiceWorkspaceSettings(adminId);
  if (!workspace) return { error: "A workspace nem található." };
  if (parsed.intent !== "draft") {
    const missing = missingIssuerFields(workspace.issuer, parsed.taxMode);
    if (missing.length) return { error: `A Beállítások / Számlázás részben töltsd ki: ${missing.join(", ")}.` };
  }
  await prisma.$transaction(async (tx) => {
    const changed = await tx.customerInvoice.updateMany({ where: { id: invoiceId, adminId, status: "draft" }, data: {
      customerId: parsed.customerId,
      projectId: parsed.projectId,
      issueDate: parsed.issueDate,
      dueDate: parsed.dueDate,
      serviceDateFrom: parsed.serviceDateFrom,
      serviceDateTo: parsed.serviceDateTo,
      taxMode: parsed.taxMode,
      issuerSnapshot: workspace.issuer,
      customerSnapshot: parsed.party,
      taxNotice: parsed.taxMode === "taxable" ? INVOICE_STANDARD_TAX_NOTICE : INVOICE_TAX_NOTICE,
      subtotalCents: parsed.subtotalCents,
      taxCents: parsed.taxCents,
      totalCents: parsed.totalCents,
      amountCents: parsed.totalCents,
      notes: parsed.notes
    } });
    if (changed.count !== 1) throw new Error("INVOICE_LOCKED");
    await tx.customerInvoiceItem.deleteMany({ where: { invoiceId } });
    await tx.customerInvoiceItem.createMany({ data: parsed.calculated.map((item) => ({ invoiceId, ...item })) });
  });
  let result: string = "updated";
  if (parsed.intent !== "draft") {
    const finalized = await finalizeStoredInvoice(invoiceId, adminId);
    if (finalized.error) return { error: finalized.error };
    result = parsed.intent === "send" ? await deliverGeneratedInvoice(invoiceId, adminId) : "finalized";
  }
  revalidatePath("/admin/invoices");
  redirect(invoicePath(invoiceId, result));
}

export async function finalizeGeneratedInvoiceAction(invoiceId: string) {
  const session = await requireAdmin();
  const adminId = ownerAdminId(session);
  const result = await finalizeStoredInvoice(invoiceId, adminId);
  revalidatePath("/admin/invoices");
  revalidatePath(`/admin/invoices/${invoiceId}`);
  redirect(invoicePath(invoiceId, result.error ? `error:${result.error}` : "finalized"));
}

export async function sendGeneratedInvoiceEmailAction(invoiceId: string) {
  const session = await requireAdmin();
  const result = await deliverGeneratedInvoice(invoiceId, ownerAdminId(session));
  revalidatePath("/admin/invoices");
  revalidatePath(`/admin/invoices/${invoiceId}`);
  redirect(invoicePath(invoiceId, result));
}

export async function recordGeneratedInvoicePaymentAction(invoiceId: string, formData: FormData) {
  const session = await requireAdmin();
  const adminId = ownerAdminId(session);
  const normalized = value(formData, "amount").replace(/\s/g, "").replace(",", ".");
  const amountCents = Math.round(Number(normalized) * 100);
  const paidAtInput = value(formData, "paidAt");
  const method = ["bank_transfer", "cash", "card", "other"].includes(value(formData, "method")) ? value(formData, "method") : "other";
  const invoice = await prisma.customerInvoice.findFirst({ where: { id: invoiceId, adminId }, select: { id: true, status: true, documentType: true, totalCents: true, amountCents: true, paidCents: true } });
  const total = invoice?.totalCents ?? invoice?.amountCents ?? 0;
  const outstanding = Math.max(0, total - (invoice?.paidCents ?? 0));
  if (!invoice || ["draft", "cancelled"].includes(invoice.status) || invoice.documentType === "cancellation" || !validDateInput(paidAtInput) || !Number.isFinite(amountCents) || amountCents <= 0 || amountCents > outstanding) redirect(invoicePath(invoiceId, "payment-invalid"));
  const nextPaid = invoice.paidCents + amountCents;
  await prisma.$transaction([
    prisma.customerInvoicePayment.create({ data: { invoiceId, amountCents, paidAt: invoiceDate(paidAtInput), method, note: value(formData, "note") || null } }),
    prisma.customerInvoice.update({ where: { id: invoiceId }, data: { paidCents: nextPaid, paidAt: nextPaid >= total ? invoiceDate(paidAtInput) : null, status: nextPaid >= total ? "paid" : "partial" } })
  ]);
  revalidatePath("/admin/invoices");
  redirect(invoicePath(invoiceId, "payment"));
}

export async function setGeneratedInvoicePaidAction(invoiceId: string, paid: boolean, formData: FormData) {
  const session = await requireAdmin();
  const adminId = ownerAdminId(session);
  const invoice = await prisma.customerInvoice.findFirst({ where: { id: invoiceId, adminId }, select: { id: true, status: true, documentType: true, totalCents: true, amountCents: true, paidCents: true, sentAt: true } });
  if (!invoice || ["draft", "cancelled"].includes(invoice.status) || invoice.documentType === "cancellation") redirect(invoicePath(invoiceId, "unchanged"));
  const total = invoice.totalCents ?? invoice.amountCents ?? 0;
  await prisma.$transaction(async (tx) => {
    if (!paid) await tx.customerInvoicePayment.deleteMany({ where: { invoiceId } });
    if (paid && invoice.paidCents < total) await tx.customerInvoicePayment.create({ data: { invoiceId, amountCents: total - invoice.paidCents, paidAt: new Date(), method: "bank_transfer", note: "Fennmaradó összeg fizetettként megjelölve" } });
    await tx.customerInvoice.update({ where: { id: invoiceId }, data: { paidCents: paid ? total : 0, paidAt: paid ? new Date() : null, status: paid ? "paid" : invoice.sentAt ? "sent" : "final" } });
  });
  revalidatePath("/admin/invoices");
  const returnTo = value(formData, "returnTo");
  redirect(returnTo === "/admin/invoices" ? `/admin/invoices?result=${paid ? "paid" : "unpaid"}` : invoicePath(invoiceId, paid ? "paid" : "unpaid"));
}

export async function cancelGeneratedInvoiceAction(invoiceId: string, formData: FormData) {
  const session = await requireAdmin();
  const adminId = ownerAdminId(session);
  const workspace = await loadInvoiceWorkspaceSettings(adminId);
  const invoice = await prisma.customerInvoice.findFirst({ where: { id: invoiceId, adminId }, include: { items: { orderBy: { position: "asc" } }, relatedDocuments: { where: { documentType: "cancellation" }, select: { id: true }, take: 1 } } });
  if (!workspace || !invoice || invoice.status === "draft" || invoice.documentType === "cancellation") redirect(invoicePath(invoiceId, "unchanged"));
  if (invoice.relatedDocuments[0]) redirect(invoicePath(invoice.relatedDocuments[0].id, "unchanged"));
  const reason = value(formData, "reason").slice(0, 500) || null;
  let cancellation: { id: string };
  try {
    cancellation = await prisma.$transaction(async (tx) => {
      const now = new Date();
      const claimed = await tx.customerInvoice.updateMany({
        where: { id: invoice.id, adminId, status: { in: ["final", "sent", "partial", "paid"] } },
        data: { status: "cancelled", cancelledAt: now, cancellationReason: reason }
      });
      if (claimed.count !== 1) throw new Error("INVOICE_ALREADY_CANCELLED");
      const number = await allocateInvoiceNumber(tx, { adminId, issueDate: now, kind: "cancellation", prefix: workspace.invoiceSettings.invoiceCancellationPrefix, sequenceStart: 1 });
      return tx.customerInvoice.create({ data: {
        adminId,
        customerId: invoice.customerId,
        projectId: invoice.projectId,
        title: `Stornorechnung ${number}`,
        status: "final",
        number,
        issueDate: now,
        dueDate: now,
        serviceDateFrom: invoice.serviceDateFrom,
        serviceDateTo: invoice.serviceDateTo,
        currency: invoice.currency,
        documentType: "cancellation",
        relatedInvoiceId: invoice.id,
        taxMode: invoice.taxMode,
        issuerSnapshot: invoice.issuerSnapshot ?? workspace.issuer,
        customerSnapshot: invoice.customerSnapshot ?? {},
        taxNotice: invoice.taxNotice,
        subtotalCents: -(invoice.subtotalCents ?? invoice.totalCents ?? invoice.amountCents ?? 0),
        taxCents: -(invoice.taxCents ?? 0),
        totalCents: -(invoice.totalCents ?? invoice.amountCents ?? 0),
        amountCents: -(invoice.totalCents ?? invoice.amountCents ?? 0),
        publicToken: createInvoicePublicToken(),
        finalizedAt: now,
        cancellationReason: reason,
        items: { create: invoice.items.map((item) => ({ position: item.position, description: item.description, quantity: item.quantity, unit: item.unit, unitPriceCents: -item.unitPriceCents, vatRate: item.vatRate, netAmountCents: -item.netAmountCents, taxAmountCents: -item.taxAmountCents, amountCents: -item.amountCents })) }
      }, select: { id: true } });
    });
  } catch (error) {
    if (!(error instanceof Error && error.message === "INVOICE_ALREADY_CANCELLED")) throw error;
    const existingCancellation = await prisma.customerInvoice.findFirst({ where: { adminId, relatedInvoiceId: invoice.id, documentType: "cancellation" }, select: { id: true } });
    redirect(invoicePath(existingCancellation?.id ?? invoice.id, "unchanged"));
  }
  await persistGeneratedInvoicePdf(cancellation.id, adminId).catch((error) => console.error("Cancellation PDF persistence failed", error));
  revalidatePath("/admin/invoices");
  redirect(invoicePath(cancellation.id, "cancelled"));
}

export async function createCorrectionInvoiceDraftAction(invoiceId: string) {
  const session = await requireAdmin();
  const adminId = ownerAdminId(session);
  const invoice = await prisma.customerInvoice.findFirst({ where: { id: invoiceId, adminId, status: "cancelled", documentType: { not: "cancellation" } }, include: { items: { orderBy: { position: "asc" } }, relatedDocuments: { where: { documentType: "correction", status: "draft" }, take: 1, select: { id: true } } } });
  if (!invoice) redirect(invoicePath(invoiceId, "unchanged"));
  if (invoice.relatedDocuments[0]) redirect(`/admin/invoices/${invoice.relatedDocuments[0].id}/edit`);
  const workspace = await loadInvoiceWorkspaceSettings(adminId);
  const now = new Date();
  const due = new Date(now); due.setUTCDate(due.getUTCDate() + (workspace?.invoiceSettings.invoiceDueDays ?? 14));
  const created = await prisma.customerInvoice.create({ data: {
    adminId,
    customerId: invoice.customerId,
    projectId: invoice.projectId,
    title: `Helyesbítő piszkozat ${invoice.number}`,
    status: "draft",
    number: createDraftInvoiceNumber(),
    issueDate: now,
    dueDate: due,
    serviceDateFrom: invoice.serviceDateFrom,
    serviceDateTo: invoice.serviceDateTo,
    currency: invoice.currency,
    documentType: "correction",
    relatedInvoiceId: invoice.id,
    taxMode: invoice.taxMode,
    issuerSnapshot: invoice.issuerSnapshot ?? {},
    customerSnapshot: invoice.customerSnapshot ?? {},
    taxNotice: invoice.taxNotice,
    subtotalCents: invoice.subtotalCents,
    taxCents: invoice.taxCents,
    totalCents: invoice.totalCents,
    amountCents: invoice.amountCents,
    publicToken: createInvoicePublicToken(),
    items: { create: invoice.items.map((item) => ({ position: item.position, description: item.description, quantity: item.quantity, unit: item.unit, unitPriceCents: item.unitPriceCents, vatRate: item.vatRate, netAmountCents: item.netAmountCents, taxAmountCents: item.taxAmountCents, amountCents: item.amountCents })) }
  }, select: { id: true } });
  revalidatePath("/admin/invoices");
  redirect(`/admin/invoices/${created.id}/edit`);
}

export async function setGeneratedInvoiceRemindersAction(invoiceId: string, formData: FormData) {
  const session = await requireAdmin();
  const adminId = ownerAdminId(session);
  await prisma.customerInvoice.updateMany({ where: { id: invoiceId, adminId }, data: { remindersEnabled: value(formData, "enabled") === "true" } });
  revalidatePath(`/admin/invoices/${invoiceId}`);
  redirect(invoicePath(invoiceId, value(formData, "enabled") === "true" ? "reminders-on" : "reminders-off"));
}

export async function sendGeneratedInvoiceReminderAction(invoiceId: string) {
  const session = await requireAdmin();
  const result = await deliverGeneratedInvoice(invoiceId, ownerAdminId(session), "reminder");
  revalidatePath(`/admin/invoices/${invoiceId}`);
  redirect(invoicePath(invoiceId, `reminder-${result}`));
}
