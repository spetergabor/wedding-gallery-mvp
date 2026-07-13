import { revalidatePath } from "next/cache";
import { PassThrough, Readable } from "node:stream";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { ZipArchive } from "archiver";
import { Readable as LazyReadable } from "lazystream";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { ensureDownloadPackageAccessToken, publicDownloadQualityFromScope, publicDownloadScopeForQuality } from "@/lib/download-packages";
import {
  adminGalleryUrl,
  galleryDownloadUrl,
  publicGalleryUrl,
  sendAdminGalleryZipReadyEmail,
  sendGuestGalleryDownloadReadyEmail
} from "@/lib/email";
import { DEFAULT_GALLERY_DOWNLOAD_QUALITY, galleryDownloadQualityLabel, normalizeGalleryDownloadQuality, type GalleryDownloadQuality } from "@/lib/download-quality";
import { galleryDeliveryAllowsDownloads } from "@/lib/gallery-delivery";
import { isPaidPurchaseScope, paidPurchaseIdFromScope } from "@/lib/gallery-sales-shared";
import {
  createGalleryZipObjectKey,
  createPhotoReadStream,
  deletePhotoObject,
  getPhotoPublicUrl,
  getR2KeyFromPublicUrl,
  savePhotoStream
} from "@/lib/storage";
import { PHOTO_DELIVERY_STAGE_FINAL, PROOFING_STATUS_DELIVERED, isProofingGallery } from "@/lib/proofing";
import { normalizeCustomerLanguage } from "@/lib/customer-language";

export const ZIP_GENERATION_JOB = "zip_generation";
const STALE_ZIP_PROCESSING_MS = 15 * 60 * 1000;
const REMOTE_FILE_FETCH_TIMEOUT_MS = 10 * 60 * 1000;
const WEB_DOWNLOAD_ESTIMATED_IMAGE_BYTES = 1024 * 1024;
const WEB_DOWNLOAD_MAX_SIZE = 2400;
const WEB_DOWNLOAD_JPEG_QUALITY = 76;
const ZIP_TRIGGER_DISPATCH_CONCURRENCY = readPositiveInteger(process.env.ZIP_TRIGGER_DISPATCH_CONCURRENCY, 8, 1);
const ZIP_STUCK_PROCESSING_HOURS = readPositiveInteger(process.env.ZIP_STUCK_PROCESSING_HOURS, 3, 1);
const HOUR_MS = 60 * 60 * 1000;

type ZipGenerationPayload = {
  galleryId: string;
  packageId: string;
  jobId?: string;
};

type CompletedDownloadPackage = {
  id: string;
  partIndex: number;
  partCount: number;
  scope: string;
  photoCount: number;
  fileSize: bigint;
  gallery: {
    title: string;
    customer: {
      preferredLanguage: string | null;
    } | null;
  };
  downloads: Array<{
    id: string;
    email: string;
  }>;
};

type GalleryZipJobPayload = {
  galleryId: string;
  packageId: string;
  jobId: string;
};

type PublicGalleryZipPackage = {
  id: string;
  status: string;
  downloadUrl: string | null;
  scope: string;
  groupId: string | null;
  partIndex: number;
  partCount: number;
};

type PreparePublicGalleryZipPackagesResult =
  | {
      ok: true;
      status: "completed" | "processing" | "pending";
      cached: boolean;
      packages: PublicGalleryZipPackage[];
      payloads: GalleryZipJobPayload[];
    }
  | {
      ok: false;
      reason: "not-active" | "downloads-disabled" | "proofing-pending" | "no-photos";
      packages: [];
      payloads: [];
    };

export function galleryZipFileName(title: string, partIndex?: number, partCount?: number, quality: GalleryDownloadQuality = "original") {
  const baseName = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "") || "gallery";
  const qualitySuffix = quality === "web" ? "-web" : "";

  if (partCount && partCount > 1 && partIndex !== undefined) {
    return `${baseName}${qualitySuffix}-teil-${String(partIndex + 1).padStart(2, "0")}-von-${String(partCount).padStart(2, "0")}.zip`;
  }

  return `${baseName}${qualitySuffix}.zip`;
}

function photoZipFileName(filename: string, index: number, quality: GalleryDownloadQuality = "original", mediaType = "image") {
  const fallback = `photo-${String(index + 1).padStart(3, "0")}.jpg`;
  const nextFilename =
    quality === "web" && mediaType !== "video" && filename
      ? filename.replace(/\.[^.]+$/, "") + ".jpg"
      : filename || fallback;

  return nextFilename.replace(/[\\/:*?"<>|]/g, "-");
}

function readPositiveMegabytes(value: string | undefined, fallback: number, minimum: number) {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(parsed) || parsed < minimum) {
    return fallback * 1024 * 1024;
  }

  return parsed * 1024 * 1024;
}

function readPositiveInteger(value: string | undefined, fallback: number, minimum: number) {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(parsed) || parsed < minimum) {
    return fallback;
  }

  return parsed;
}

const ZIP_PART_TARGET_BYTES = readPositiveMegabytes(process.env.GALLERY_ZIP_PART_TARGET_MB, 2048, 256);
const ZIP_UPLOAD_PART_SIZE_BYTES = readPositiveMegabytes(process.env.GALLERY_ZIP_UPLOAD_PART_SIZE_MB, 16, 5);

