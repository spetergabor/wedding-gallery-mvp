import { NextRequest, NextResponse } from "next/server";
import { authenticateIrisRetouch, IRIS_FULFILLMENT_MODE } from "@/lib/iris-retouch-auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
const ALLOWED = new Set(["expected", "checked_in", "shooting", "production", "delivered", "no_show"]);

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const integration = await authenticateIrisRetouch(request);
  if (!integration) return NextResponse.json({ ok: false, code: "invalid_token" }, { status: 401 });
  const { id } = await params;
  const existing = await prisma.miniSessionBooking.findFirst({
    where: {
      id,
      miniSession: { adminId: integration.adminId, fulfillmentMode: IRIS_FULFILLMENT_MODE }
    }
  });
  if (!existing) return NextResponse.json({ ok: false, code: "booking_not_found" }, { status: 404 });
  const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
  const status = typeof payload?.status === "string" && ALLOWED.has(payload.status) ? payload.status : null;
  if (!status) return NextResponse.json({ ok: false, code: "invalid_status" }, { status: 400 });
  const now = new Date();
  const updated = await prisma.miniSessionBooking.update({
    where: { id },
    data: {
      irisStatus: status,
      irisCheckedInAt: status === "checked_in" && !existing.irisCheckedInAt ? now : undefined,
      irisDeliveredAt: status === "delivered" ? now : undefined,
      irisExternalClientId: typeof payload?.externalClientId === "string" ? payload.externalClientId.slice(0, 100) : undefined,
      irisFolderName: typeof payload?.folderName === "string" ? payload.folderName.slice(0, 300) : undefined
    }
  });
  return NextResponse.json({ ok: true, status: updated.irisStatus, updatedAt: updated.updatedAt.toISOString() });
}
