import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createPresignedPhotoDownloadUrl } from "@/lib/storage";
import { PROOFING_STATUS_DELIVERED, isProofingGallery } from "@/lib/proofing";
import { galleryZipFileName } from "@/lib/jobs";
import { publicDownloadQualityFromScope } from "@/lib/download-packages";
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
      status: true,
      scope: true,
      r2Key: true,
      partIndex: true,
      partCount: true,
      accessTokenExpiresAt: true,
      gallery: {
        select: {
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
    !isPaidPurchaseScope(downloadPackage.scope) &&
    (!downloadPackage.gallery.downloadsEnabled || !galleryDeliveryAllowsDownloads(downloadPackage.gallery.deliveryMode))
  ) {
    return plainTextResponse("Downloads sind für diese Galerie derzeit deaktiviert.", 403);
  }

  if (
    isProofingGallery(downloadPackage.gallery.galleryMode) &&
    downloadPackage.gallery.proofingStatus !== PROOFING_STATUS_DELIVERED
  ) {
    return plainTextResponse("Die finalen Fotos sind noch nicht freigegeben.", 403);
  }

  if (!downloadPackage.accessTokenExpiresAt || downloadPackage.accessTokenExpiresAt <= new Date()) {
    return plainTextResponse("Dieser Download-Link ist abgelaufen.", 410);
  }

  const signedUrl = await createPresignedPhotoDownloadUrl({
    r2Key: downloadPackage.r2Key,
    filename: galleryZipFileName(
      downloadPackage.gallery.title,
      downloadPackage.partIndex,
      downloadPackage.partCount,
      publicDownloadQualityFromScope(downloadPackage.scope)
    )
  });

  return NextResponse.redirect(signedUrl);
}
