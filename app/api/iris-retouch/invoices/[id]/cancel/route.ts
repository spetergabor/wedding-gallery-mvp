import { NextRequest, NextResponse } from "next/server";
import { authenticateIrisRetouch } from "@/lib/iris-retouch-auth";
import {
  IrismomentInvoiceError,
  cancelIrismomentInvoice
} from "@/lib/irismoment-invoices";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const integration = await authenticateIrisRetouch(request);
  if (!integration) {
    return NextResponse.json(
      { ok: false, code: "invalid_token", message: "A Spetly kapcsolat nem érvényes." },
      { status: 401 }
    );
  }
  try {
    const { id } = await context.params;
    const payload = await request.json().catch(() => null) as { reason?: unknown } | null;
    const reason = typeof payload?.reason === "string" ? payload.reason : undefined;
    const result = await cancelIrismomentInvoice(integration.adminId, id, reason);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof IrismomentInvoiceError) {
      return NextResponse.json(
        { ok: false, code: error.code, message: error.message },
        { status: error.status }
      );
    }
    console.error("irismoment invoice cancellation failed", error);
    return NextResponse.json(
      {
        ok: false,
        code: "invoice_cancellation_failed",
        message: "A számla sztornózása sikertelen. Próbáld újra, vagy ellenőrizd a Spetlyben."
      },
      { status: 500 }
    );
  }
}
