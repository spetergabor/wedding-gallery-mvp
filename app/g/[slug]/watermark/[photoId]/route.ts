import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { GALLERY_DELIVERY_PAID, normalizeGalleryDeliveryMode } from "@/lib/gallery-delivery";
import { createWatermarkedGalleryPreview } from "@/lib/gallery-watermark";
import { prisma } from "@/lib/prisma";
import {
  PHOTO_DELIVERY_STAGE_FINAL,
  PHOTO_DELIVERY_STAGE_RAW,
  PROOFING_STATUS_DELIVERED,
  isProofingGallery
} from "@/lib/proofing";
import { getR2KeyFromPublicUrl, loadPhotoObjectBuffer } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function galleryCookie(slug: string) {
  return `wgm_gallery_${slug}`;
}

async function canViewProtectedGallery(slug: string, password: string | null) {
  if (!password) {
    return true;
  }

  const cookieStore = await cookies();
  return cookieStore.get(galleryCookie(slug))?.value === "unlocked";
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
    params: Promise<{ slug: string; photoId: string }>;
  }
) {
  const { slug, photoId } = await params;

  if (!slug || !photoId) {
    return plainTextResponse("Image not found.", 404);
  }

  const photo = await prisma.photo.findUnique({
    where: { id: photoId },
    select: {
      id: true,
      r2Key: true,
      imageUrl: true,
      thumbnailUrl: true,
      previewUrl: true,
      mediaType: true,
      isClientHidden: true,
      deliveryStage: true,
      gallery: {
        select: {
          id: true,
          slug: true,
          adminId: true,
          isActive: true,
          password: true,
          deliveryMode: true,
          galleryMode: true,
          proofingStatus: true
        }
      }
    }
  });

  if (!photo || photo.gallery.slug !== slug || photo.mediaType === "video") {
    return plainTextResponse("Image not found.", 404);
  }

  if (!photo.gallery.isActive || normalizeGalleryDeliveryMode(photo.gallery.deliveryMode) !== GALLERY_DELIVERY_PAID) {
    return plainTextResponse("Image not available.", 403);
  }

  const canView = await canViewProtectedGallery(slug, photo.gallery.password);

  if (!canView) {
    return plainTextResponse("Gallery is locked.", 403);
  }

  const expectedDeliveryStage =
    isProofingGallery(photo.gallery.galleryMode) && photo.gallery.proofingStatus !== PROOFING_STATUS_DELIVERED
      ? PHOTO_DELIVERY_STAGE_RAW
      : PHOTO_DELIVERY_STAGE_FINAL;

  if (photo.isClientHidden || photo.deliveryStage !== expectedDeliveryStage) {
    return plainTextResponse("Image not found.", 404);
  }

  const sourceUrl = photo.previewUrl || photo.thumbnailUrl || photo.imageUrl;
  const sourceR2Key =
    getR2KeyFromPublicUrl(photo.previewUrl) ??
    getR2KeyFromPublicUrl(photo.thumbnailUrl) ??
    (photo.r2Key || null) ??
    getR2KeyFromPublicUrl(photo.imageUrl);

  try {
    const sourceBuffer = await loadPhotoObjectBuffer({
      r2Key: sourceR2Key,
      publicUrl: sourceUrl
    });
    const watermarkedBuffer = await createWatermarkedGalleryPreview(sourceBuffer, {
      text: "PREVIEW",
      position: "tile",
      opacity: 34
    });

    const responseBody = new ArrayBuffer(watermarkedBuffer.byteLength);
    new Uint8Array(responseBody).set(watermarkedBuffer);

    return new NextResponse(responseBody, {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=3600",
        "Content-Disposition": "inline",
        "Content-Type": "image/jpeg",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    console.error("Failed to render paid gallery watermark", {
      photoId: photo.id,
      galleryId: photo.gallery.id,
      error
    });

    return plainTextResponse("Image could not be rendered.", 500);
  }
}
