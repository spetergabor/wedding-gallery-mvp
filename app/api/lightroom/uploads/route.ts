import { NextRequest, NextResponse } from "next/server";
import {
  findLightroomUploadTarget,
  lightroomTargetPayload,
  readLightroomUploadToken
} from "@/lib/lightroom-upload-auth";
import { prisma } from "@/lib/prisma";
import { PHOTO_DELIVERY_STAGE_FINAL } from "@/lib/proofing";
import { consumeRateLimit } from "@/lib/rate-limit";
import {
  createPhotoObjectKey,
  createPhotoVariantObjectKey,
  createPresignedPhotoUploadUrl,
  getPhotoPublicUrl,
  isR2StorageEnabled
} from "@/lib/storage";

export const runtime = "nodejs";

type LightroomUploadFile = {
  clientId?: unknown;
  filename?: unknown;
  contentType?: unknown;
  mediaType?: unknown;
  fileSize?: unknown;
  imageWidth?: unknown;
  imageHeight?: unknown;
  capturedAt?: unknown;
  originalIndex?: unknown;
};

type LightroomUploadsPayload = {
  token?: unknown;
  files?: unknown;
  duplicateMode?: unknown;
};

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

function asString(value: unknown, maxLength = 500) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function asClientId(value: unknown, fallback: string) {
  if (typeof value === "string") {
    return value.trim().slice(0, 120) || fallback;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value).slice(0, 120) || fallback;
  }

  return fallback;
}

function asOptionalNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isFinite(parsed) ? Math.max(0, parsed) : undefined;
}

function asOptionalIsoDate(value: unknown) {
  const raw = asString(value, 80);

  if (!raw) {
    return null;
  }

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeDuplicateMode(value: unknown) {
  return value === "replace" ? "replace" : "skip";
}

function normalizeUploadFile(input: LightroomUploadFile, fallbackIndex: number) {
  const clientId = asClientId(input.clientId, `lightroom-${fallbackIndex + 1}`);
  const filename = asString(input.filename, 260);
  const contentType = asString(input.contentType, 120);
  const mediaType = input.mediaType === "video" || contentType.startsWith("video/") ? "video" : "image";
  const originalIndex = asOptionalNumber(input.originalIndex) ?? fallbackIndex;

  if (!filename) {
    return null;
  }

  return {
    clientId,
    filename,
    contentType,
    mediaType,
    fileSize: asOptionalNumber(input.fileSize) ?? 0,
    imageWidth: asOptionalNumber(input.imageWidth) ?? 0,
    imageHeight: asOptionalNumber(input.imageHeight) ?? 0,
    capturedAt: asOptionalIsoDate(input.capturedAt),
    originalIndex
  };
}

function photoDuplicateKey(input: { filename: string; mediaType?: string | null; fileSize?: number | null }) {
  return [
    input.mediaType === "video" ? "video" : "image",
    input.filename.trim(),
    input.fileSize ?? 0
  ].join("\u001F");
}

async function parsePayload(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return (await request.json().catch(() => null)) as LightroomUploadsPayload | null;
  }

  return null;
}

