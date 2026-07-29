import "server-only";

import { NextRequest } from "next/server";
import { publicGalleryUrl } from "@/lib/email";
import { hashLightroomUploadToken, normalizeLightroomUploadToken } from "@/lib/lightroom-upload-token";
import { prisma } from "@/lib/prisma";

export type LightroomUploadTarget = Awaited<ReturnType<typeof findLightroomUploadTarget>>;

export async function readLightroomUploadToken(request: NextRequest, body?: unknown) {
  const authorization = request.headers.get("authorization") ?? "";

  if (authorization.toLowerCase().startsWith("bearer ")) {
    return normalizeLightroomUploadToken(authorization.slice(7));
  }

  const queryToken = request.nextUrl.searchParams.get("token");

  if (queryToken) {
    return normalizeLightroomUploadToken(queryToken);
  }

  if (body && typeof body === "object" && "token" in body) {
    return normalizeLightroomUploadToken((body as { token?: unknown }).token);
  }

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const parsedBody = await request.json().catch(() => null);

    if (parsedBody && typeof parsedBody === "object" && "token" in parsedBody) {
      return normalizeLightroomUploadToken((parsedBody as { token?: unknown }).token);
    }
  }

  const formData = await request.formData().catch(() => null);
  return normalizeLightroomUploadToken(formData?.get("token"));
}

export async function findLightroomUploadTarget(token: string) {
  const tokenHash = hashLightroomUploadToken(token);

  return prisma.gallery.findFirst({
    where: {
      lightroomUploadTokenHash: tokenHash
    },
    select: {
      id: true,
      title: true,
      slug: true,
      isActive: true,
      galleryMode: true,
      clientEmail: true,
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
}

export function lightroomTargetPayload(gallery: NonNullable<LightroomUploadTarget>) {
  return {
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
  };
}