export function createZipPartRanges(photos: Array<{ fileSize: number | null; mediaType?: string | null }>, quality: GalleryDownloadQuality) {
  const ranges: Array<{ offset: number; limit: number }> = [];
  let offset = 0;
  let currentBytes = 0;
  let currentCount = 0;

  for (const photo of photos) {
    const size =
      quality === "web" && photo.mediaType !== "video"
        ? WEB_DOWNLOAD_ESTIMATED_IMAGE_BYTES
        : photo.fileSize && photo.fileSize > 0
          ? photo.fileSize
          : 25 * 1024 * 1024;

    if (currentCount > 0 && currentBytes + size > ZIP_PART_TARGET_BYTES) {
      ranges.push({ offset, limit: currentCount });
      offset += currentCount;
      currentBytes = 0;
      currentCount = 0;
    }

    currentBytes += size;
    currentCount += 1;
  }

  if (currentCount > 0) {
    ranges.push({ offset, limit: currentCount });
  }

  return ranges.length > 0 ? ranges : [{ offset: 0, limit: photos.length }];
}

function isCompletePackageSet(packages: Array<{ status: string; downloadUrl: string | null; partIndex: number; partCount: number }>) {
  if (packages.length === 0) {
    return false;
  }

  const expectedPartCount = Math.max(...packages.map((downloadPackage) => downloadPackage.partCount), packages.length, 1);
  const partIndexes = new Set(
    packages
      .filter((downloadPackage) => downloadPackage.status === "completed" && downloadPackage.downloadUrl)
      .map((downloadPackage) => downloadPackage.partIndex)
  );

  return packages.length === expectedPartCount && Array.from({ length: expectedPartCount }, (_, index) => partIndexes.has(index)).every(Boolean);
}

function safeRevalidatePath(path: string) {
  try {
    revalidatePath(path);
  } catch (error) {
    console.warn("Skipped path revalidation outside Next.js request context", {
      path,
      message: error instanceof Error ? error.message : "Unknown revalidation error"
    });
  }
}

function createRemoteFileStream(photo: { filename: string; imageUrl: string }) {
  return Readable.from(
    (async function* () {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REMOTE_FILE_FETCH_TIMEOUT_MS);

      try {
        const response = await fetch(photo.imageUrl, { cache: "no-store", signal: controller.signal });

        if (!response.ok || !response.body) {
          throw new Error(`${photo.filename} konnte nicht geladen werden.`);
        }

        const reader = response.body.getReader();

        try {
          while (true) {
            const result = await reader.read();

            if (result.done) {
              break;
            }

            yield Buffer.from(result.value);
          }
        } finally {
          reader.releaseLock();
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          throw new Error(`${photo.filename} letöltése túl sokáig tartott.`);
        }

        throw error;
      } finally {
        clearTimeout(timeout);
      }
    })()
  );
}

function createWebImageStream(photo: {
  filename: string;
  imageUrl: string;
  previewUrl: string;
  r2Key: string;
  fileSize: number;
}) {
  const previewR2Key = photo.previewUrl && photo.previewUrl !== photo.imageUrl ? getR2KeyFromPublicUrl(photo.previewUrl) : null;

  if (previewR2Key) {
    return createPhotoReadStream({
      r2Key: previewR2Key,
      publicUrl: photo.previewUrl
    });
  }

  const sourceStream = photo.r2Key
    ? createPhotoReadStream({
        r2Key: photo.r2Key,
        publicUrl: photo.imageUrl,
        byteLength: photo.fileSize
      })
    : createRemoteFileStream({ filename: photo.filename, imageUrl: photo.previewUrl || photo.imageUrl });

  return sourceStream.pipe(
    sharp({ failOn: "none" })
      .rotate()
      .resize({
        width: WEB_DOWNLOAD_MAX_SIZE,
        height: WEB_DOWNLOAD_MAX_SIZE,
        fit: "inside",
        withoutEnlargement: true
      })
      .jpeg({ quality: WEB_DOWNLOAD_JPEG_QUALITY, mozjpeg: true })
  );
}

function mediaStreamError(filename: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return new Error(`${filename}: ${message}`);
}

function createLazyZipMediaStream(filename: string, createStream: () => NodeJS.ReadableStream) {
  return new LazyReadable(() => {
    const stream = new PassThrough();

    try {
      const source = createStream();

      source.on("error", (error) => {
        stream.destroy(mediaStreamError(filename, error));
      });
      source.pipe(stream);
    } catch (error) {
      queueMicrotask(() => {
        stream.destroy(mediaStreamError(filename, error));
      });
    }

    return stream;
  });
}

function parseZipGenerationPayload(payload: Prisma.JsonValue): ZipGenerationPayload {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Invalid ZIP generation payload.");
  }

  const value = payload as Record<string, unknown>;

  if (typeof value.galleryId !== "string" || typeof value.packageId !== "string") {
    throw new Error("Invalid ZIP generation payload.");
  }

  return {
    galleryId: value.galleryId,
    packageId: value.packageId
  };
}

export async function enqueueGalleryZipJob({
  galleryId,
  packageId
}: ZipGenerationPayload) {
  return prisma.backgroundJob.create({
    data: {
      type: ZIP_GENERATION_JOB,
      status: "pending",
      payload: {
        galleryId,
        packageId
      }
    },
    select: { id: true }
  });
}

async function findQueuedZipJobId(packageId: string) {
  const job = await prisma.backgroundJob.findFirst({
    where: {
      type: ZIP_GENERATION_JOB,
      status: { in: ["pending", "processing"] },
      payload: {
        path: ["packageId"],
        equals: packageId
      }
    },
    orderBy: { createdAt: "desc" },
    select: { id: true }
  });

  return job?.id;
}

function isTriggerZipWorkerEnabled() {
  return process.env.ZIP_WORKER_DRIVER === "trigger" && Boolean(process.env.TRIGGER_SECRET_KEY);
}

