import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import { getEmailHealthStatus } from "@/lib/email-health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await requireSuperAdmin();

  try {
    const status = await getEmailHealthStatus();
    return NextResponse.json(status, {
      headers: { "Cache-Control": "no-store, max-age=0" }
    });
  } catch (error) {
    console.error("E-mail health check failed", error);
    return NextResponse.json(
      {
        healthy: false,
        checkedAt: new Date().toISOString(),
        incident: {
          id: "email-health-check-failed",
          code: "MONITOR_ERROR",
          message: "Az e-mail-felügyelet nem tudta ellenőrizni a küldési naplót.",
          subject: null,
          recipient: null,
          occurredAt: new Date().toISOString(),
          consecutiveFailures: 0
        }
      },
      {
        status: 503,
        headers: { "Cache-Control": "no-store, max-age=0" }
      }
    );
  }
}
