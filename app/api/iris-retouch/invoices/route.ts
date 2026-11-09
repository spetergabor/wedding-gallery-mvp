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
  if (!requestId || !externalClientId || customerName.length < 2 || !description ||
      !/^\S+@\S+\.\S+$/.test(customerEmail) || !Number.isSafeInteger(totalCents) ||
      totalCents < 1 || totalCents > 1_000_000) {
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
    addressLine1: text(payload.addressLine1, 300) || undefined,
    postalCode: text(payload.postalCode, 30) || undefined,
    city: text(payload.city, 150) || undefined,
    country: text(payload.country, 150) || undefined
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
