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
  const subtotalCents = vatRate > 0
    ? Math.round(input.totalCents * 100 / (100 + vatRate))
    : input.totalCents;
  const taxCents = input.totalCents - subtotalCents;
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
            create: [{
              position: 0,
              description: input.description,
              quantity: new Prisma.Decimal(1),
              unit: "pauschal",
              unitPriceCents: subtotalCents,
              vatRate,
              netAmountCents: subtotalCents,
              taxAmountCents: taxCents,
              amountCents: input.totalCents
            }]
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
