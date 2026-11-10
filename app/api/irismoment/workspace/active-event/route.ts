import { NextRequest, NextResponse } from "next/server";
import { authenticateIrisRetouch, IRIS_FULFILLMENT_MODE } from "@/lib/iris-retouch-auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await authenticateIrisRetouch(request);
  if (!auth) return NextResponse.json({ ok: false, code: "invalid_token" }, { status: 401 });
  const active = await prisma.irisMomentActiveEvent.findUnique({ where: { adminId: auth.adminId } });
  return NextResponse.json({
    ok: true,
    eventId: active?.miniSessionId ?? null,
    updatedAt: active?.updatedAt.toISOString() ?? null
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await authenticateIrisRetouch(request);
  if (!auth) return NextResponse.json({ ok: false, code: "invalid_token" }, { status: 401 });
  const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
  const eventId = typeof payload?.eventId === "string" ? payload.eventId.slice(0, 100) : "";
  const event = await prisma.miniSession.findFirst({
    where: { id: eventId, adminId: auth.adminId, fulfillmentMode: IRIS_FULFILLMENT_MODE },
    select: { id: true }
  });
  if (!event) return NextResponse.json({ ok: false, code: "event_not_found" }, { status: 404 });
  const active = await prisma.irisMomentActiveEvent.upsert({
    where: { adminId: auth.adminId },
    create: { adminId: auth.adminId, miniSessionId: event.id, updatedByDeviceId: auth.device?.id ?? null },
    update: { miniSessionId: event.id, updatedByDeviceId: auth.device?.id ?? null }
  });
  return NextResponse.json({ ok: true, eventId: active.miniSessionId, updatedAt: active.updatedAt.toISOString() });
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticateIrisRetouch(request);
  if (!auth) return NextResponse.json({ ok: false, code: "invalid_token" }, { status: 401 });
  await prisma.irisMomentActiveEvent.deleteMany({ where: { adminId: auth.adminId } });
  return NextResponse.json({ ok: true });
}
