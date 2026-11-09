import { NextRequest, NextResponse } from "next/server";
import { authenticateIrisRetouch } from "@/lib/iris-retouch-auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const integration = await authenticateIrisRetouch(request);
  if (!integration) {
    return NextResponse.json({ ok: false, code: "invalid_token" }, { status: 401 });
  }
  return NextResponse.json({
    ok: true,
    workspace: {
      id: integration.admin.id,
      name: integration.admin.siteSettings?.businessName || integration.admin.name,
      email: integration.admin.email
    },
    connectedAt: integration.createdAt.toISOString(),
    lastUsedAt: integration.lastUsedAt?.toISOString() ?? null
  });
}
