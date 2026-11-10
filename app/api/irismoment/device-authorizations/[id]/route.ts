import { NextRequest, NextResponse } from "next/server";
import { hashIrisRetouchToken, readIrisRetouchToken } from "@/lib/iris-retouch-auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = readIrisRetouchToken(request);
  if (!token) return NextResponse.json({ ok: false, code: "invalid_token" }, { status: 401 });
  const authorization = await prisma.irisMomentDeviceAuthorization.findFirst({
    where: { id, tokenHash: hashIrisRetouchToken(token) }
  });
  if (!authorization) return NextResponse.json({ ok: false, code: "not_found" }, { status: 404 });
  if (authorization.expiresAt <= new Date() && authorization.status !== "approved") {
    return NextResponse.json({ ok: false, code: "expired" }, { status: 410 });
  }
  if (authorization.status === "approved" && !authorization.usedAt) {
    await prisma.irisMomentDeviceAuthorization.update({
      where: { id },
      data: { usedAt: new Date() }
    });
  }
  return NextResponse.json({
    ok: true,
    status: authorization.status,
    approved: authorization.status === "approved"
  });
}
