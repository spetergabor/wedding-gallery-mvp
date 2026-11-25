import { NextRequest, NextResponse } from "next/server";
import { summarizeCityBookingEvent } from "@/lib/meta-ads/city-bookings";
import { authorizeMetaAdsApi, publicError } from "@/lib/meta-ads/http";
import { resolveIrisMomentCity } from "@/lib/meta-ads/cities";
import { IRIS_FULFILLMENT_MODE } from "@/lib/iris-retouch-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await authorizeMetaAdsApi();
  if (!auth.ok) return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });

  try {
    const requestedDays = Number(request.nextUrl.searchParams.get("days") ?? 30);
    const days = Number.isFinite(requestedDays) ? Math.min(365, Math.max(1, Math.trunc(requestedDays))) : 30;
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - days + 1);
    const events = await prisma.miniSession.findMany({
      where: {
        adminId: auth.admin.id,
        fulfillmentMode: IRIS_FULFILLMENT_MODE,
        endsAt: { gte: since }
      },
      include: {
        eventDays: { orderBy: { date: "asc" } },
        availabilityRules: true,
        bookings: {
          select: { startsAt: true, endsAt: true, status: true, source: true }
        }
      },
      orderBy: [{ startsAt: "desc" }],
      take: 100
    });

    const grouped = new Map<string, {
      key: string;
      label: string;
      bookingCount: number;
      totalSlots: number;
      freeSlots: number;
      events: Array<{
        id: string;
        title: string;
        location: string;
        startsAt: string;
        endsAt: string;
        isActive: boolean;
        bookingCount: number;
        totalSlots: number;
        freeSlots: number;
      }>;
    }>();

    for (const event of events) {
      const city = resolveIrisMomentCity(event.title, event.location, event.slug);
      if (!city) continue;

      const summary = summarizeCityBookingEvent(event);
      const cityEvent = {
        id: event.id,
        title: event.title,
        location: event.location,
        startsAt: event.startsAt.toISOString(),
        endsAt: event.endsAt.toISOString(),
        isActive: event.isActive,
        bookingCount: summary.bookingCount,
        totalSlots: summary.totalSlots,
        freeSlots: summary.freeSlots
      };
      const current = grouped.get(city.key) ?? {
        key: city.key,
        label: city.label,
        bookingCount: 0,
        totalSlots: 0,
        freeSlots: 0,
        events: []
      };
      current.bookingCount += summary.bookingCount;
      current.totalSlots += summary.totalSlots;
      current.freeSlots += summary.freeSlots;
      current.events.push(cityEvent);
      grouped.set(city.key, current);
    }

    return NextResponse.json({ ok: true, days, cities: [...grouped.values()] });
  } catch (error) {
    const result = publicError(error);
    return NextResponse.json({ ok: false, message: result.message }, { status: result.status });
  }
}
