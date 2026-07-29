import { NextRequest, NextResponse } from "next/server";
import { findLightroomUploadTarget, lightroomTargetPayload, readLightroomUploadToken } from "@/lib/lightroom-upload-auth";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

export async function POST(request: NextRequest) {
  const token = await readLightroomUploadToken(request);

  if (!token) {
    return json(400, {
      ok: false,
      code: "missing_token",
      message: "Missing Lightroom upload token."
    });
  }

  const rateLimit = await consumeRateLimit({
    scope: "lightroom-upload-target-check",
    limit: 60,
    windowSeconds: 60 * 60,
    identifier: token.slice(0, 80)
  });

  if (rateLimit.limited) {
    return json(429, {
      ok: false,
      code: "rate_limited",
      message: "Too many Lightroom connection checks.",
      retryAfterSeconds: rateLimit.retryAfterSeconds
    });
  }

  const gallery = await findLightroomUploadTarget(token);

  if (!gallery) {
    return json(401, {
      ok: false,
      code: "invalid_token",
      message: "Invalid Lightroom upload token."
    });
  }

  if (!gallery.lightroomUploadsEnabled) {
    return json(403, {
      ok: false,
      code: "target_disabled",
      message: "Lightroom upload target is disabled for this gallery."
    });
  }

  await prisma.gallery.update({
    where: { id: gallery.id },
    data: { lightroomUploadTokenLastUsedAt: new Date() }
  });

  return json(200, {
    ok: true,
    target: lightroomTargetPayload(gallery)
  });
}
