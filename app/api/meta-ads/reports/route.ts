import { NextRequest, NextResponse } from "next/server";
import { authorizeMetaAdsApi, publicError } from "@/lib/meta-ads/http";
import { buildMetaAdsReport, type MetaReportKind } from "@/lib/meta-ads/pipeline";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const auth = await authorizeMetaAdsApi();
  if (!auth.ok) return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  const rawKind = request.nextUrl.searchParams.get("kind");
  const kind: MetaReportKind = rawKind === "weekly" || rawKind === "monthly" ? rawKind : "daily";
  try {
    return NextResponse.json({ ok: true, report: await buildMetaAdsReport(kind) });
  } catch (error) {
    const result = publicError(error);
    return NextResponse.json({ ok: false, message: result.message }, { status: result.status });
  }
}
