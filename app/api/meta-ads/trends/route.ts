import { NextRequest, NextResponse } from "next/server";
import { getMetaHistoricalTrends } from "@/lib/meta-ads/dashboard";
import { authorizeMetaAdsApi, publicError } from "@/lib/meta-ads/http";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const auth = await authorizeMetaAdsApi();
  if (!auth.ok) return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  try {
    const params = request.nextUrl.searchParams;
    const trends = await getMetaHistoricalTrends({
      brand: params.get("brand") ?? undefined,
      entityLevel: params.get("entityLevel") ?? undefined,
      entityExternalId: params.get("entityExternalId") ?? undefined,
      days: Number(params.get("days")) || 90
    });
    return NextResponse.json({ ok: true, trends });
  } catch (error) {
    const result = publicError(error);
    return NextResponse.json({ ok: false, message: result.message }, { status: result.status });
  }
}