export async function POST(request: NextRequest) {
  if (!isR2StorageEnabled()) {
    return json(503, {
      ok: false,
      code: "storage_unavailable",
      message: "Lightroom upload is only available with R2 storage."
    });
  }

  const payload = await parsePayload(request);

  if (!payload || typeof payload !== "object") {
    return json(400, {
      ok: false,
      code: "invalid_payload",
      message: "Expected a JSON payload with token and files."
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
    scope: "lightroom-upload-session",
    limit: 120,
    windowSeconds: 60 * 60,
    identifier: token.slice(0, 80)
  });

  if (rateLimit.limited) {
    return json(429, {
      ok: false,
      code: "rate_limited",
      message: "Too many Lightroom upload session requests.",
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

  const rawFiles = Array.isArray(payload.files) ? payload.files : [];
  const files = rawFiles
    .slice(0, 200)
    .map((file, index) => normalizeUploadFile((file ?? {}) as LightroomUploadFile, index))
    .filter((file): file is NonNullable<ReturnType<typeof normalizeUploadFile>> => Boolean(file));

  if (files.length === 0) {
    return json(400, {
      ok: false,
      code: "missing_files",
      message: "No uploadable Lightroom files were provided."
    });
  }

  const duplicateMode = normalizeDuplicateMode(payload.duplicateMode);
  const latestPhoto = await prisma.photo.findFirst({
    where: { galleryId: gallery.id },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true }
  });
  const session = await prisma.galleryUploadSession.create({
    data: {
      galleryId: gallery.id,
      deliveryStage: PHOTO_DELIVERY_STAGE_FINAL,
      totalCount: files.length,
      baseSortOrder: (latestPhoto?.sortOrder ?? 0) + 1,
      status: "pending"
    },
    select: { id: true }
  });
  const existingPhotos = await prisma.photo.findMany({
    where: {
      galleryId: gallery.id,
      deliveryStage: PHOTO_DELIVERY_STAGE_FINAL,
      filename: { in: Array.from(new Set(files.map((file) => file.filename))) }
    },
    orderBy: [{ createdAt: "asc" }, { sortOrder: "asc" }],
    select: {
      id: true,
      filename: true,
      r2Key: true,
      imageUrl: true,
      thumbnailUrl: true,
      previewUrl: true,
      mediaType: true,
      fileSize: true
    }
  });
  const existingPhotoByKey = new Map<string, (typeof existingPhotos)[number]>();

  for (const photo of existingPhotos) {
    const key = photoDuplicateKey(photo);

    if (!existingPhotoByKey.has(key)) {
      existingPhotoByKey.set(key, photo);
    }
  }

  const uploads = await Promise.all(
    files.map(async (file) => {
      const existingPhoto = existingPhotoByKey.get(photoDuplicateKey(file));

      if (existingPhoto && duplicateMode === "skip") {
        const now = new Date();
        const uploadItem = await prisma.galleryUploadItem.create({
          data: {
            sessionId: session.id,
            clientId: file.clientId,
            filename: file.filename,
            deliveryStage: PHOTO_DELIVERY_STAGE_FINAL,
            r2Key: existingPhoto.r2Key,
            imageUrl: existingPhoto.imageUrl,
            thumbnailUrl: existingPhoto.thumbnailUrl,
            previewUrl: existingPhoto.previewUrl,
            mediaType: file.mediaType,
            fileSize: file.fileSize,
            imageWidth: file.imageWidth,
            imageHeight: file.imageHeight,
            capturedAt: file.capturedAt ? new Date(file.capturedAt) : null,
            originalIndex: file.originalIndex,
            status: "completed",
            uploadedAt: now,
            completedAt: now
          },
          select: { id: true }
        });

        return {
          uploadItemId: uploadItem.id,
          clientId: file.clientId,
          filename: file.filename,
          alreadyCompleted: true,
          replacePhotoId: null,
          r2Key: existingPhoto.r2Key,
          imageUrl: existingPhoto.imageUrl,
          thumbnailUrl: existingPhoto.thumbnailUrl || existingPhoto.imageUrl,
          previewUrl: existingPhoto.previewUrl || existingPhoto.imageUrl,
          thumbnailR2Key: null,
          previewR2Key: null,
          uploadUrl: "",
          mediaType: file.mediaType
        };
      }

      const r2Key = createPhotoObjectKey({
        gallerySlug: gallery.slug,
        originalFilename: file.filename
      });
      const imageUrl = getPhotoPublicUrl(r2Key);
      const thumbnailR2Key =
        file.mediaType === "image"
          ? createPhotoVariantObjectKey({
              gallerySlug: gallery.slug,
              originalFilename: file.filename,
              variant: "thumbnail"
            })
          : null;
      const previewR2Key =
        file.mediaType === "image"
          ? createPhotoVariantObjectKey({
              gallerySlug: gallery.slug,
              originalFilename: file.filename,
              variant: "preview"
            })
          : null;
      const uploadItem = await prisma.galleryUploadItem.create({
        data: {
          sessionId: session.id,
          clientId: file.clientId,
          filename: file.filename,
          deliveryStage: PHOTO_DELIVERY_STAGE_FINAL,
          r2Key,
          imageUrl,
          thumbnailUrl: imageUrl,
          previewUrl: imageUrl,
          mediaType: file.mediaType,
          fileSize: file.fileSize,
          imageWidth: file.imageWidth,
          imageHeight: file.imageHeight,
          capturedAt: file.capturedAt ? new Date(file.capturedAt) : null,
          originalIndex: file.originalIndex,
          status: "uploading"
        },
        select: { id: true }
      });

      return {
        uploadItemId: uploadItem.id,
        clientId: file.clientId,
        filename: file.filename,
        alreadyCompleted: false,
        replacePhotoId: existingPhoto && duplicateMode === "replace" ? existingPhoto.id : null,
        r2Key,
        imageUrl,
        thumbnailUrl: imageUrl,
        previewUrl: imageUrl,
        thumbnailR2Key,
        previewR2Key,
        uploadUrl: await createPresignedPhotoUploadUrl({
          r2Key,
          contentType: file.contentType
        }),
        mediaType: file.mediaType
      };
    })
  );

  await prisma.gallery.update({
    where: { id: gallery.id },
    data: { lightroomUploadTokenLastUsedAt: new Date() }
  });

  return json(200, {
    ok: true,
    target: lightroomTargetPayload(gallery),
    sessionId: session.id,
    uploadCount: uploads.length,
    uploads
  });
}
