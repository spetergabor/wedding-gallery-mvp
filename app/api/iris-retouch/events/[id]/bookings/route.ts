import { NextRequest, NextResponse } from "next/server";
import { authenticateIrisRetouch, IRIS_FULFILLMENT_MODE } from "@/lib/iris-retouch-auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const integration = await authenticateIrisRetouch(request);
  if (!integration) return NextResponse.json({ ok: false, code: "invalid_token" }, { status: 401 });
  const { id } = await params;
  const event = await prisma.miniSession.findFirst({
    where: { id, adminId: integration.adminId, fulfillmentMode: IRIS_FULFILLMENT_MODE },
    select: { id: true }
  });
  if (!event) return NextResponse.json({ ok: false, code: "event_not_found" }, { status: 404 });
  const fromValue = request.nextUrl.searchParams.get("from");
  const toValue = request.nextUrl.searchParams.get("to");
  const from = fromValue ? new Date(fromValue) : null;
  const to = toValue ? new Date(toValue) : null;
  if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) {
    return NextResponse.json({ ok: false, code: "invalid_date_range" }, { status: 400 });
  }
  const bookings = await prisma.miniSessionBooking.findMany({
    where: {
      miniSessionId: id,
      source: { not: "blocked" },
      ...(from || to ? { startsAt: { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } } : {})
    },
    orderBy: [{ startsAt: "asc" }, { createdAt: "asc" }]
  });
  return NextResponse.json({
    ok: true,
    bookings: bookings.map((booking) => ({
      id: booking.id,
      name: booking.name,
      email: booking.email,
      phone: booking.phone,
      attendeeCount: booking.attendeeCount,
      startsAt: booking.startsAt.toISOString(),
      endsAt: booking.endsAt.toISOString(),
      status: booking.status,
      source: booking.source,
      adminNote: booking.adminNote,
      irisStatus: booking.irisStatus,
      irisCheckedInAt: booking.irisCheckedInAt?.toISOString() ?? null,
      irisDeliveredAt: booking.irisDeliveredAt?.toISOString() ?? null,
      irisExternalClientId: booking.irisExternalClientId,
      irisFolderName: booking.irisFolderName,
      updatedAt: booking.updatedAt.toISOString()
    }))
  });
}
