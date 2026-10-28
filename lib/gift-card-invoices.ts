import { Prisma } from "@prisma/client";
import {
  INVOICE_STANDARD_TAX_NOTICE,
  INVOICE_TAX_NOTICE,
  allocateInvoiceNumber,
  createInvoicePublicToken,
  loadInvoiceWorkspaceSettings,
  missingIssuerFields
} from "@/lib/customer-invoices";
import { persistGeneratedInvoicePdf } from "@/lib/generated-invoice-actions";
import { prisma } from "@/lib/prisma";

type InvoiceGenerationResult =
  | { status: "created"; invoiceId: string; invoiceNumber: string }
  | { status: "already-created"; invoiceId: string | null; invoiceNumber: string | null }
  | { status: "not-ready" }
  | { status: "error"; message: string };

function issueDateNow() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12));
}

function addUtcDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function legacyAddressParts(deliveryAddress: string | null) {
  if (!deliveryAddress) return { addressLine1: null, postalCode: null, city: null };
  const parts = deliveryAddress.split(",").map((part) => part.trim()).filter(Boolean);
  const locality = parts.at(-1) ?? "";
  const localityMatch = locality.match(/^(\d{4,10})\s+(.+)$/);
  if (!localityMatch) {
    return { addressLine1: deliveryAddress, postalCode: null, city: null };
  }
  return {
    addressLine1: parts.slice(0, -1).join(", ") || null,
    postalCode: localityMatch[1] ?? null,
    city: localityMatch[2] ?? null
  };
}

export async function maybeCreateGiftCardInvoice(orderId: string, adminId: string): Promise<InvoiceGenerationResult> {
  const candidate = await prisma.giftCardOrder.findFirst({
    where: { id: orderId, adminId },
    select: { delivered: true, amountCents: true, invoiceId: true, invoiceNumber: true }
  });
  if (!candidate) return { status: "error", message: "Az ajándékkártya-rendelés nem található." };
  if (candidate.invoiceId || candidate.invoiceNumber) {
    return { status: "already-created", invoiceId: candidate.invoiceId, invoiceNumber: candidate.invoiceNumber };
  }
  if (!candidate.delivered || !candidate.amountCents || candidate.amountCents <= 0) return { status: "not-ready" };

  const workspace = await loadInvoiceWorkspaceSettings(adminId);
  if (!workspace) return { status: "error", message: "A számlázási workspace nem található." };
  const missing = missingIssuerFields(workspace.issuer, workspace.invoiceSettings.invoiceTaxMode);
  if (missing.length) {
    return {
      status: "error",
      message: `A számla nem készült el. A Beállítások / Számlázás részben töltsd ki: ${missing.join(", ")}.`
    };
  }
  if (candidate.amountCents > 1_000_000) {
    return { status: "error", message: "10 000 EUR feletti számlához az ügyfél UID-számára is szükség van." };
  }

  const issueDate = issueDateNow();
  const dueDate = addUtcDays(issueDate, workspace.invoiceSettings.invoiceDueDays);
  const taxMode = workspace.invoiceSettings.invoiceTaxMode === "taxable" ? "taxable" : "small_business";
  const vatRate = taxMode === "taxable" ? workspace.invoiceSettings.invoiceDefaultVatRate : 0;

  try {
    const created = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${orderId}))`;
      const order = await tx.giftCardOrder.findFirst({ where: { id: orderId, adminId } });
      if (!order) throw new Error("GIFT_CARD_ORDER_NOT_FOUND");
      if (order.invoiceId || order.invoiceNumber) {
        return { status: "already-created" as const, invoiceId: order.invoiceId, invoiceNumber: order.invoiceNumber };
      }
      if (!order.delivered || !order.amountCents || order.amountCents <= 0) {
        return { status: "not-ready" as const };
      }

      const totalCents = order.amountCents;
      const netAmountCents = vatRate > 0 ? Math.round(totalCents * 100 / (100 + vatRate)) : totalCents;
      const taxCents = totalCents - netAmountCents;
      const number = await allocateInvoiceNumber(tx, {
        adminId,
        issueDate,
        kind: "invoice",
        prefix: workspace.invoiceSettings.invoicePrefix,
        sequenceStart: workspace.invoiceSettings.invoiceSequenceStart
      });
      const fallbackAddress = legacyAddressParts(order.deliveryAddress);
      const invoice = await tx.customerInvoice.create({
        data: {
          adminId,
          title: `Rechnung ${number}`,
          status: "final",
          number,
          issueDate,
          dueDate,
          serviceDateFrom: issueDate,
          serviceDateTo: issueDate,
          currency: "EUR",
          taxMode,
          issuerSnapshot: workspace.issuer,
          customerSnapshot: {
            name: order.customerName,
            email: order.email,
            secondaryEmail: null,
            addressLine1: order.deliveryAddressLine1 || fallbackAddress.addressLine1,
            postalCode: order.deliveryPostalCode || fallbackAddress.postalCode,
            city: order.deliveryCity || fallbackAddress.city,
            country: order.deliveryCountry || "Österreich",
            uid: null
          },
          taxNotice: taxMode === "taxable" ? INVOICE_STANDARD_TAX_NOTICE : INVOICE_TAX_NOTICE,
          subtotalCents: netAmountCents,
          taxCents,
          totalCents,
          amountCents: totalCents,
          publicToken: createInvoicePublicToken(),
          finalizedAt: new Date(),
          notes: `Automatisch aus der Geschenkkarten-Bestellung für ${order.recipientName}.`,
          remindersEnabled: workspace.invoiceSettings.invoiceRemindersEnabled,
          items: {
            create: {
              position: 0,
              description: `Geschenkkarte Irisfotografie – ${order.recipientName} (${order.personCount} ${order.personCount === 1 ? "Person" : "Personen"})`,
              quantity: new Prisma.Decimal(1),
              unit: "Stk",
              unitPriceCents: netAmountCents,
              vatRate,
              netAmountCents,
              taxAmountCents: taxCents,
              amountCents: totalCents
            }
          }
        },
        select: { id: true }
      });
      await tx.giftCardOrder.update({
        where: { id: order.id },
        data: { invoiceId: invoice.id, invoiceNumber: number }
      });
      return { status: "created" as const, invoiceId: invoice.id, invoiceNumber: number };
    }, { maxWait: 5_000, timeout: 15_000 });

    if (created.status === "created") {
      await persistGeneratedInvoicePdf(created.invoiceId, adminId).catch((error) => {
        console.error("Gift card invoice PDF persistence failed", error);
      });
    }
    return created;
  } catch (error) {
    console.error("Gift card invoice generation failed", error);
    return { status: "error", message: "A rendelés mentve lett, de a számla generálása nem sikerült. Próbáld meg újra a mentést." };
  }
}
