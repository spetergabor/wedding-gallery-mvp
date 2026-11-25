import { NextResponse } from "next/server";
import { authorizeMetaAdsApi, publicError } from "@/lib/meta-ads/http";
import { runMetaAdsSmokeTest } from "@/lib/meta-ads/smoke-test";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST() {
  const auth = await authorizeMetaAdsApi();
  if (!auth.ok) return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  try {
    return NextResponse.json(await runMetaAdsSmokeTest(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const result = publicError(error);
    return NextResponse.json({ ok: false, message: result.message }, { status: result.status });
  }
}