export function isExternalZipWorkerMode() {
  return process.env.ZIP_WORKER_DRIVER === "external" || process.env.ZIP_WORKER_DRIVER === "hetzner";
}

async function triggerExternalZipWorker(payload: ZipGenerationPayload) {
  if (!isTriggerZipWorkerEnabled()) {
    return false;
  }

  try {
    const { tasks } = await import("@trigger.dev/sdk/v3");

    await tasks.trigger("gallery-zip", payload, {
      idempotencyKey: payload.jobId ?? payload.packageId,
      queue: "gallery-zip",
      tags: [`gallery:${payload.galleryId}`, `package:${payload.packageId}`]
    });

    return true;
  } catch (error) {
    console.error("Trigger.dev ZIP dispatch failed", {
      galleryId: payload.galleryId,
      packageId: payload.packageId,
      error
    });

    return false;
  }
}

export async function kickGalleryZipJob(payload: ZipGenerationPayload) {
  const payloadWithJob = {
    ...payload,
    jobId: payload.jobId ?? (await findQueuedZipJobId(payload.packageId))
  };
  const dispatched = await triggerExternalZipWorker(payloadWithJob);

  if (dispatched || process.env.ZIP_WORKER_DRIVER === "trigger") {
    return {
      driver: dispatched ? "trigger" : "trigger_unavailable",
      processed: 0,
      failed: 0
    };
  }

  if (isExternalZipWorkerMode()) {
    return {
      driver: "external",
      processed: 0,
      failed: 0
    };
  }

  return {
    driver: "vercel",
    ...(await processPendingJobs({ limit: 1 }))
  };
}

type KickGalleryZipJobResult = Awaited<ReturnType<typeof kickGalleryZipJob>>;

export async function kickGalleryZipJobs(payloads: ZipGenerationPayload[]) {
  if (payloads.length === 0) {
    return [];
  }

  if (process.env.ZIP_WORKER_DRIVER === "trigger") {
    const results: KickGalleryZipJobResult[] = [];
    const concurrency = Math.min(ZIP_TRIGGER_DISPATCH_CONCURRENCY, payloads.length);
    let nextIndex = 0;

    async function worker() {
      while (nextIndex < payloads.length) {
        const payload = payloads[nextIndex];
        nextIndex += 1;
        results.push(await kickGalleryZipJob(payload));
      }
    }

    await Promise.all(Array.from({ length: concurrency }, () => worker()));

    return results;
  }

  if (isExternalZipWorkerMode()) {
    return payloads.map(() => ({
      driver: "external",
      processed: 0,
      failed: 0
    }));
  }

  const results = [];
  for (const payload of payloads) {
    results.push(await kickGalleryZipJob(payload));
  }

  return results;
}

export async function preparePublicGalleryZipPackages(
  galleryId: string,
  requestedQuality: GalleryDownloadQuality = DEFAULT_GALLERY_DOWNLOAD_QUALITY
): Promise<PreparePublicGalleryZipPackagesResult> {
  const quality = normalizeGalleryDownloadQuality(requestedQuality);
  const downloadScope = publicDownloadScopeForQuality(quality);
  const gallery = await prisma.gallery.findUnique({
    where: { id: galleryId },
    select: {
      id: true,
      isActive: true,
      downloadsEnabled: true,
      deliveryMode: true,
      galleryMode: true,
      proofingStatus: true,
      photos: {
        where: { isClientHidden: false, deliveryStage: PHOTO_DELIVERY_STAGE_FINAL },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          createdAt: true,
          fileSize: true,
          mediaType: true
        }
      }
    }
  });

  if (!gallery?.isActive) {
    return { ok: false, reason: "not-active", packages: [], payloads: [] };
  }

  if (!gallery.downloadsEnabled || !galleryDeliveryAllowsDownloads(gallery.deliveryMode)) {
    return { ok: false, reason: "downloads-disabled", packages: [], payloads: [] };
  }

  if (isProofingGallery(gallery.galleryMode) && gallery.proofingStatus !== PROOFING_STATUS_DELIVERED) {
    return { ok: false, reason: "proofing-pending", packages: [], payloads: [] };
  }

  if (gallery.photos.length === 0) {
    return { ok: false, reason: "no-photos", packages: [], payloads: [] };
  }

  const latestPhotoCreatedAt = gallery.photos.reduce<Date | null>((latest, photo) => {
    if (!latest || photo.createdAt > latest) {
      return photo.createdAt;
    }

    return latest;
  }, null);

  const completedPackages = await prisma.galleryDownloadPackage.findMany({
    where: {
      galleryId,
      scope: downloadScope,
      status: "completed",
      photoCount: gallery.photos.length,
      downloadUrl: { not: null },
      r2Key: { not: null },
      generatedAt: latestPhotoCreatedAt ? { gte: latestPhotoCreatedAt } : undefined
    },
    orderBy: [{ groupId: "desc" }, { partIndex: "asc" }, { generatedAt: "desc" }],
    select: {
      id: true,
      status: true,
      downloadUrl: true,
      scope: true,
      groupId: true,
      partIndex: true,
      partCount: true
    }
  });
  const completedGroups = new Map<string, typeof completedPackages>();

  for (const downloadPackage of completedPackages) {
    const key = downloadPackage.groupId ?? downloadPackage.id;
    completedGroups.set(key, [...(completedGroups.get(key) ?? []), downloadPackage]);
  }

  const completePackages = Array.from(completedGroups.values()).find(isCompletePackageSet);

  if (completePackages) {
    return {
      ok: true,
      status: "completed",
      cached: true,
      packages: completePackages,
      payloads: []
    };
  }

  const activePackages = await prisma.galleryDownloadPackage.findMany({
    where: {
      galleryId,
      scope: downloadScope,
      status: { in: ["pending", "processing"] },
      photoCount: gallery.photos.length
    },
    orderBy: [{ groupId: "desc" }, { partIndex: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      status: true,
      downloadUrl: true,
      scope: true,
      groupId: true,
      partIndex: true,
      partCount: true,
      updatedAt: true
    }
  });

  if (activePackages.length > 0) {
    const latestGroupKey = activePackages[0].groupId ?? activePackages[0].id;
    const latestGroupPackages = activePackages.filter((downloadPackage) => (downloadPackage.groupId ?? downloadPackage.id) === latestGroupKey);
    const now = Date.now();
    const packagesToKick = latestGroupPackages.filter(
      (downloadPackage) =>
        downloadPackage.status === "pending" ||
        (downloadPackage.status === "processing" && now - downloadPackage.updatedAt.getTime() > STALE_ZIP_PROCESSING_MS)
    );
    const payloads = await Promise.all(
      packagesToKick.map(async (downloadPackage) => ({
        galleryId,
        packageId: downloadPackage.id,
        jobId: (await enqueueGalleryZipJob({ galleryId, packageId: downloadPackage.id })).id
      }))
    );

    return {
      ok: true,
      status: latestGroupPackages.some((downloadPackage) => downloadPackage.status === "processing") ? "processing" : "pending",
      cached: false,
      packages: latestGroupPackages,
      payloads
    };
  }

  const ranges = createZipPartRanges(gallery.photos, quality);
  const partCount = ranges.length;
  const groupId = partCount > 1 ? randomUUID() : null;
  const createdPackages = await prisma.$transaction(
    ranges.map((range, partIndex) =>
      prisma.galleryDownloadPackage.create({
        data: {
          galleryId,
          scope: downloadScope,
          status: "pending",
          photoCount: gallery.photos.length,
          partIndex,
          partCount,
          photoOffset: range.offset,
          photoLimit: range.limit,
          groupId
        },
        select: {
          id: true,
          status: true,
          downloadUrl: true,
          scope: true,
          groupId: true,
          partIndex: true,
          partCount: true
        }
      })
    )
  );
  const payloads = await Promise.all(
    createdPackages.map(async (downloadPackage) => ({
      galleryId,
      packageId: downloadPackage.id,
      jobId: (await enqueueGalleryZipJob({ galleryId, packageId: downloadPackage.id })).id
    }))
  );

  return {
    ok: true,
    status: "pending",
    cached: false,
    packages: createdPackages,
    payloads
  };
}

