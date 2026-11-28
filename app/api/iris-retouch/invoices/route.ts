import { NextRequest, NextResponse } from "next/server";
import { authenticateIrisRetouch } from "@/lib/iris-retouch-auth";
import {
  IrismomentInvoiceError,
  createAndSendIrismomentInvoice,
  type IrismomentInvoiceInput
} from "@/lib/irismoment-invoices";

export const runtime = "nodejs";

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function lineItems(value: unknown, expectedTotalCents: number) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length < 1 || value.length > 30) {
    throw new IrismomentInvoiceError("invalid_invoice_items", "Ellenőrizd a számla plusz tételeit.", 400);
  }
  const parsed = value.map((raw) => {
    const item = raw && typeof raw === "object" && !Array.isArray(raw)
      ? raw as Record<string, unknown>
      : {};
    const description = text(item.description, 500);
    const quantity = Number(item.quantity);
    const unitPriceCents = Number(item.unitPriceCents);
    if (!description || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 999 ||
        !Number.isSafeInteger(unitPriceCents) || unitPriceCents < 1 || unitPriceCents > 1_000_000) {
      throw new IrismomentInvoiceError("invalid_invoice_items", "Ellenőrizd a számla plusz tételeit.", 400);
    }
    return { description, quantity, unitPriceCents };
  });
  const calculatedTotal = parsed.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);
  if (!Number.isSafeInteger(calculatedTotal) || calculatedTotal !== expectedTotalCents) {
    throw new IrismomentInvoiceError("invalid_invoice_items", "A számlatételek összege nem egyezik a végösszeggel.", 400);
  }
  return parsed;
}

function parsePayload(value: unknown): IrismomentInvoiceInput {
  const payload = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const requestId = text(payload.requestId, 100);
  const externalClientId = text(payload.externalClientId, 100);
  const customerName = text(payload.customerName, 300);
  const customerEmail = text(payload.customerEmail, 320).toLowerCase();
  const description = text(payload.description, 500);
  const totalCents = Number(payload.totalCents);
  const issuerKey = text(payload.issuerKey, 100) || "default";
  const paymentMethod = text(payload.paymentMethod, 30) || "unpaid";
  const paidAtText = text(payload.paidAt, 50);
  const paidAt = paidAtText ? new Date(paidAtText) : undefined;
  if (!requestId || !externalClientId || customerName.length < 2 || !description ||
      !/^\S+@\S+\.\S+$/.test(customerEmail) || !Number.isSafeInteger(totalCents) ||
      totalCents < 1 || totalCents > 1_000_000 ||
      !["card", "cash", "unpaid"].includes(paymentMethod) ||
      (paymentMethod !== "unpaid" && (!paidAt || Number.isNaN(paidAt.getTime())))) {
    throw new IrismomentInvoiceError(
      "invalid_invoice",
      "Ellenőrizd az ügyfél nevét, e-mail-címét, a számla megnevezését és az összeget.",
      400
    );
  }
  return {
    requestId,
    externalClientId,
    customerName,
    customerEmail,
    description,
    totalCents,
    issuerKey,
    paymentMethod: paymentMethod as IrismomentInvoiceInput["paymentMethod"],
    paidAt,
    addressLine1: text(payload.addressLine1, 300) || undefined,
    postalCode: text(payload.postalCode, 30) || undefined,
    city: text(payload.city, 150) || undefined,
    country: text(payload.country, 150) || undefined,
    lineItems: lineItems(payload.lineItems, totalCents)
  };
}

export async function POST(request: NextRequest) {
  const integration = await authenticateIrisRetouch(request);
  if (!integration) {
    return NextResponse.json({ ok: false, code: "invalid_token", message: "A Spetly kapcsolat nem érvényes." }, { status: 401 });
  }
  try {
    const input = parsePayload(await request.json().catch(() => null));
    const result = await createAndSendIrismomentInvoice(integration.adminId, input);
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (error) {
    if (error instanceof IrismomentInvoiceError) {
      return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: error.status });
    }
    console.error("irismoment invoice creation failed", error);
    return NextResponse.json({
      ok: false,
      code: "invoice_creation_failed",
      message: "A számla létrehozása sikertelen. Ellenőrizd a Spetly számlázási beállításait, majd próbáld újra."
    }, { status: 500 });
  }
}
