import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { authenticateIrisRetouch, IRIS_FULFILLMENT_MODE } from "@/lib/iris-retouch-auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function text(value: unknown, max: number) {
  if (typeof value !== "string") return null;
  const clean = value.trim().slice(0, max);
  return clean || null;
}

function jsonArray(value: unknown, maxItems: number): Prisma.InputJsonValue | null {
  if (!Array.isArray(value) || value.length > maxItems) return null;
  const encoded = JSON.stringify(value);
  if (encoded.length > 100_000) return null;
  return JSON.parse(encoded) as Prisma.InputJsonValue;
}

async function eventFor(adminId: string, id: string) {
  return prisma.miniSession.findFirst({
    where: { id, adminId, fulfillmentMode: IRIS_FULFILLMENT_MODE },
    select: { id: true }
  });
}

function serializeClient(client: {
  id: string; name: string; email: string | null; phone: string | null;
  participantCount: number | null; notes: string | null; participants: Prisma.JsonValue;
  effectOrders: Prisma.JsonValue; version: number; updatedAt: Date;
  updatedByDevice: { id: string; externalId: string; name: string } | null;
}) {
  return {
    id: client.id,
    name: client.name,
    email: client.email,
    phone: client.phone,
    participantCount: client.participantCount,
    notes: client.notes,
    participants: client.participants,
    effectOrders: client.effectOrders,
    version: client.version,
    updatedAt: client.updatedAt.toISOString(),
    updatedByDevice: client.updatedByDevice
  };
}

const clientInclude = {
  updatedByDevice: { select: { id: true, externalId: true, name: true } }
} satisfies Prisma.IrisMomentSharedClientInclude;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateIrisRetouch(request);
  if (!auth) return NextResponse.json({ ok: false, code: "invalid_token" }, { status: 401 });
  const { id } = await params;
  if (!await eventFor(auth.adminId, id)) {
    return NextResponse.json({ ok: false, code: "event_not_found" }, { status: 404 });
  }
  const [clients, devices] = await Promise.all([
    prisma.irisMomentSharedClient.findMany({
      where: { adminId: auth.adminId, miniSessionId: id },
      include: clientInclude,
      orderBy: { updatedAt: "asc" }
    }),
    prisma.irisMomentDevice.findMany({
      where: {
        adminId: auth.adminId,
        revokedAt: null,
        lastSeenAt: { gte: new Date(Date.now() - 5 * 60_000) }
      },
      select: { id: true, externalId: true, name: true, appVersion: true, lastSeenAt: true },
      orderBy: { lastSeenAt: "desc" }
    })
  ]);
  return NextResponse.json({
    ok: true,
    serverTime: new Date().toISOString(),
    clients: clients.map(serializeClient),
    devices: devices.map((device) => ({ ...device, lastSeenAt: device.lastSeenAt.toISOString() }))
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateIrisRetouch(request);
  if (!auth) return NextResponse.json({ ok: false, code: "invalid_token" }, { status: 401 });
  const { id: eventId } = await params;
  if (!await eventFor(auth.adminId, eventId)) {
    return NextResponse.json({ ok: false, code: "event_not_found" }, { status: 404 });
  }
  const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
  const clientId = text(payload?.id, 100);
  const name = text(payload?.name, 200);
  const baseVersion = Number.isInteger(payload?.baseVersion) ? Number(payload?.baseVersion) : -1;
  const participants = jsonArray(payload?.participants, 10);
  const effectOrders = jsonArray(payload?.effectOrders, 100);
  const participantCount = payload?.participantCount == null
    ? null
    : Number.isInteger(payload.participantCount) && Number(payload.participantCount) >= 1 && Number(payload.participantCount) <= 10
      ? Number(payload.participantCount)
      : -1;
  if (!clientId || !name || baseVersion < 0 || participants === null || effectOrders === null || participantCount === -1) {
    return NextResponse.json({ ok: false, code: "invalid_client" }, { status: 400 });
  }
  const data = {
    name,
    email: text(payload?.email, 320),
    phone: text(payload?.phone, 80),
    participantCount,
    notes: text(payload?.notes, 5_000),
    participants,
    effectOrders,
    updatedByDeviceId: auth.device?.id ?? null
  };
  const existing = await prisma.irisMomentSharedClient.findUnique({
    where: { id: clientId },
    include: clientInclude
  });
  if (!existing) {
    if (baseVersion !== 0) {
      return NextResponse.json({ ok: false, code: "version_conflict" }, { status: 409 });
    }
    const created = await prisma.irisMomentSharedClient.create({
      data: { id: clientId, adminId: auth.adminId, miniSessionId: eventId, ...data },
      include: clientInclude
    });
    return NextResponse.json({ ok: true, client: serializeClient(created) });
  }
  if (existing.adminId !== auth.adminId || existing.miniSessionId !== eventId) {
    return NextResponse.json({ ok: false, code: "client_scope_conflict" }, { status: 409 });
  }
  if (existing.version !== baseVersion) {
    return NextResponse.json({ ok: false, code: "version_conflict", client: serializeClient(existing) }, { status: 409 });
  }
  const changed = await prisma.irisMomentSharedClient.updateMany({
    where: { id: clientId, adminId: auth.adminId, miniSessionId: eventId, version: baseVersion },
    data: { ...data, version: { increment: 1 } }
  });
  if (changed.count !== 1) {
    const current = await prisma.irisMomentSharedClient.findUnique({ where: { id: clientId }, include: clientInclude });
    return NextResponse.json({
      ok: false,
      code: "version_conflict",
      client: current ? serializeClient(current) : null
    }, { status: 409 });
  }
  const updated = await prisma.irisMomentSharedClient.findUniqueOrThrow({
    where: { id: clientId },
    include: clientInclude
  });
  return NextResponse.json({ ok: true, client: serializeClient(updated) });
}