async function markBackgroundJobProcessing(payload: ZipGenerationPayload) {
  if (!payload.jobId) {
    return null;
  }

  const job = await prisma.backgroundJob.findUnique({
    where: { id: payload.jobId },
    select: {
      id: true,
      status: true,
      attempts: true,
      maxAttempts: true
    }
  });

  if (!job || job.status === "completed") {
    return job;
  }

  await prisma.backgroundJob.update({
    where: { id: job.id },
    data: {
      status: "processing",
      attempts: { increment: 1 },
      lockedAt: new Date(),
      startedAt: new Date(),
      errorMessage: null
    }
  });

  return job;
}

async function markBackgroundJobCompleted(jobId?: string) {
  if (!jobId) {
    return;
  }

  await prisma.backgroundJob
    .update({
      where: { id: jobId },
      data: {
        status: "completed",
        completedAt: new Date(),
        lockedAt: null,
        errorMessage: null
      }
    })
    .catch(() => undefined);
}

async function completeGroupIfReady(packageId: string) {
  const currentPackage = await prisma.galleryDownloadPackage.findUnique({
    where: { id: packageId },
    select: {
      groupId: true
    }
  });

  if (!currentPackage?.groupId) {
    await sendGalleryDownloadLinksForPackage(packageId);
    return true;
  }

  const packages = await prisma.galleryDownloadPackage.findMany({
    where: { groupId: currentPackage.groupId },
    orderBy: { partIndex: "asc" },
    select: {
      id: true,
      status: true,
      downloadUrl: true,
      partCount: true
    }
  });
  const expectedPartCount = Math.max(...packages.map((downloadPackage) => downloadPackage.partCount), packages.length, 1);
  const isComplete =
    packages.length === expectedPartCount &&
    packages.every((downloadPackage) => downloadPackage.status === "completed" && downloadPackage.downloadUrl);

  if (isComplete) {
    await sendGalleryDownloadLinksForPackages(packages.map((downloadPackage) => downloadPackage.id));
    return true;
  }

  return false;
}

async function markOlderCompletedZipPackagesStale({
  galleryId,
  scope,
  keepPackageId,
  keepGroupId
}: {
  galleryId: string;
  scope: string;
  keepPackageId: string;
  keepGroupId: string | null;
}) {
  const keepPackages = await prisma.galleryDownloadPackage.findMany({
    where: keepGroupId ? { groupId: keepGroupId } : { id: keepPackageId },
    select: { id: true }
  });
  const keepIds = keepPackages.length > 0 ? keepPackages.map((downloadPackage) => downloadPackage.id) : [keepPackageId];

  await prisma.galleryDownloadPackage.updateMany({
    where: {
      galleryId,
      scope,
      status: "completed",
      id: { notIn: keepIds },
      r2Key: { not: null }
    },
    data: {
      status: "stale",
      errorMessage: "Újabb letöltési ZIP készült, ezért ez a régi csomag takarításra vár."
    }
  });
}

