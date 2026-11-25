import { NextRequest, NextResponse } from "next/server";
import { getMetaPlacementPerformance } from "@/lib/meta-ads/dashboard";
import { authorizeMetaAdsApi, publicError } from "@/lib/meta-ads/http";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await authorizeMetaAdsApi();
  if (!auth.ok) return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  try {
    return NextResponse.json({ ok: true, ...await getMetaPlacementPerformance({
      brand: request.nextUrl.searchParams.get("brand") ?? undefined,
      campaignExternalId: request.nextUrl.searchParams.get("campaign") ?? undefined,
      days: Number(request.nextUrl.searchParams.get("days") ?? 30)
    }) });
  } catch (error) {
    const result = publicError(error);
    return NextResponse.json({ ok: false, message: result.message }, { status: result.status });
  }
}
