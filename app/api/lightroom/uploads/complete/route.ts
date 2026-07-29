import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { invalidatePublicGalleryDownloadPackages } from "@/lib/download-packages";
import {
  findLightroomUploadTarget,
  lightroomTargetPayload,
  readLightroomUploadToken
} from "@/lib/lightroom-upload-auth";
import { kickGalleryMediaProcessing } from "@/lib/media-processing";
import { prisma } from "@/lib/prisma";
import { PHOTO_DELIVERY_STAGE_FINAL } from "@/lib/proofing";
import { consumeRateLimit } from "@/lib/rate-limit";
import { deletePhotoObject, getR2KeyFromPublicUrl } from "@/lib/storage";

export const runtime = "nodejs";

type CompletedLightroomUpload = {
  uploadItemId?: unknown;
  replacePhotoId?: unknown;
};

type CompletePayload = {
  token?: unknown;
  sessionId?: unknown;
  uploads?: unknown;
};

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

function asString(value: unknown, maxLength = 500) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function photoDuplicateKey(input: { filename: string; mediaType?: string | null; fileSize?: number | null }) {
  return [
    input.mediaType === "video" ? "video" : "image",
    input.filename.trim(),
    input.fileSize ?? 0
  ].join("\u001F");
}

function photoObjectKeys(photo: {
  r2Key?: string | null;
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
  previewUrl?: string | null;
}) {
  return [
    photo.r2Key,
    getR2KeyFromPublicUrl(photo.imageUrl),
    getR2KeyFromPublicUrl(photo.thumbnailUrl),
    getR2KeyFromPublicUrl(photo.previewUrl)
  ].filter((key): key is string => Boolean(key));
}

async function refreshUploadSessionCounts(sessionId: string) {
  const [uploadedCount, completedCount, failedCount, session] = await Promise.all([
    prisma.galleryUploadItem.count({
      where: {
        sessionId,
        status: { in: ["uploaded", "completed"] }
      }
    }),
    prisma.galleryUploadItem.count({
      where: {
        sessionId,
        status: "completed"
      }
    }),
    prisma.galleryUploadItem.count({
      where: {
        sessionId,
        status: "failed"
      }
    }),
    prisma.galleryUploadSession.findUnique({
      where: { id: sessionId },
      select: { totalCount: true }
    })
  ]);
  const totalCount = session?.totalCount ?? 0;
  const status =
    completedCount >= totalCount && totalCount > 0
      ? "completed"
      : failedCount > 0
        ? "partial"
        : uploadedCount > 0
          ? "uploading"
          : "pending";

  return prisma.galleryUploadSession.update({
    where: { id: sessionId },
    data: {
      uploadedCount,
      completedCount,
      failedCount,
      status
    },
    select: {
      id: true,
      totalCount: true,
      uploadedCount: true,
      completedCount: true,
      failedCount: true,
      status: true
    }
  });
}

async function parsePayload(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return (await request.json().catch(() => null)) as CompletePayload | null;
  }

  return null;
}

