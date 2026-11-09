import { NextRequest, NextResponse } from "next/server";
import { authenticateIrisRetouch, IRIS_FULFILLMENT_MODE } from "@/lib/iris-retouch-auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const integration = await authenticateIrisRetouch(request);
  if (!integration) return NextResponse.json({ ok: false, code: "invalid_token" }, { status: 401 });

  const events = await prisma.miniSession.findMany({
    where: {
      adminId: integration.adminId,
      fulfillmentMode: IRIS_FULFILLMENT_MODE
    },
    orderBy: [{ startsAt: "desc" }],
    take: 100,
    include: {
      eventDays: { orderBy: { date: "asc" } },
      _count: { select: { bookings: true } }
    }
  });

  return NextResponse.json({
    ok: true,
    events: events.map((event) => ({
      id: event.id,
      title: event.title,
      location: event.location,
      bookingMode: event.bookingMode,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt.toISOString(),
      durationMinutes: event.durationMinutes,
      isActive: event.isActive,
      bookingCount: event._count.bookings,
      eventDays: event.eventDays.map((day) => ({
        date: day.date.toISOString(), startsAt: day.startsAt, endsAt: day.endsAt
      }))
    }))
  });
}
