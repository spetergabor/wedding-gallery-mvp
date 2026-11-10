import { NextRequest, NextResponse } from "next/server";
import { createIrisMomentDeviceToken, hashIrisRetouchToken } from "@/lib/iris-retouch-auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
  const deviceExternalId = text(payload?.deviceId, 100);
  const deviceName = text(payload?.deviceName, 120);
  const appVersion = text(payload?.appVersion, 50) || null;
  if (!deviceExternalId || !deviceName) {
    return NextResponse.json({ ok: false, code: "invalid_device" }, { status: 400 });
  }
  const token = createIrisMomentDeviceToken();
  const authorization = await prisma.irisMomentDeviceAuthorization.create({
    data: {
      tokenHash: hashIrisRetouchToken(token),
      deviceExternalId,
      deviceName,
      appVersion,
      expiresAt: new Date(Date.now() + 10 * 60_000)
    }
  });
  const verificationURL = new URL("/admin/mini-sessions/irismoment/devices/authorize", request.nextUrl.origin);
  verificationURL.searchParams.set("id", authorization.id);
  return NextResponse.json({
    ok: true,
    authorizationId: authorization.id,
    deviceToken: token,
    verificationURL: verificationURL.toString(),
    expiresAt: authorization.expiresAt.toISOString()
  });
}
