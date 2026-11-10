import { NextRequest, NextResponse } from "next/server";
import { authenticateIrisRetouch } from "@/lib/iris-retouch-auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function DELETE(request: NextRequest) {
  const auth = await authenticateIrisRetouch(request);
  if (!auth) return NextResponse.json({ ok: false, code: "invalid_token" }, { status: 401 });
  if (!auth.device) return NextResponse.json({ ok: false, code: "device_not_found" }, { status: 404 });
  await prisma.irisMomentDevice.update({
    where: { id: auth.device.id },
    data: { revokedAt: new Date() }
  });
  return NextResponse.json({ ok: true });
}
