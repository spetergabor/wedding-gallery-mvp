import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { type GalleryDownloadQuality } from "@/lib/download-quality";
import { paidGalleryScope } from "@/lib/gallery-sales-shared";

export const PUBLIC_DOWNLOAD_SCOPE = "public";
export const LEGACY_PUBLIC_WEB_DOWNLOAD_SCOPE = "public_web";
export const LEGACY_PUBLIC_WEB_DOWNLOAD_SCOPE_V2 = "public_web_v2";
export const PUBLIC_WEB_DOWNLOAD_SCOPE = "public_web_v3";
export const PUBLIC_DOWNLOAD_SCOPES = [
  PUBLIC_DOWNLOAD_SCOPE,
  LEGACY_PUBLIC_WEB_DOWNLOAD_SCOPE,
  LEGACY_PUBLIC_WEB_DOWNLOAD_SCOPE_V2,
  PUBLIC_WEB_DOWNLOAD_SCOPE
] as const;
export const DOWNLOAD_LINK_TTL_DAYS = 7;
export const DOWNLOAD_LINK_TTL_MS = DOWNLOAD_LINK_TTL_DAYS * 24 * 60 * 60 * 1000;

export function publicDownloadScopeForQuality(value: string | null | undefined) {
  void value;

  return PUBLIC_DOWNLOAD_SCOPE;
}

export function publicDownloadQualityFromScope(scope: string | null | undefined): GalleryDownloadQuality {
  return scope?.startsWith("public_web") ? "web" : "original";
}

function createDownloadToken() {
  return randomBytes(32).toString("base64url");
}

export function downloadLinkExpiresAt(now = new Date()) {
  return new Date(now.getTime() + DOWNLOAD_LINK_TTL_MS);
}

export async function ensureDownloadPackageAccessToken(packageId: string) {
  const now = new Date();
  const downloadPackage = await prisma.galleryDownloadPackage.findUnique({
    where: { id: packageId },
    select: {
      id: true,
      accessToken: true,
      accessTokenExpiresAt: true
    }
  });

  if (!downloadPackage) {
    throw new Error("Download package was not found.");
  }

  if (
    downloadPackage.accessToken &&
    downloadPackage.accessTokenExpiresAt &&
    downloadPackage.accessTokenExpiresAt > now
  ) {
    return {
      token: downloadPackage.accessToken,
      expiresAt: downloadPackage.accessTokenExpiresAt
    };
  }

  const expiresAt = downloadLinkExpiresAt(now);
  const updatedPackage = await prisma.galleryDownloadPackage.update({
    where: { id: packageId },
    data: {
      accessToken: createDownloadToken(),
      accessTokenExpiresAt: expiresAt,
      linkCreatedAt: now
    },
    select: {
      accessToken: true,
      accessTokenExpiresAt: true
    }
  });

  return {
    token: updatedPackage.accessToken!,
    expiresAt: updatedPackage.accessTokenExpiresAt!
  };
}

export async function invalidatePublicGalleryDownloadPackages(galleryId: string) {
  const trackedScopes = [...PUBLIC_DOWNLOAD_SCOPES, paidGalleryScope(galleryId)];
  const stalePackages = await prisma.galleryDownloadPackage.findMany({
    where: {
      galleryId,
      scope: { in: trackedScopes },
      status: { in: ["pending", "processing", "completed", "failed"] }
    },
    select: { id: true }
  });

  if (stalePackages.length === 0) {
    return;
  }

  const packageIds = stalePackages.map((downloadPackage) => downloadPackage.id);

  await prisma.$transaction([
    prisma.galleryDownloadPackage.updateMany({
      where: { id: { in: packageIds } },
      data: {
        status: "stale",
        errorMessage: "A galéria képlistája megváltozott, ezért új ZIP szükséges."
      }
    }),
    prisma.galleryDownload.updateMany({
      where: {
        galleryId,
        packageId: { in: packageIds },
        status: { in: ["waiting", "email_failed"] }
      },
      data: {
        status: "stale",
        downloadLinkEmailError: "A galéria képlistája megváltozott az email kiküldése előtt."
      }
    })
  ]);
}