export async function POST(request: NextRequest) {
  const payload = await parsePayload(request);

  if (!payload || typeof payload !== "object") {
    return json(400, {
      ok: false,
      code: "invalid_payload",
      message: "Expected a JSON payload with token, sessionId and uploads."
    });
  }

  const token = await readLightroomUploadToken(request, payload);

  if (!token) {
    return json(400, {
      ok: false,
      code: "missing_token",
      message: "Missing Lightroom upload token."
    });
  }

  const rateLimit = await consumeRateLimit({
    scope: "lightroom-upload-complete",
    limit: 240,
    windowSeconds: 60 * 60,
    identifier: token.slice(0, 80)
  });

  if (rateLimit.limited) {
    return json(429, {
      ok: false,
      code: "rate_limited",
      message: "Too many Lightroom completion requests.",
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

  const sessionId = asString(payload.sessionId, 120);
  const requestedUploads = Array.isArray(payload.uploads) ? payload.uploads : [];
  const replacePhotoByUploadItemId = new Map<string, string>();
  const uploadItemIds = requestedUploads
    .map((upload) => {
      const item = (upload ?? {}) as CompletedLightroomUpload;
      const uploadItemId = asString(item.uploadItemId, 120);
      const replacePhotoId = asString(item.replacePhotoId, 120);

      if (uploadItemId && replacePhotoId) {
        replacePhotoByUploadItemId.set(uploadItemId, replacePhotoId);
      }

      return uploadItemId;
    })
    .filter(Boolean);

  if (!sessionId || uploadItemIds.length === 0) {
    return json(400, {
      ok: false,
      code: "missing_uploads",
      message: "No completed Lightroom upload items were provided."
    });
  }

  const session = await prisma.galleryUploadSession.findFirst({
    where: {
      id: sessionId,
      galleryId: gallery.id
    },
    select: {
      id: true,
      baseSortOrder: true,
      sectionId: true,
      deliveryStage: true,
      gallery: {
        select: {
          slug: true
        }
      }
    }
  });

  if (!session) {
    return json(404, {
      ok: false,
      code: "session_not_found",
      message: "Lightroom upload session was not found."
    });
  }

  if (session.deliveryStage !== PHOTO_DELIVERY_STAGE_FINAL) {
    return json(409, {
      ok: false,
      code: "unsupported_delivery_stage",
      message: "Lightroom completion currently supports final gallery uploads only."
    });
  }

  const uploadItems = await prisma.galleryUploadItem.findMany({
    where: {
      id: { in: Array.from(new Set(uploadItemIds)) },
      sessionId: session.id
    },
    orderBy: [{ originalIndex: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      filename: true,
      r2Key: true,
      imageUrl: true,
      thumbnailUrl: true,
      previewUrl: true,
      mediaType: true,
      fileSize: true,
      imageWidth: true,
      imageHeight: true,
      capturedAt: true,
      originalIndex: true,
      status: true
    }
  });
  const completableItems = uploadItems.filter((item) => item.status !== "completed" && item.r2Key && item.imageUrl);

  if (completableItems.length === 0) {
    const refreshedSession = await refreshUploadSessionCounts(session.id);

    return json(200, {
      ok: true,
      target: lightroomTargetPayload(gallery),
      completedItemIds: [],
      session: refreshedSession
    });
  }

  const now = new Date();
  const replacementPhotoIds = Array.from(new Set(completableItems.map((item) => replacePhotoByUploadItemId.get(item.id)).filter((id): id is string => Boolean(id))));
  const replacementPhotos = replacementPhotoIds.length
    ? await prisma.photo.findMany({
        where: {
          id: { in: replacementPhotoIds },
          galleryId: gallery.id,
          deliveryStage: PHOTO_DELIVERY_STAGE_FINAL
        },
        select: {
          id: true,
          r2Key: true,
          imageUrl: true,
          thumbnailUrl: true,
          previewUrl: true,
          sortOrder: true
        }
      })
    : [];
  const replacementPhotoById = new Map(replacementPhotos.map((photo) => [photo.id, photo]));
  const usedReplacementPhotoIds = new Set<string>();
  const itemsToReplace = completableItems.filter((item) => {
    const replacePhotoId = replacePhotoByUploadItemId.get(item.id);

    if (!replacePhotoId || !replacementPhotoById.has(replacePhotoId) || usedReplacementPhotoIds.has(replacePhotoId)) {
      return false;
    }

    usedReplacementPhotoIds.add(replacePhotoId);
    return true;
  });
  const replacementUploadItemIds = new Set(itemsToReplace.map((item) => item.id));
  const creationCandidates = completableItems.filter((item) => !replacementUploadItemIds.has(item.id));
  const existingPhotos = creationCandidates.length
    ? await prisma.photo.findMany({
        where: {
          galleryId: gallery.id,
          deliveryStage: PHOTO_DELIVERY_STAGE_FINAL,
          filename: { in: Array.from(new Set(creationCandidates.map((item) => item.filename))) }
        },
        select: {
          filename: true,
          mediaType: true,
          fileSize: true
        }
      })
    : [];
  const existingPhotoKeys = new Set(existingPhotos.map((photo) => photoDuplicateKey(photo)));
  const batchPhotoKeys = new Set<string>();
  const itemsToCreate = creationCandidates.filter((item) => {
    const key = photoDuplicateKey(item);

    if (existingPhotoKeys.has(key) || batchPhotoKeys.has(key)) {
      return false;
    }

    batchPhotoKeys.add(key);
    return true;
  });
  const createdPhotos = itemsToCreate.map((item) => {
    const id = randomUUID();
    const mediaType = item.mediaType === "video" ? "video" : "image";
    const thumbnailUrl = item.thumbnailUrl || item.imageUrl!;
    const previewUrl = item.previewUrl || item.imageUrl!;

    return {
      id,
      galleryId: gallery.id,
      sectionId: session.sectionId,
      filename: item.filename,
      r2Key: item.r2Key!,
      imageUrl: item.imageUrl!,
      thumbnailUrl,
      previewUrl,
      deliveryStage: PHOTO_DELIVERY_STAGE_FINAL,
      mediaType,
      processingStatus: "pending",
      processingRequestedAt: now,
      fileSize: item.fileSize,
      imageWidth: item.imageWidth,
      imageHeight: item.imageHeight,
      capturedAt: item.capturedAt,
      sortOrder: session.baseSortOrder + item.originalIndex
    };
  });
  const replacedPhotos = itemsToReplace.map((item) => {
    const replacePhotoId = replacePhotoByUploadItemId.get(item.id)!;
    const existingPhoto = replacementPhotoById.get(replacePhotoId)!;
    const mediaType = item.mediaType === "video" ? "video" : "image";
    const thumbnailUrl = item.thumbnailUrl || item.imageUrl!;
    const previewUrl = item.previewUrl || item.imageUrl!;

    return {
      id: replacePhotoId,
      galleryId: gallery.id,
      sectionId: session.sectionId,
      filename: item.filename,
      r2Key: item.r2Key!,
      imageUrl: item.imageUrl!,
      thumbnailUrl,
      previewUrl,
      mediaType,
      processingStatus: "pending",
      processingRequestedAt: now,
      fileSize: item.fileSize,
      imageWidth: item.imageWidth,
      imageHeight: item.imageHeight,
      capturedAt: item.capturedAt,
      sortOrder: existingPhoto.sortOrder,
      previousObjectKeys: photoObjectKeys(existingPhoto)
    };
  });
  const photosForProcessing = [...createdPhotos, ...replacedPhotos];

  await prisma.$transaction(async (tx) => {
    if (createdPhotos.length > 0) {
      await tx.photo.createMany({
        data: createdPhotos.map((photo) => ({
          id: photo.id,
          galleryId: photo.galleryId,
          sectionId: photo.sectionId,
          filename: photo.filename,
          r2Key: photo.r2Key,
          imageUrl: photo.imageUrl,
          thumbnailUrl: photo.thumbnailUrl,
          previewUrl: photo.previewUrl,
          deliveryStage: photo.deliveryStage,
          mediaType: photo.mediaType,
          processingStatus: photo.processingStatus,
          processingRequestedAt: photo.processingRequestedAt,
          fileSize: photo.fileSize,
          imageWidth: photo.imageWidth,
          imageHeight: photo.imageHeight,
          capturedAt: photo.capturedAt,
          sortOrder: photo.sortOrder
        }))
      });
    }

    for (const photo of replacedPhotos) {
      await tx.photo.update({
        where: { id: photo.id },
        data: {
          filename: photo.filename,
          sectionId: photo.sectionId,
          r2Key: photo.r2Key,
          imageUrl: photo.imageUrl,
          thumbnailUrl: photo.thumbnailUrl,
          previewUrl: photo.previewUrl,
          mediaType: photo.mediaType,
          processingStatus: photo.processingStatus,
          processingError: null,
          processingRequestedAt: photo.processingRequestedAt,
          processingCompletedAt: null,
          fileSize: photo.fileSize,
          imageWidth: photo.imageWidth,
          imageHeight: photo.imageHeight,
          capturedAt: photo.capturedAt
        }
      });
    }

    await tx.galleryUploadItem.updateMany({
      where: {
        id: { in: completableItems.map((item) => item.id) },
        sessionId: session.id
      },
      data: {
        status: "completed",
        errorMessage: null,
        uploadedAt: now,
        completedAt: now
      }
    });

    if (replacedPhotos.length > 0) {
      await tx.mediaProcessingJob.deleteMany({
        where: { photoId: { in: replacedPhotos.map((photo) => photo.id) } }
      });
    }

    if (photosForProcessing.length > 0) {
      await tx.mediaProcessingJob.createMany({
        data: photosForProcessing.map((photo) => ({
          galleryId: photo.galleryId,
          photoId: photo.id,
          mediaType: photo.mediaType,
          sourceR2Key: photo.r2Key,
          thumbnailR2Key: null,
          previewR2Key: null,
          posterR2Key: photo.mediaType === "video" ? `galleries/${session.gallery.slug}/video-posters/${photo.id}.jpg` : null,
          status: "pending"
        }))
      });
    }
  }, { timeout: 15000 });

  const currentObjectKeys = new Set(photosForProcessing.flatMap(photoObjectKeys));
  const previousReplacementObjectKeys = Array.from(
    new Set(replacedPhotos.flatMap((photo) => photo.previousObjectKeys).filter((key) => !currentObjectKeys.has(key)))
  );
  await Promise.all(previousReplacementObjectKeys.map((key) => deletePhotoObject(key)));

  if (photosForProcessing.length > 0) {
    await kickGalleryMediaProcessing({ galleryId: gallery.id });
  }

  const refreshedSession = await refreshUploadSessionCounts(session.id);

  if (refreshedSession.status === "completed") {
    await invalidatePublicGalleryDownloadPackages(gallery.id);
  }

  await prisma.gallery.update({
    where: { id: gallery.id },
    data: { lightroomUploadTokenLastUsedAt: new Date() }
  });

  revalidatePath(`/admin/galleries/${gallery.id}`);
  revalidatePath(`/g/${gallery.slug}`);

  return json(200, {
    ok: true,
    target: lightroomTargetPayload(gallery),
    completedItemIds: completableItems.map((item) => item.id),
    createdCount: createdPhotos.length,
    replacedCount: replacedPhotos.length,
    session: refreshedSession
  });
}