async function markBackgroundJobFailed(payload: ZipGenerationPayload, error: unknown, maxAttempts = 3, attempts = 0) {
  if (!payload.jobId) {
    return;
  }

  const message = error instanceof Error ? error.message : "Background job failed.";
  const shouldRetry = attempts < maxAttempts;

  await prisma.backgroundJob
    .update({
      where: { id: payload.jobId },
      data: {
        status: shouldRetry ? "pending" : "failed",
        lockedAt: null,
        errorMessage: message.slice(0, 500)
      }
    })
    .catch(() => undefined);
}

export async function processExternalZipJob(payload: ZipGenerationPayload) {
  const job = await markBackgroundJobProcessing(payload);

  if (job?.status === "completed") {
    return;
  }

  try {
    await generateGalleryZip(payload);
    await markBackgroundJobCompleted(payload.jobId);
  } catch (error) {
    await markBackgroundJobFailed(payload, error, job?.maxAttempts, (job?.attempts ?? 0) + 1);
    throw error;
  }
}

export async function generateGalleryZip(payload: ZipGenerationPayload) {
  const downloadPackage = await prisma.galleryDownloadPackage.findUnique({
    where: { id: payload.packageId },
    select: {
      id: true,
      status: true,
      galleryId: true,
      photoCount: true,
      scope: true,
      partIndex: true,
      partCount: true,
      photoOffset: true,
      photoLimit: true,
      groupId: true
    }
  });

  if (!downloadPackage) {
    throw new Error("Download package was not found.");
  }

  if (downloadPackage.status === "completed") {
    return;
  }

  if (!["pending", "processing"].includes(downloadPackage.status)) {
    return;
  }

  const downloadPackageId = downloadPackage.id;
  const quality = publicDownloadQualityFromScope(downloadPackage.scope);

  const gallery = await prisma.gallery.findUnique({
    where: { id: payload.galleryId },
    select: {
      id: true,
      title: true,
      slug: true,
      adminId: true,
      downloadsEnabled: true,
      deliveryMode: true,
      galleryMode: true,
      proofingStatus: true,
      admin: {
        select: {
          email: true,
          siteSettings: {
            select: {
              contactEmail: true,
              publicSubdomain: true
            }
          }
        }
      },
      photos: {
        where: { isClientHidden: false, deliveryStage: PHOTO_DELIVERY_STAGE_FINAL },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        skip: downloadPackage.photoOffset,
        take: downloadPackage.photoLimit ?? undefined,
        select: {
          id: true,
          filename: true,
          imageUrl: true,
          previewUrl: true,
          r2Key: true,
          fileSize: true,
          mediaType: true
        }
      }
    }
  });

  if (!gallery) {
    throw new Error("Diese Galerie wurde nicht gefunden.");
  }

  if (!isPaidPurchaseScope(downloadPackage.scope) && (!gallery.downloadsEnabled || !galleryDeliveryAllowsDownloads(gallery.deliveryMode))) {
    throw new Error("Downloads sind für diese Galerie derzeit deaktiviert.");
  }

  if (isProofingGallery(gallery.galleryMode) && gallery.proofingStatus !== PROOFING_STATUS_DELIVERED) {
    throw new Error("Die finalen Fotos sind noch nicht freigegeben.");
  }

  if (gallery.photos.length === 0) {
    throw new Error("Diese Galerie enthält noch keine Fotos.");
  }

  const totalPhotoCount = downloadPackage.photoCount || gallery.photos.length;

  await prisma.galleryDownloadPackage.update({
    where: { id: downloadPackage.id },
    data: {
      status: "processing",
      photoCount: totalPhotoCount,
      processedCount: 0,
      processedBytes: BigInt(0),
      errorMessage: null
    }
  });

  try {
    const r2Key = createGalleryZipObjectKey({ gallerySlug: gallery.slug });
    const downloadUrl = getPhotoPublicUrl(r2Key);
    let lastProgressUpdateAt = 0;
    let progressUpdatePromise = Promise.resolve();

    function queueProgressUpdate(
      progress: {
        processedCount?: number;
        processedBytes?: bigint;
      },
      force = false
    ) {
      const now = Date.now();

      if (!force && now - lastProgressUpdateAt < 5000) {
        return;
      }

      lastProgressUpdateAt = now;
      progressUpdatePromise = progressUpdatePromise
        .then(() =>
          prisma.galleryDownloadPackage.update({
            where: { id: downloadPackageId },
            data: {
              ...(progress.processedCount === undefined ? {} : { processedCount: progress.processedCount }),
              ...(progress.processedBytes === undefined ? {} : { processedBytes: progress.processedBytes })
            }
          })
        )
        .then(() => undefined)
        .catch(() => undefined);
    }

    const zip = new ZipArchive({
      forceZip64: true,
      store: true
    });
    const zipStream = new PassThrough();
    const uploadPromise = savePhotoStream({
      r2Key,
      stream: zipStream,
      contentType: "application/zip",
      partSizeBytes: ZIP_UPLOAD_PART_SIZE_BYTES,
      onProgress: (processedBytes) => {
        queueProgressUpdate({ processedBytes });
      }
    });

    zip.on("error", (error) => {
      zipStream.destroy(error);
    });
    zip.on("progress", (progress) => {
      queueProgressUpdate({ processedCount: progress.entries.processed });
    });

    zip.pipe(zipStream);

    for (const [index, photo] of gallery.photos.entries()) {
      const mediaStream = createLazyZipMediaStream(photo.filename, () =>
        quality === "web" && photo.mediaType !== "video"
          ? createWebImageStream(photo)
          : photo.r2Key
            ? createPhotoReadStream({
                r2Key: photo.r2Key,
                publicUrl: photo.imageUrl,
                byteLength: photo.fileSize
              })
            : createRemoteFileStream({ filename: photo.filename, imageUrl: photo.imageUrl })
      );

      zip.append(mediaStream, {
        name: photoZipFileName(photo.filename, downloadPackage.photoOffset + index, quality, photo.mediaType)
      });
    }

    await zip.finalize();
    const { bytesWritten } = await uploadPromise;
    queueProgressUpdate(
      {
        processedCount: gallery.photos.length,
        processedBytes: bytesWritten
      },
      true
    );
    await progressUpdatePromise;

    const generatedAt = new Date();
    const zippedPhotoIds = gallery.photos.map((photo) => photo.id);
    const currentVisiblePhotoIds = await prisma.photo.findMany({
      where: { galleryId: gallery.id, isClientHidden: false, deliveryStage: PHOTO_DELIVERY_STAGE_FINAL },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      skip: downloadPackage.photoOffset,
      take: downloadPackage.photoLimit ?? undefined,
      select: { id: true }
    });
    const publicPhotoListChanged =
      zippedPhotoIds.length !== currentVisiblePhotoIds.length ||
      zippedPhotoIds.some((photoId, index) => photoId !== currentVisiblePhotoIds[index]?.id);

    if (publicPhotoListChanged) {
      await deletePhotoObject(r2Key);
      await prisma.galleryDownloadPackage.update({
        where: { id: downloadPackage.id },
        data: {
          status: "stale",
          errorMessage: "A publikus képlista megváltozott ZIP készítés közben."
        }
      });

      return;
    }

    await prisma.galleryDownloadPackage.update({
      where: { id: downloadPackage.id },
      data: {
        status: "completed",
        photoCount: totalPhotoCount,
        processedCount: gallery.photos.length,
        processedBytes: bytesWritten,
        fileSize: bytesWritten,
        r2Key,
        downloadUrl,
        errorMessage: null,
        generatedAt
      }
    });

    const downloadSetReady = await completeGroupIfReady(downloadPackage.id);

    if (downloadSetReady) {
      await markOlderCompletedZipPackagesStale({
        galleryId: gallery.id,
        scope: downloadPackage.scope,
        keepPackageId: downloadPackage.id,
        keepGroupId: downloadPackage.groupId
      });

      await notifyGalleryZipReady({
        galleryId: gallery.id,
        adminId: gallery.adminId,
        recipient: gallery.admin?.siteSettings?.contactEmail || gallery.admin?.email,
        galleryTitle: gallery.title,
        gallerySlug: gallery.slug,
        publicSubdomain: gallery.admin?.siteSettings?.publicSubdomain ?? null,
        photoCount: totalPhotoCount,
        fileSizeBytes: bytesWritten,
        generatedAt
      });
    }

    safeRevalidatePath(`/admin/galleries/${gallery.id}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Die ZIP-Datei konnte nicht erstellt werden.";

    await prisma.galleryDownloadPackage.update({
      where: { id: downloadPackage.id },
      data: {
        status: "failed",
        errorMessage: message.slice(0, 500)
      }
    });

    throw error;
  }
}

export async function sendGalleryDownloadLinkForRequest(downloadId: string) {
  const download = await prisma.galleryDownload.findUnique({
    where: { id: downloadId },
    select: {
      id: true,
      email: true,
      package: {
        select: {
          id: true,
          status: true,
          scope: true,
          photoCount: true,
          fileSize: true,
          gallery: {
            select: {
              title: true,
              customer: {
                select: {
                  preferredLanguage: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (!download?.package || download.package.status !== "completed") {
    return;
  }

  const { token, expiresAt } = await ensureDownloadPackageAccessToken(download.package.id);
  const sentAt = new Date();
  const language = normalizeCustomerLanguage(download.package.gallery.customer?.preferredLanguage);
  const quality = publicDownloadQualityFromScope(download.package.scope);
  const qualityLabel = galleryDownloadQualityLabel(quality, language);
  const downloadUrl = galleryDownloadUrl(token);

  try {
    const sent = await sendGuestGalleryDownloadReadyEmail({
      to: download.email,
      galleryTitle: download.package.gallery.title,
      downloadUrl,
      downloadLinks: [
        {
          label: language === "hu" ? `${qualityLabel} ZIP letöltése` : `${qualityLabel} ZIP herunterladen`,
          url: downloadUrl,
          fileSizeBytes: download.package.fileSize
        }
      ],
      expiresAt,
      photoCount: download.package.photoCount,
      fileSizeBytes: download.package.fileSize,
      language
    });

    await prisma.galleryDownload.update({
      where: { id: download.id },
      data: sent
        ? {
            status: "emailed",
            downloadLinkSentAt: sentAt,
            downloadLinkEmailError: null
          }
        : {
            status: "email_failed",
            downloadLinkEmailError: "Missing email configuration."
          }
    });
  } catch (error) {
    await prisma.galleryDownload.update({
      where: { id: download.id },
      data: {
        status: "email_failed",
        downloadLinkEmailError: error instanceof Error ? error.message.slice(0, 500) : "Email sending failed."
      }
    });
  }
}

export async function sendGalleryDownloadLinksForPackages(packageIds: string[], options?: { downloadIds?: string[] }) {
  const uniquePackageIds = [...new Set(packageIds)];
  const downloadIds = options?.downloadIds ? [...new Set(options.downloadIds.filter(Boolean))] : [];

  if (uniquePackageIds.length === 0) {
    return;
  }

  const packages = await prisma.galleryDownloadPackage.findMany({
    where: {
      id: { in: uniquePackageIds },
      status: "completed"
    },
    orderBy: { partIndex: "asc" },
    select: {
      id: true,
      partIndex: true,
      partCount: true,
      scope: true,
      photoCount: true,
      fileSize: true,
      gallery: {
        select: {
          title: true,
          customer: {
            select: {
              preferredLanguage: true
            }
          }
        }
      },
      downloads: {
        where: {
          status: { in: ["waiting", "email_failed"] },
          ...(downloadIds.length > 0 ? { id: { in: downloadIds } } : {})
        },
        select: {
          id: true,
          email: true
        }
      }
    }
  });

  if (packages.length === 0) {
    return;
  }

  const packagesById = new Map(packages.map((downloadPackage) => [downloadPackage.id, downloadPackage]));
  const sortedPackages = uniquePackageIds
    .map((packageId) => packagesById.get(packageId))
    .flatMap((downloadPackage): CompletedDownloadPackage[] => (downloadPackage ? [downloadPackage] : []))
    .sort((a, b) => a.partIndex - b.partIndex);

  if (sortedPackages.length === 0) {
    return;
  }

  const downloadsByEmail = new Map<string, string[]>();

  for (const downloadPackage of sortedPackages) {
    for (const download of downloadPackage.downloads) {
      downloadsByEmail.set(download.email, [...(downloadsByEmail.get(download.email) ?? []), download.id]);
    }
  }

  if (downloadsByEmail.size === 0) {
    return;
  }

  const packageLinks = await Promise.all(
    sortedPackages.map(async (downloadPackage) => {
      const { token, expiresAt } = await ensureDownloadPackageAccessToken(downloadPackage.id);

      return {
        package: downloadPackage,
        expiresAt,
        url: galleryDownloadUrl(token)
      };
    })
  );
  const earliestExpiresAt = packageLinks.reduce(
    (earliest, link) => (link.expiresAt < earliest ? link.expiresAt : earliest),
    packageLinks[0].expiresAt
  );
  const galleryTitle = sortedPackages[0].gallery.title;
  const packageLanguage = normalizeCustomerLanguage(sortedPackages[0].gallery.customer?.preferredLanguage);
  const packageQuality = publicDownloadQualityFromScope(sortedPackages[0].scope);
  const packageQualityLabel = galleryDownloadQualityLabel(packageQuality, packageLanguage);
  const totalFileSize = sortedPackages.reduce((sum, downloadPackage) => sum + BigInt(downloadPackage.fileSize), BigInt(0));
  const totalPhotoCount = sortedPackages[0].photoCount;
  const downloadLinks = packageLinks.map((link) => ({
    label:
      link.package.partCount > 1
        ? packageLanguage === "hu"
          ? `${packageQualityLabel} ZIP rész ${link.package.partIndex + 1}/${link.package.partCount}`
          : `${packageQualityLabel} ZIP Teil ${link.package.partIndex + 1}/${link.package.partCount}`
        : packageLanguage === "hu"
          ? `${packageQualityLabel} ZIP letöltése`
          : `${packageQualityLabel} ZIP herunterladen`,
    url: link.url,
    fileSizeBytes: link.package.fileSize
  }));

  for (const [email, downloadIds] of downloadsByEmail) {
    const sentAt = new Date();

    try {
      const sent = await sendGuestGalleryDownloadReadyEmail({
        to: email,
        galleryTitle,
        downloadUrl: downloadLinks[0]?.url,
        downloadLinks,
        expiresAt: earliestExpiresAt,
        photoCount: totalPhotoCount,
        fileSizeBytes: totalFileSize,
        language: packageLanguage
      });

      await prisma.galleryDownload.updateMany({
        where: { id: { in: downloadIds } },
        data: sent
          ? {
              status: "emailed",
              downloadLinkSentAt: sentAt,
              downloadLinkEmailError: null
            }
          : {
              status: "email_failed",
            downloadLinkEmailError: "Missing email configuration."
          }
      });
      const purchaseId = paidPurchaseIdFromScope(sortedPackages[0].scope);

      if (purchaseId) {
        await prisma.galleryPurchase.update({
          where: { id: purchaseId },
          data: sent
            ? {
                fulfillmentEmailSentAt: sentAt,
                fulfillmentError: null
              }
            : {
                fulfillmentError: "Missing email configuration."
              }
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : "Email sending failed.";
      await prisma.galleryDownload.updateMany({
        where: { id: { in: downloadIds } },
        data: {
          status: "email_failed",
          downloadLinkEmailError: message
        }
      });
      const purchaseId = paidPurchaseIdFromScope(sortedPackages[0].scope);

      if (purchaseId) {
        await prisma.galleryPurchase.update({
          where: { id: purchaseId },
          data: { fulfillmentError: message }
        });
      }
    }
  }
}

export async function sendGalleryDownloadLinksForDownloadRequests(downloadIds: string[]) {
  const uniqueDownloadIds = [...new Set(downloadIds.filter(Boolean))];

  if (uniqueDownloadIds.length === 0) {
    return;
  }

  const downloads = await prisma.galleryDownload.findMany({
    where: { id: { in: uniqueDownloadIds }, packageId: { not: null } },
    select: {
      id: true,
      packageId: true
    }
  });
  const packageIds = downloads.map((download) => download.packageId).filter((packageId): packageId is string => Boolean(packageId));

  await sendGalleryDownloadLinksForPackages(packageIds, {
    downloadIds: downloads.map((download) => download.id)
  });
}

export async function sendGalleryDownloadLinksForPackage(packageId: string) {
  const downloadPackage = await prisma.galleryDownloadPackage.findUnique({
    where: { id: packageId },
    select: {
      id: true,
      groupId: true,
      status: true
    }
  });

  if (!downloadPackage) {
    return;
  }

  if (downloadPackage.groupId) {
    const packages = await prisma.galleryDownloadPackage.findMany({
      where: { groupId: downloadPackage.groupId },
      orderBy: { partIndex: "asc" },
      select: {
        id: true,
        status: true,
        downloadUrl: true,
        partCount: true
      }
    });
    const expectedPartCount = Math.max(...packages.map((downloadPart) => downloadPart.partCount), packages.length, 1);
    const isComplete =
      packages.length === expectedPartCount &&
      packages.every((downloadPart) => downloadPart.status === "completed" && downloadPart.downloadUrl);

    if (isComplete) {
      await sendGalleryDownloadLinksForPackages(packages.map((downloadPart) => downloadPart.id));
    }

    return;
  }

  if (downloadPackage.status !== "completed") {
    return;
  }

  await sendGalleryDownloadLinksForPackages([downloadPackage.id]);
}

async function notifyGalleryZipReady({
  galleryId,
  adminId,
  recipient,
  galleryTitle,
  gallerySlug,
  publicSubdomain,
  photoCount,
  fileSizeBytes,
  generatedAt
}: {
  galleryId: string;
  adminId: string;
  recipient?: string;
  galleryTitle: string;
  gallerySlug: string;
  publicSubdomain?: string | null;
  photoCount: number;
  fileSizeBytes: bigint;
  generatedAt: Date;
}) {
  if (adminId) {
    await prisma.adminNotification
      .create({
        data: {
          adminId,
          type: "gallery_zip_ready",
          title: "Galéria ZIP elkészült",
          message: `A(z) ${galleryTitle} galéria ZIP fájlja elkészült ${photoCount} médiával.`,
          href: `/admin/galleries/${galleryId}`
        }
      })
      .catch((error) => {
        console.error("Gallery ZIP ready admin notification failed", {
          galleryId,
          error
        });
      });
  } else {
    console.warn("Skipped ZIP ready admin notification without gallery owner", {
      galleryId,
      galleryTitle
    });
  }

  try {
    await sendAdminGalleryZipReadyEmail({
      to: recipient,
      galleryTitle,
      galleryAdminUrl: adminGalleryUrl(galleryId),
      galleryPublicUrl: publicGalleryUrl(gallerySlug, undefined, publicSubdomain),
      photoCount,
      fileSizeBytes,
      generatedAt
    });
  } catch (error) {
    console.error("Gallery ZIP ready email failed", {
      galleryId,
      error
    });
  }

  safeRevalidatePath("/admin/dashboard");
  safeRevalidatePath("/admin/notifications");
}

async function processBackgroundJob(job: {
  id: string;
  type: string;
  payload: Prisma.JsonValue;
  attempts: number;
  maxAttempts: number;
}) {
  if (job.type === ZIP_GENERATION_JOB) {
    await generateGalleryZip(parseZipGenerationPayload(job.payload));
    return;
  }

  throw new Error(`Unknown background job type: ${job.type}`);
}

export async function cleanupStuckGalleryZipWork() {
  const now = new Date();
  const stuckCutoff = new Date(now.getTime() - ZIP_STUCK_PROCESSING_HOURS * HOUR_MS);
  const [stuckPackages, stuckJobs] = await Promise.all([
    prisma.galleryDownloadPackage.updateMany({
      where: {
        status: "processing",
        updatedAt: { lt: stuckCutoff }
      },
      data: {
        status: "failed",
        errorMessage: "A ZIP feldolgozás beragadt, ezért újraindítás vagy új ZIP szükséges."
      }
    }),
    prisma.backgroundJob.updateMany({
      where: {
        type: ZIP_GENERATION_JOB,
        status: "processing",
        lockedAt: { lt: stuckCutoff }
      },
      data: {
        status: "failed",
        lockedAt: null,
        errorMessage: "A ZIP háttérmunka túl régóta futott, ezért takarítás failed státuszra állította."
      }
    })
  ]);

  return {
    stuckPackages: stuckPackages.count,
    stuckJobs: stuckJobs.count
  };
}

export async function processPendingJobs({ limit = 1, type }: { limit?: number; type?: string } = {}) {
  const staleLockCutoff = new Date(Date.now() - 15 * 60 * 1000);
  const where: Prisma.BackgroundJobWhereInput = {
    ...(type ? { type } : {}),
    OR: [
      { status: "pending" },
      {
        status: "processing",
        lockedAt: { lt: staleLockCutoff }
      }
    ]
  };
  const jobs = await prisma.backgroundJob.findMany({
    where,
    orderBy: { createdAt: "asc" },
    take: limit,
    select: {
      id: true,
      type: true,
      status: true,
      payload: true,
      attempts: true,
      maxAttempts: true
    }
  });

  const results = {
    processed: 0,
    failed: 0
  };

  for (const job of jobs) {
    const locked = await prisma.backgroundJob.updateMany({
      where: {
        id: job.id,
        status: job.status
      },
      data: {
        status: "processing",
        attempts: { increment: 1 },
        lockedAt: new Date(),
        startedAt: new Date(),
        errorMessage: null
      }
    });

    if (locked.count === 0) {
      continue;
    }

    try {
      await processBackgroundJob(job);

      await prisma.backgroundJob.update({
        where: { id: job.id },
        data: {
          status: "completed",
          completedAt: new Date(),
          lockedAt: null,
          errorMessage: null
        }
      });

      results.processed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Background job failed.";
      const nextAttempts = job.attempts + 1;
      const shouldRetry = nextAttempts < job.maxAttempts;

      await prisma.backgroundJob.update({
        where: { id: job.id },
        data: {
          status: shouldRetry ? "pending" : "failed",
          lockedAt: null,
          errorMessage: message.slice(0, 500)
        }
      });

      results.failed += 1;
    }
  }

  return results;
}
