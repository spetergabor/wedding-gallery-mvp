import { NextResponse } from "next/server";
import { authorizeMetaAdsApi, publicError } from "@/lib/meta-ads/http";
import { runMetaAdsPipeline } from "@/lib/meta-ads/pipeline";

export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(request: Request) {
  const auth = await authorizeMetaAdsApi();
  if (!auth.ok) return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  const body = await request.json().catch(() => ({})) as { backfill?: boolean; lookbackDays?: number };
  const lookbackDays = Math.min(365, Math.max(1, Math.floor(Number(body.lookbackDays) || (body.backfill ? 90 : 7))));
  try {
    const result = await runMetaAdsPipeline({ mode: body.backfill ? "backfill" : "manual", lookbackDays });
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (error) {
    const result = publicError(error);
    return NextResponse.json({ ok: false, message: result.message }, { status: result.status });
  }
}
