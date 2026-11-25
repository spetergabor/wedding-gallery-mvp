import { NextResponse } from "next/server";
import { getMetaAdsOverview } from "@/lib/meta-ads/dashboard";
import { authorizeMetaAdsApi, publicError } from "@/lib/meta-ads/http";

export const dynamic = "force-dynamic";
export async function GET() {
  const auth = await authorizeMetaAdsApi();
  if (!auth.ok) return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  try {
    return NextResponse.json({ ok: true, overview: await getMetaAdsOverview() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const result = publicError(error);
    return NextResponse.json({ ok: false, message: result.message }, { status: result.status });
  }
}
