import { Prisma } from "@prisma/client";
import { revalidateTag, unstable_cache } from "next/cache";
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
  deletedAt: Date | null;
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
    deletedAt: client.deletedAt?.toISOString() ?? null,
    updatedAt: client.updatedAt.toISOString(),
    updatedByDevice: client.updatedByDevice
  };
}

const clientInclude = {
  updatedByDevice: { select: { id: true, externalId: true, name: true } }
} satisfies Prisma.IrisMomentSharedClientInclude;

function workspaceTag(adminId: string, eventId: string) {
  return `irismoment-workspace:${adminId}:${eventId}`;
}

function cachedFullWorkspace(adminId: string, eventId: string) {
  return unstable_cache(
    async () => {
      const [clients, devices] = await Promise.all([
        prisma.irisMomentSharedClient.findMany({
          where: { adminId, miniSessionId: eventId },
          include: clientInclude,
          orderBy: { updatedAt: "asc" }
        }),
        prisma.irisMomentDevice.findMany({
          where: {
            adminId,
            revokedAt: null,
            lastSeenAt: { gte: new Date(Date.now() - 5 * 60_000) }
          },
          select: { id: true, externalId: true, name: true, appVersion: true, lastSeenAt: true },
          orderBy: { lastSeenAt: "desc" }
        })
      ]);
      return {
        serverTime: new Date().toISOString(),
        clients: clients.map(serializeClient),
        devices: devices.map((device) => ({ ...device, lastSeenAt: device.lastSeenAt.toISOString() }))
      };
    },
    ["irismoment-full-workspace-v2", adminId, eventId],
    { revalidate: 60, tags: [workspaceTag(adminId, eventId)] }
  )();
}

function validSince(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("since");
  if (!raw) return null;
  const parsed = new Date(raw);
  if (!Number.isFinite(parsed.getTime()) || parsed.getTime() > Date.now() + 5_000) return null;
  return parsed;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateIrisRetouch(request);
  if (!auth) return NextResponse.json({ ok: false, code: "invalid_token" }, { status: 401 });
  const { id } = await params;
  if (!await eventFor(auth.adminId, id)) {
    return NextResponse.json({ ok: false, code: "event_not_found" }, { status: 404 });
  }
  const since = validSince(request);
  if (!since) {
    const workspace = await cachedFullWorkspace(auth.adminId, id);
    return NextResponse.json({
      ok: true,
      fullSnapshot: true,
      pollAfterMs: 15_000,
      ...workspace
    });
  }

  // Use a fixed upper bound so a write that lands while this query is running
  // is picked up by the following request instead of falling between cursors.
  const cutoff = new Date();
  const includeDevices = request.nextUrl.searchParams.get("includeDevices") === "1";
  const [clients, devices] = await Promise.all([
    prisma.irisMomentSharedClient.findMany({
      where: {
        adminId: auth.adminId,
        miniSessionId: id,
        updatedAt: { gt: since, lte: cutoff }
      },
      include: clientInclude,
      orderBy: { updatedAt: "asc" }
    }),
    includeDevices
      ? prisma.irisMomentDevice.findMany({
          where: {
            adminId: auth.adminId,
            revokedAt: null,
            lastSeenAt: { gte: new Date(Date.now() - 5 * 60_000) }
          },
          select: { id: true, externalId: true, name: true, appVersion: true, lastSeenAt: true },
          orderBy: { lastSeenAt: "desc" }
        })
      : Promise.resolve(null)
  ]);
  return NextResponse.json({
    ok: true,
    fullSnapshot: false,
    pollAfterMs: 15_000,
    serverTime: cutoff.toISOString(),
    clients: clients.map(serializeClient),
    devices: devices?.map((device) => ({ ...device, lastSeenAt: device.lastSeenAt.toISOString() })) ?? null
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
    revalidateTag(workspaceTag(auth.adminId, eventId));
    return NextResponse.json({ ok: true, client: serializeClient(created) });
  }
  if (existing.adminId !== auth.adminId || existing.miniSessionId !== eventId) {
    return NextResponse.json({ ok: false, code: "client_scope_conflict" }, { status: 409 });
  }
  if (existing.deletedAt) {
    return NextResponse.json({ ok: false, code: "client_deleted", client: serializeClient(existing) }, { status: 409 });
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
  revalidateTag(workspaceTag(auth.adminId, eventId));
  return NextResponse.json({ ok: true, client: serializeClient(updated) });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateIrisRetouch(request);
  if (!auth) return NextResponse.json({ ok: false, code: "invalid_token" }, { status: 401 });
  const { id: eventId } = await params;
  if (!await eventFor(auth.adminId, eventId)) {
    return NextResponse.json({ ok: false, code: "event_not_found" }, { status: 404 });
  }
  const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
  const clientId = text(payload?.id, 100);
  const baseVersion = Number.isInteger(payload?.baseVersion) ? Number(payload?.baseVersion) : -1;
  if (!clientId || baseVersion < 0) {
    return NextResponse.json({ ok: false, code: "invalid_client" }, { status: 400 });
  }
  const existing = await prisma.irisMomentSharedClient.findFirst({
    where: { id: clientId, adminId: auth.adminId, miniSessionId: eventId },
    include: clientInclude
  });
  if (!existing) return NextResponse.json({ ok: true, client: null });
  if (existing.deletedAt) return NextResponse.json({ ok: true, client: serializeClient(existing) });
  if (existing.version !== baseVersion) {
    return NextResponse.json({ ok: false, code: "version_conflict", client: serializeClient(existing) }, { status: 409 });
  }
  const changed = await prisma.irisMomentSharedClient.updateMany({
    where: { id: clientId, adminId: auth.adminId, miniSessionId: eventId, version: baseVersion, deletedAt: null },
    data: { deletedAt: new Date(), updatedByDeviceId: auth.device?.id ?? null, version: { increment: 1 } }
  });
  if (changed.count !== 1) {
    const current = await prisma.irisMomentSharedClient.findUnique({ where: { id: clientId }, include: clientInclude });
    return NextResponse.json({
      ok: false, code: "version_conflict", client: current ? serializeClient(current) : null
    }, { status: 409 });
  }
  const deleted = await prisma.irisMomentSharedClient.findUniqueOrThrow({
    where: { id: clientId }, include: clientInclude
  });
  revalidateTag(workspaceTag(auth.adminId, eventId));
  return NextResponse.json({ ok: true, client: serializeClient(deleted) });
}
