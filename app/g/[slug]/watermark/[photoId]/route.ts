import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { GALLERY_DELIVERY_PAID, normalizeGalleryDeliveryMode } from "@/lib/gallery-delivery";
import { createProtectedGalleryPreviewPlaceholder, createWatermarkedGalleryPreview } from "@/lib/gallery-watermark";
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

type ProtectedPreviewPhoto = {
  id: string;
  imageUrl: string;
  thumbnailUrl: string;
  previewUrl: string;
  gallery: {
    id: string;
    slug: string;
  };
};

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

function jpegResponse(buffer: Buffer, cacheControl: string, extraHeaders: Record<string, string> = {}) {
  const responseBody = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(responseBody).set(buffer);

  return new NextResponse(responseBody, {
    headers: {
      "Cache-Control": cacheControl,
      "Content-Disposition": "inline",
      "Content-Type": "image/jpeg",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders
    }
  });
}

function normalizeStoredPath(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const withoutQuery = value.split("?")[0]?.split("#")[0] ?? value;

  try {
    const url = new URL(withoutQuery);
    return decodeURIComponent(url.pathname).replace(/^\/+/, "").replace(/^uploads\//, "");
  } catch {
    return withoutQuery.replace(/^\/+/, "").replace(/^uploads\//, "");
  }
}

function isProtectedPreviewPath(value: string | null | undefined) {
  const normalized = normalizeStoredPath(value);
  return normalized.startsWith("galleries/") && (normalized.includes("/previews/") || normalized.includes("/thumbs/"));
}

function sameStoredPath(left: string | null | undefined, right: string | null | undefined) {
  return normalizeStoredPath(left) === normalizeStoredPath(right);
}

function extractProtectedVariantR2Key(publicUrl: string | null | undefined) {
  const directKey = getR2KeyFromPublicUrl(publicUrl);

  if (isProtectedPreviewPath(directKey)) {
    return directKey;
  }

  const normalizedPath = normalizeStoredPath(publicUrl);

  if (isProtectedPreviewPath(normalizedPath)) {
    return normalizedPath;
  }

  return null;
}

function resolveProtectedPreviewSource(photo: ProtectedPreviewPhoto) {
  const candidates = [photo.previewUrl, photo.thumbnailUrl];

  for (const sourceUrl of candidates) {
    if (!sourceUrl || sameStoredPath(sourceUrl, photo.imageUrl) || !isProtectedPreviewPath(sourceUrl)) {
      continue;
    }

    return {
      sourceR2Key: extractProtectedVariantR2Key(sourceUrl),
      sourceUrl
    };
  }

  return null;
}

async function protectedPreviewPlaceholderResponse(photo: ProtectedPreviewPhoto, reason: string) {
  console.warn("Paid gallery preview fallback rendered without original image", {
    galleryId: photo.gallery.id,
    photoId: photo.id,
    reason
  });

  const placeholderBuffer = await createProtectedGalleryPreviewPlaceholder();

  return jpegResponse(placeholderBuffer, "no-store", {
    "X-Spetly-Protected-Preview": reason
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

  const protectedSource = resolveProtectedPreviewSource(photo);

  if (!protectedSource) {
    return protectedPreviewPlaceholderResponse(photo, "missing_preview_variant");
  }

  try {
    const sourceBuffer = await loadPhotoObjectBuffer({
      r2Key: protectedSource.sourceR2Key,
      publicUrl: protectedSource.sourceUrl
    });
    const watermarkedBuffer = await createWatermarkedGalleryPreview(sourceBuffer, {
      text: "PREVIEW",
      position: "tile",
      opacity: 34
    });

    return jpegResponse(watermarkedBuffer, "public, max-age=300, s-maxage=3600");
  } catch (error) {
    console.error("Failed to render paid gallery watermark", {
      photoId: photo.id,
      galleryId: photo.gallery.id,
      error
    });

    return protectedPreviewPlaceholderResponse(photo, "preview_render_failed");
  }
}
