import { NextRequest, NextResponse } from "next/server";
import { revalidateTag, unstable_cache } from "next/cache";
import { authenticateIrisRetouch, IRIS_FULFILLMENT_MODE } from "@/lib/iris-retouch-auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function activeEventTag(adminId: string) {
  return `irismoment-active-event:${adminId}`;
}

function cachedActiveEvent(adminId: string) {
  return unstable_cache(
    async () => {
      const active = await prisma.irisMomentActiveEvent.findUnique({ where: { adminId } });
      return {
        eventId: active?.miniSessionId ?? null,
        updatedAt: active?.updatedAt.toISOString() ?? null
      };
    },
    ["irismoment-active-event-v2", adminId],
    { revalidate: 60, tags: [activeEventTag(adminId)] }
  )();
}

export async function GET(request: NextRequest) {
  const auth = await authenticateIrisRetouch(request);
  if (!auth) return NextResponse.json({ ok: false, code: "invalid_token" }, { status: 401 });
  const active = await cachedActiveEvent(auth.adminId);
  return NextResponse.json({
    ok: true,
    pollAfterMs: 30_000,
    ...active
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
  revalidateTag(activeEventTag(auth.adminId));
  return NextResponse.json({ ok: true, eventId: active.miniSessionId, updatedAt: active.updatedAt.toISOString() });
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticateIrisRetouch(request);
  if (!auth) return NextResponse.json({ ok: false, code: "invalid_token" }, { status: 401 });
  await prisma.irisMomentActiveEvent.deleteMany({ where: { adminId: auth.adminId } });
  revalidateTag(activeEventTag(auth.adminId));
  return NextResponse.json({ ok: true });
}
