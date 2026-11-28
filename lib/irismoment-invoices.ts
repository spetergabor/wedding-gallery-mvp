import "server-only";

import { Prisma } from "@prisma/client";
import {
  INVOICE_STANDARD_TAX_NOTICE,
  INVOICE_TAX_NOTICE,
  allocateInvoiceNumber,
  createInvoicePublicToken,
  invoiceIssuerChoice,
  loadInvoiceWorkspaceSettings,
  missingIssuerFields
} from "@/lib/customer-invoices";
import { deliverGeneratedInvoice, persistGeneratedInvoicePdf } from "@/lib/generated-invoice-service";
import { prisma } from "@/lib/prisma";

export type IrismomentInvoiceInput = {
  requestId: string;
  externalClientId: string;
  customerName: string;
  customerEmail: string;
  description: string;
  totalCents: number;
  issuerKey: string;
  paymentMethod: "card" | "cash" | "unpaid";
  paidAt?: Date;
  addressLine1?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  lineItems?: Array<{
    description: string;
    quantity: number;
    unitPriceCents: number;
  }>;
};

export class IrismomentInvoiceError extends Error {
  constructor(public code: string, message: string, public status = 400) {
    super(message);
  }
}

function requestMarker(input: IrismomentInvoiceInput) {
  return `irismoment:${input.issuerKey}:${input.externalClientId}:${input.requestId}`;
}

function responseInvoice(invoice: {
  id: string;
  number: string | null;
  status: string;
  totalCents: number | null;
  sentAt: Date | null;
}) {
  return {
    id: invoice.id,
    number: invoice.number,
    status: invoice.status,
    totalCents: invoice.totalCents,
    sentAt: invoice.sentAt?.toISOString() ?? null
  };
}

