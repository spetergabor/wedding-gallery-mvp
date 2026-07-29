import { NextRequest, NextResponse } from "next/server";
import { publicGalleryUrl } from "@/lib/email";
import { hashLightroomUploadToken, normalizeLightroomUploadToken } from "@/lib/lightroom-upload-token";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

async function tokenFromRequest(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";

  if (authorization.toLowerCase().startsWith("bearer ")) {
    return normalizeLightroomUploadToken(authorization.slice(7));
  }

  const queryToken = request.nextUrl.searchParams.get("token");

  if (queryToken) {
    return normalizeLightroomUploadToken(queryToken);
  }

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => null);

    if (body && typeof body === "object" && "token" in body) {
      return normalizeLightroomUploadToken((body as { token?: unknown }).token);
    }
  }

  const formData = await request.formData().catch(() => null);
  return normalizeLightroomUploadToken(formData?.get("token"));
}

export async function POST(request: NextRequest) {
  const token = await tokenFromRequest(request);

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

  const tokenHash = hashLightroomUploadToken(token);
  const gallery = await prisma.gallery.findFirst({
    where: {
      lightroomUploadTokenHash: tokenHash
    },
    select: {
      id: true,
      title: true,
      slug: true,
      isActive: true,
      lightroomUploadsEnabled: true,
      lightroomUploadTokenCreatedAt: true,
      lightroomUploadTokenLastUsedAt: true,
      _count: {
        select: { photos: true }
      },
      customer: {
        select: {
          coupleName: true,
          preferredLanguage: true
        }
      },
      admin: {
        select: {
          name: true,
          siteSettings: {
            select: {
              businessName: true,
              publicSubdomain: true
            }
          }
        }
      }
    }
  });

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
    target: {
      galleryId: gallery.id,
      title: gallery.title,
      slug: gallery.slug,
      active: gallery.isActive,
      photoCount: gallery._count.photos,
      publicUrl: publicGalleryUrl(gallery.slug, gallery.customer?.preferredLanguage, gallery.admin.siteSettings?.publicSubdomain ?? null),
      customerName: gallery.customer?.coupleName ?? null,
      photographerName: gallery.admin.siteSettings?.businessName || gallery.admin.name,
      tokenCreatedAt: gallery.lightroomUploadTokenCreatedAt?.toISOString() ?? null,
      tokenLastUsedAt: gallery.lightroomUploadTokenLastUsedAt?.toISOString() ?? null
    }
  });
}
