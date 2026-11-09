import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { authenticateIrisRetouch, IRIS_FULFILLMENT_MODE } from "@/lib/iris-retouch-auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function text(value: unknown, max = 300) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const integration = await authenticateIrisRetouch(request);
  if (!integration) return NextResponse.json({ ok: false, code: "invalid_token" }, { status: 401 });
  const { id } = await params;
  const event = await prisma.miniSession.findFirst({
    where: { id, adminId: integration.adminId, fulfillmentMode: IRIS_FULFILLMENT_MODE }
  });
  if (!event) return NextResponse.json({ ok: false, code: "event_not_found" }, { status: 404 });
  const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
  const name = text(payload?.name);
  const email = text(payload?.email).toLowerCase();
  const phone = text(payload?.phone, 100);
  const attendeeCount = Math.min(10, Math.max(1, Number(payload?.attendeeCount) || 1));
  if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, code: "invalid_guest" }, { status: 400 });
  }
  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + event.durationMinutes * 60_000);
  const booking = await prisma.miniSessionBooking.create({
    data: {
      miniSessionId: event.id,
      name,
      email,
      phone,
      attendeeCount,
      startsAt,
      endsAt,
      source: "walk_in",
      cancelToken: randomBytes(24).toString("hex"),
      irisStatus: "checked_in",
      irisCheckedInAt: startsAt,
      irisExternalClientId: text(payload?.externalClientId, 100) || null
    }
  });
  return NextResponse.json({
    ok: true,
    booking: {
      id: booking.id, name: booking.name, email: booking.email, phone: booking.phone,
      attendeeCount: booking.attendeeCount, startsAt: booking.startsAt.toISOString(),
      endsAt: booking.endsAt.toISOString(), status: booking.status, source: booking.source,
      irisStatus: booking.irisStatus, irisCheckedInAt: booking.irisCheckedInAt?.toISOString(),
      updatedAt: booking.updatedAt.toISOString()
    }
  }, { status: 201 });
}