export async function createAndSendIrismomentInvoice(adminId: string, input: IrismomentInvoiceInput) {
  const workspace = await loadInvoiceWorkspaceSettings(adminId);
  if (!workspace) throw new IrismomentInvoiceError("workspace_not_found", "A Spetly workspace nem található.", 404);
  const issuerChoice = invoiceIssuerChoice(workspace, input.issuerKey);
  if (!issuerChoice) throw new IrismomentInvoiceError("issuer_not_found", "A kiválasztott számlakibocsátó nem található.", 404);
  const taxMode = issuerChoice.invoiceSettings.invoiceTaxMode === "taxable" ? "taxable" : "small_business";
  const missing = missingIssuerFields(issuerChoice.issuer, taxMode);
  if (missing.length) {
    throw new IrismomentInvoiceError(
      "invoice_settings_incomplete",
      `A Spetly Beállítások / Számlázás részében töltsd ki: ${missing.join(", ")}.`,
      422
    );
  }
  const marker = requestMarker(input);
  const isPaid = input.paymentMethod === "card" || input.paymentMethod === "cash";
  const paidAt = isPaid ? input.paidAt ?? new Date() : null;
  const existing = await prisma.customerInvoice.findFirst({
    where: { adminId, externalReference: marker },
    select: { id: true, number: true, status: true, totalCents: true, sentAt: true }
  });
  if (existing) {
    const delivery = existing.sentAt ? "sent" as const : await deliverGeneratedInvoice(existing.id, adminId);
    const current = await prisma.customerInvoice.findUniqueOrThrow({
      where: { id: existing.id },
      select: { id: true, number: true, status: true, totalCents: true, sentAt: true }
    });
    return { invoice: responseInvoice(current), delivery, reused: true };
  }

  const now = new Date();
  const dueDate = new Date(now);
  dueDate.setUTCDate(dueDate.getUTCDate() + issuerChoice.invoiceSettings.invoiceDueDays);
  const vatRate = taxMode === "taxable" ? issuerChoice.invoiceSettings.invoiceDefaultVatRate : 0;
  const sourceItems = input.lineItems?.length ? input.lineItems : [{
    description: input.description,
    quantity: 1,
    unitPriceCents: input.totalCents
  }];
  const calculatedItems = sourceItems.map((item, position) => {
    const amountCents = item.quantity * item.unitPriceCents;
    const netAmountCents = vatRate > 0
      ? Math.round(amountCents * 100 / (100 + vatRate))
      : amountCents;
    const taxAmountCents = amountCents - netAmountCents;
    const unitPriceCents = vatRate > 0
      ? Math.round(item.unitPriceCents * 100 / (100 + vatRate))
      : item.unitPriceCents;
    return {
      position,
      description: item.description,
      quantity: new Prisma.Decimal(item.quantity),
      unit: "Stk.",
      unitPriceCents,
      vatRate,
      netAmountCents,
      taxAmountCents,
      amountCents
    };
  });
  const subtotalCents = calculatedItems.reduce((sum, item) => sum + item.netAmountCents, 0);
  const taxCents = calculatedItems.reduce((sum, item) => sum + item.taxAmountCents, 0);
  const party = {
    name: input.customerName,
    email: input.customerEmail,
    secondaryEmail: null,
    addressLine1: input.addressLine1 || null,
    postalCode: input.postalCode || null,
    city: input.city || null,
    country: input.country || "Österreich",
    uid: null
  };

  let invoice;
  try {
    invoice = await prisma.$transaction(async (tx) => {
      const number = await allocateInvoiceNumber(tx, {
        adminId,
        issueDate: now,
        kind: "invoice",
        prefix: issuerChoice.invoiceSettings.invoicePrefix,
        sequenceStart: issuerChoice.invoiceSettings.invoiceSequenceStart,
        sequenceKey: issuerChoice.id
      });
      return tx.customerInvoice.create({
        data: {
          adminId,
          issuerKey: issuerChoice.id,
          externalReference: marker,
          title: `Rechnung ${number}`,
          status: isPaid ? "paid" : "final",
          number,
          issueDate: now,
          dueDate,
          serviceDateFrom: now,
          serviceDateTo: now,
          currency: "EUR",
          taxMode,
          issuerSnapshot: issuerChoice.issuer,
          customerSnapshot: party,
          taxNotice: taxMode === "taxable" ? INVOICE_STANDARD_TAX_NOTICE : INVOICE_TAX_NOTICE,
          subtotalCents,
          taxCents,
          totalCents: input.totalCents,
          amountCents: input.totalCents,
          paidCents: isPaid ? input.totalCents : 0,
          paidAt,
          publicToken: createInvoicePublicToken(),
          finalizedAt: now,
          remindersEnabled: isPaid ? false : workspace.invoiceSettings.invoiceRemindersEnabled,
          items: {
            create: calculatedItems
          },
          ...(isPaid ? {
            payments: {
              create: {
                amountCents: input.totalCents,
                paidAt: paidAt!,
                method: input.paymentMethod,
                note: "Vor Ort über irismoment als bezahlt erfasst."
              }
            }
          } : {})
        },
        select: { id: true, number: true, status: true, totalCents: true, sentAt: true }
      });
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
    const concurrent = await prisma.customerInvoice.findFirstOrThrow({
      where: { adminId, externalReference: marker },
      select: { id: true, number: true, status: true, totalCents: true, sentAt: true }
    });
    const delivery = concurrent.sentAt ? "sent" as const : await deliverGeneratedInvoice(concurrent.id, adminId);
    return { invoice: responseInvoice(concurrent), delivery, reused: true };
  }

  await persistGeneratedInvoicePdf(invoice.id, adminId).catch((error) => {
    console.error("irismoment invoice PDF persistence failed", error);
  });
  const delivery = await deliverGeneratedInvoice(invoice.id, adminId);
  const current = await prisma.customerInvoice.findUniqueOrThrow({
    where: { id: invoice.id },
    select: { id: true, number: true, status: true, totalCents: true, sentAt: true }
  });
  return { invoice: responseInvoice(current), delivery, reused: false };
}

export async function cancelIrismomentInvoice(
  adminId: string,
  invoiceId: string,
  cancellationReason?: string
) {
  const workspace = await loadInvoiceWorkspaceSettings(adminId);
  if (!workspace) {
    throw new IrismomentInvoiceError("workspace_not_found", "A Spetly workspace nem található.", 404);
  }
  const invoice = await prisma.customerInvoice.findFirst({
    where: { id: invoiceId, adminId },
    include: {
      items: { orderBy: { position: "asc" } },
      relatedDocuments: {
        where: { documentType: "cancellation" },
        select: { id: true },
        take: 1
      }
    }
  });
  if (!invoice) {
    throw new IrismomentInvoiceError("invoice_not_found", "A számla nem található.", 404);
  }
  if (invoice.documentType === "cancellation" || invoice.status === "draft") {
    throw new IrismomentInvoiceError(
      "invoice_not_cancellable",
      "Ez a bizonylat nem sztornózható.",
      409
    );
  }

  const existingCancellationId = invoice.relatedDocuments[0]?.id;
  if (existingCancellationId) {
    const existingCancellation = await prisma.customerInvoice.findFirstOrThrow({
      where: { id: existingCancellationId, adminId },
      select: { id: true, number: true, status: true, totalCents: true, sentAt: true }
    });
    return {
      invoice: responseInvoice(invoice),
      cancellation: responseInvoice(existingCancellation),
      reused: true
    };
  }
  if (!["final", "sent", "partial", "paid"].includes(invoice.status)) {
    throw new IrismomentInvoiceError(
      "invoice_not_cancellable",
      invoice.status === "cancelled" ? "A számlát már sztornózták." : "Ez a számla nem sztornózható.",
      409
    );
  }

  const issuerChoice = invoiceIssuerChoice(workspace, invoice.issuerKey) ??
    invoiceIssuerChoice(workspace, "default");
  if (!issuerChoice) {
    throw new IrismomentInvoiceError("issuer_not_found", "A számlakibocsátó nem található.", 404);
  }
  const reason = cancellationReason?.trim().slice(0, 500) || null;
  let cancellationId: string;
  let reused = false;
  try {
    cancellationId = await prisma.$transaction(async (tx) => {
      const now = new Date();
      const claimed = await tx.customerInvoice.updateMany({
        where: {
          id: invoice.id,
          adminId,
          status: { in: ["final", "sent", "partial", "paid"] }
        },
        data: { status: "cancelled", cancelledAt: now, cancellationReason: reason }
      });
      if (claimed.count !== 1) throw new Error("INVOICE_ALREADY_CANCELLED");
      const number = await allocateInvoiceNumber(tx, {
        adminId,
        issueDate: now,
        kind: "cancellation",
        prefix: issuerChoice.invoiceSettings.invoiceCancellationPrefix,
        sequenceStart: 1,
        sequenceKey: invoice.issuerKey
      });
      const cancellation = await tx.customerInvoice.create({
        data: {
          adminId,
          customerId: invoice.customerId,
          projectId: invoice.projectId,
          issuerKey: invoice.issuerKey,
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
          issuerSnapshot: invoice.issuerSnapshot ?? issuerChoice.issuer,
          customerSnapshot: invoice.customerSnapshot ?? {},
          taxNotice: invoice.taxNotice,
          subtotalCents: -(invoice.subtotalCents ?? invoice.totalCents ?? invoice.amountCents ?? 0),
          taxCents: -(invoice.taxCents ?? 0),
          totalCents: -(invoice.totalCents ?? invoice.amountCents ?? 0),
          amountCents: -(invoice.totalCents ?? invoice.amountCents ?? 0),
          publicToken: createInvoicePublicToken(),
          finalizedAt: now,
          cancellationReason: reason,
          remindersEnabled: false,
          items: {
            create: invoice.items.map((item) => ({
              position: item.position,
              description: item.description,
              quantity: item.quantity,
              unit: item.unit,
              unitPriceCents: -item.unitPriceCents,
              vatRate: item.vatRate,
              netAmountCents: -item.netAmountCents,
              taxAmountCents: -item.taxAmountCents,
              amountCents: -item.amountCents
            }))
          }
        },
        select: { id: true }
      });
      return cancellation.id;
    });
  } catch (error) {
    if (!(error instanceof Error && error.message === "INVOICE_ALREADY_CANCELLED")) throw error;
    const existing = await prisma.customerInvoice.findFirst({
      where: { adminId, relatedInvoiceId: invoice.id, documentType: "cancellation" },
      select: { id: true }
    });
    if (!existing) {
      throw new IrismomentInvoiceError("invoice_already_cancelled", "A számlát már sztornózták.", 409);
    }
    cancellationId = existing.id;
    reused = true;
  }

  await persistGeneratedInvoicePdf(cancellationId, adminId).catch((error) => {
    console.error("irismoment cancellation PDF persistence failed", error);
  });
  const [currentInvoice, cancellation] = await Promise.all([
    prisma.customerInvoice.findUniqueOrThrow({
      where: { id: invoice.id },
      select: { id: true, number: true, status: true, totalCents: true, sentAt: true }
    }),
    prisma.customerInvoice.findUniqueOrThrow({
      where: { id: cancellationId },
      select: { id: true, number: true, status: true, totalCents: true, sentAt: true }
    })
  ]);
  return {
    invoice: responseInvoice(currentInvoice),
    cancellation: responseInvoice(cancellation),
    reused
  };
}
