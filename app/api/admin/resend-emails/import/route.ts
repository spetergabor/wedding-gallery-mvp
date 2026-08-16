import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { importResendEmailHistoryPage } from "@/lib/resend-history-import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  await requireSuperAdmin();

  try {
    const body: unknown = await request.json().catch(() => ({}));
    const cursor = body && typeof body === "object" && "cursor" in body && typeof body.cursor === "string" ? body.cursor : null;
    const result = await importResendEmailHistoryPage(cursor);

    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store, max-age=0" }
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "The Resend history import failed." },
      {
        status: 502,
        headers: { "Cache-Control": "no-store, max-age=0" }
      }
    );
  }
}
