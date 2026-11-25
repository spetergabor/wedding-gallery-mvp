import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { metaAdsConfigurationStatus } from "@/lib/meta-ads/config";
import { authorizeMetaAdsApi, publicError } from "@/lib/meta-ads/http";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
const BRANDS = new Set(["SPETER", "IRISMOMENT"]);
const numericFields = ["customerAcquisitionCost", "contractValue", "costPerBookingTarget", "averageCustomerValue", "capacityUtilizationTarget"] as const;
const integerFields = ["availableAppointments", "bookedAppointments"] as const;
const textFields = ["qualifiedLeadDefinition", "consultationDefinition", "bookingDefinition", "eventLocation", "currency", "timezone"] as const;

export async function GET() {
  const auth = await authorizeMetaAdsApi();
  if (!auth.ok) return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  try {
    return NextResponse.json({ ok: true, runtime: metaAdsConfigurationStatus(), businesses: await prisma.metaBusinessConfig.findMany({ orderBy: { brand: "asc" } }) });
  } catch (error) {
    const result = publicError(error);
    return NextResponse.json({ ok: false, message: result.message }, { status: result.status });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await authorizeMetaAdsApi();
  if (!auth.ok) return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.brand !== "string" || !BRANDS.has(body.brand)) {
    return NextResponse.json({ ok: false, message: "Unsupported brand." }, { status: 400 });
  }
  const data: Record<string, unknown> = {};
  for (const field of textFields) {
    if (body[field] === null || typeof body[field] === "string") data[field] = typeof body[field] === "string" ? body[field].trim() || null : null;
  }
  for (const field of numericFields) {
    if (body[field] === null) data[field] = null;
    else if (body[field] !== undefined && Number.isFinite(Number(body[field])) && Number(body[field]) >= 0) data[field] = new Prisma.Decimal(Number(body[field]));
  }
  for (const field of integerFields) {
    if (body[field] === null) data[field] = null;
    else if (body[field] !== undefined && Number.isInteger(Number(body[field])) && Number(body[field]) >= 0) data[field] = Number(body[field]);
  }
  if (body.eventDate === null || typeof body.eventDate === "string") {
    const parsed = typeof body.eventDate === "string" ? new Date(body.eventDate) : null;
    if (!parsed || !Number.isNaN(parsed.getTime())) data.eventDate = parsed;
  }
  if (body.thresholds && typeof body.thresholds === "object" && !Array.isArray(body.thresholds)) data.thresholds = body.thresholds as Prisma.InputJsonValue;
  try {
    const config = await prisma.metaBusinessConfig.upsert({ where: { brand: body.brand }, create: { brand: body.brand, ...data }, update: data });
    return NextResponse.json({ ok: true, config });
  } catch (error) {
    const result = publicError(error);
    return NextResponse.json({ ok: false, message: result.message }, { status: result.status });
  }
}
