import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createPresignedPhotoDownloadUrl } from "@/lib/storage";
import { PROOFING_STATUS_DELIVERED, isProofingGallery } from "@/lib/proofing";
import { galleryZipFileName } from "@/lib/jobs";
import {
  favoriteListIdFromScope,
  isAdminFavoriteDownloadScope,
  isGuestUploadDownloadScope,
  publicDownloadQualityFromScope
} from "@/lib/download-packages";
import { galleryDeliveryAllowsDownloads } from "@/lib/gallery-delivery";
import { isPaidPurchaseScope } from "@/lib/gallery-sales-shared";

function plainTextResponse(message: string, status: number) {
  return new NextResponse(message, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8"
    }
  });
}

export async function GET(
  _request: Request,
  {
    params
  }: {
    params: Promise<{ token: string }>;
  }
) {
  const { token } = await params;

  if (!token) {
    return plainTextResponse("Download-Link ist ungültig.", 404);
  }

  const downloadPackage = await prisma.galleryDownloadPackage.findUnique({
    where: { accessToken: token },
    select: {
      id: true,
      status: true,
      scope: true,
      r2Key: true,
      partIndex: true,
      partCount: true,
      accessTokenExpiresAt: true,
      gallery: {
        select: {
          id: true,
          title: true,
          downloadsEnabled: true,
          deliveryMode: true,
          galleryMode: true,
          proofingStatus: true
        }
      }
    }
  });

  if (!downloadPackage || downloadPackage.status !== "completed" || !downloadPackage.r2Key) {
    return plainTextResponse("Download-Link ist ungültig oder nicht mehr verfügbar.", 404);
  }

  if (
    !isGuestUploadDownloadScope(downloadPackage.scope) &&
    !isAdminFavoriteDownloadScope(downloadPackage.scope) &&
    !isPaidPurchaseScope(downloadPackage.scope) &&
    (!downloadPackage.gallery.downloadsEnabled || !galleryDeliveryAllowsDownloads(downloadPackage.gallery.deliveryMode))
  ) {
    return plainTextResponse("Downloads sind für diese Galerie derzeit deaktiviert.", 403);
  }

  if (
    !isAdminFavoriteDownloadScope(downloadPackage.scope) &&
    isProofingGallery(downloadPackage.gallery.galleryMode) &&
    downloadPackage.gallery.proofingStatus !== PROOFING_STATUS_DELIVERED
  ) {
    return plainTextResponse("Die finalen Fotos sind noch nicht freigegeben.", 403);
  }

  if (!downloadPackage.accessTokenExpiresAt || downloadPackage.accessTokenExpiresAt <= new Date()) {
    return plainTextResponse("Dieser Download-Link ist abgelaufen.", 410);
  }

  const favoriteListId = favoriteListIdFromScope(downloadPackage.scope);
  const favoriteList = favoriteListId
    ? await prisma.galleryFavoriteList.findFirst({
        where: {
          id: favoriteListId,
          galleryId: downloadPackage.gallery.id
        },
        select: { name: true }
      })
    : null;
  const downloadTitle = favoriteList
    ? `${downloadPackage.gallery.title}-${favoriteList.name}`
    : downloadPackage.gallery.title;
  const signedUrl = await createPresignedPhotoDownloadUrl({
    r2Key: downloadPackage.r2Key,
    filename: galleryZipFileName(
      downloadTitle,
      downloadPackage.partIndex,
      downloadPackage.partCount,
      publicDownloadQualityFromScope(downloadPackage.scope)
    )
  });

  await prisma.galleryDownloadPackage.update({
    where: { id: downloadPackage.id },
    data: { lastDownloadedAt: new Date() }
  });

  return NextResponse.redirect(signedUrl);
}
