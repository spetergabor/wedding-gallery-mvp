import { NextResponse } from "next/server";
import { buildCapacityForecast } from "@/lib/meta-ads/capacity-forecast";
import { authorizeMetaAdsApi, publicError } from "@/lib/meta-ads/http";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function numberFromThresholds(value: unknown, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const parsed = Number((value as Record<string, unknown>)[key]);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export async function GET() {
  const auth = await authorizeMetaAdsApi();
  if (!auth.ok) return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  try {
    const config = await prisma.metaBusinessConfig.findUnique({ where: { brand: "IRISMOMENT" } });
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 7);
    const daily = await prisma.metaDailyInsight.findMany({ where: { brand: "IRISMOMENT", entityLevel: "account", date: { gte: since } } });
    const currentDailySpend = daily.length ? daily.reduce((sum, row) => sum + Number(row.spend ?? 0), 0) / new Set(daily.map((row) => row.date.toISOString().slice(0, 10))).size : null;
    const forecast = buildCapacityForecast({
      eventDate: config?.eventDate ?? null,
      totalCapacity: config?.availableAppointments ?? null,
      booked: config?.bookedAppointments ?? null,
      averageDailyBookings: numberFromThresholds(config?.thresholds, "averageDailyBookings"),
      currentDailySpend,
      costPerBooking: config?.costPerBookingTarget == null ? null : Number(config.costPerBookingTarget)
    });
    return NextResponse.json({ ok: true, brand: "IRISMOMENT", forecast });
  } catch (error) {
    const result = publicError(error);
    return NextResponse.json({ ok: false, message: result.message }, { status: result.status });
  }
}
