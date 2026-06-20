import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createPresignedPhotoDownloadUrl } from "@/lib/storage";

function galleryZipFileName(title: string) {
  return `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "") || "gallery"}.zip`;
}

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
      r2Key: true,
      accessTokenExpiresAt: true,
      gallery: {
        select: {
          title: true
        }
      }
    }
  });

  if (!downloadPackage || downloadPackage.status !== "completed" || !downloadPackage.r2Key) {
    return plainTextResponse("Download-Link ist ungültig oder nicht mehr verfügbar.", 404);
  }

  if (!downloadPackage.accessTokenExpiresAt || downloadPackage.accessTokenExpiresAt <= new Date()) {
    return plainTextResponse("Dieser Download-Link ist abgelaufen.", 410);
  }

  const signedUrl = await createPresignedPhotoDownloadUrl({
    r2Key: downloadPackage.r2Key,
    filename: galleryZipFileName(downloadPackage.gallery.title)
  });

  return NextResponse.redirect(signedUrl);
}
