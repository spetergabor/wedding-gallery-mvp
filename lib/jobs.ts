import { revalidatePath } from "next/cache";
import { PassThrough, Readable } from "node:stream";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { ZipArchive } from "archiver";
import { prisma } from "@/lib/prisma";
import { ensureDownloadPackageAccessToken, PUBLIC_DOWNLOAD_SCOPE } from "@/lib/download-packages";
import {
  adminGalleryUrl,
  galleryDownloadUrl,
  publicGalleryUrl,
  sendAdminGalleryZipReadyEmail,
  sendGuestGalleryDownloadReadyEmail
} from "@/lib/email";
import { createGalleryZipObjectKey, createPhotoReadStream, deletePhotoObject, getPhotoPublicUrl, savePhotoStream } from "@/lib/storage";
import { PHOTO_DELIVERY_STAGE_FINAL, PROOFING_STATUS_DELIVERED, isProofingGallery } from "@/lib/proofing";

export const ZIP_GENERATION_JOB = "zip_generation";
const STALE_ZIP_PROCESSING_MS = 15 * 60 * 1000;
const REMOTE_FILE_FETCH_TIMEOUT_MS = 10 * 60 * 1000;

type ZipGenerationPayload = {
  galleryId: string;
  packageId: string;
  jobId?: string;
};

type CompletedDownloadPackage = {
  id: string;
  partIndex: number;
  partCount: number;
  photoCount: number;
  fileSize: bigint;
  gallery: {
    title: string;
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

export function galleryZipFileName(title: string, partIndex?: number, partCount?: number) {
  const baseName = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "") || "gallery";

  if (partCount && partCount > 1 && partIndex !== undefined) {
    return `${baseName}-teil-${String(partIndex + 1).padStart(2, "0")}-von-${String(partCount).padStart(2, "0")}.zip`;
  }

  return `${baseName}.zip`;
}

function photoZipFileName(filename: string, index: number) {
  const fallback = `photo-${String(index + 1).padStart(3, "0")}.jpg`;
  return (filename || fallback).replace(/[\\/:*?"<>|]/g, "-");
}

function readPositiveMegabytes(value: string | undefined, fallback: number, minimum: number) {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(parsed) || parsed < minimum) {
    return fallback * 1024 * 1024;
  }

  return parsed * 1024 * 1024;
}

const ZIP_PART_TARGET_BYTES = readPositiveMegabytes(process.env.GALLERY_ZIP_PART_TARGET_MB, 2048, 256);

function createZipPartRanges(photos: Array<{ fileSize: number | null }>) {
  const ranges: Array<{ offset: number; limit: number }> = [];
  let offset = 0;
  let currentBytes = 0;
  let currentCount = 0;

  for (const photo of photos) {
    const size = photo.fileSize && photo.fileSize > 0 ? photo.fileSize : 25 * 1024 * 1024;

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

  return {
    driver: "vercel",
    ...(await processPendingJobs({ limit: 1 }))
  };
}

export async function kickGalleryZipJobs(payloads: ZipGenerationPayload[]) {
  const results = [];

  for (const payload of payloads) {
    results.push(await kickGalleryZipJob(payload));
  }

  return results;
}

export async function preparePublicGalleryZipPackages(galleryId: string): Promise<PreparePublicGalleryZipPackagesResult> {
  const gallery = await prisma.gallery.findUnique({
    where: { id: galleryId },
    select: {
      id: true,
      isActive: true,
      downloadsEnabled: true,
      galleryMode: true,
      proofingStatus: true,
      photos: {
        where: { isClientHidden: false, deliveryStage: PHOTO_DELIVERY_STAGE_FINAL },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          createdAt: true,
          fileSize: true
        }
      }
    }
  });

  if (!gallery?.isActive) {
    return { ok: false, reason: "not-active", packages: [], payloads: [] };
  }

  if (!gallery.downloadsEnabled) {
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
      scope: PUBLIC_DOWNLOAD_SCOPE,
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
      scope: PUBLIC_DOWNLOAD_SCOPE,
      status: { in: ["pending", "processing"] },
      photoCount: gallery.photos.length
    },
    orderBy: [{ groupId: "desc" }, { partIndex: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      status: true,
      downloadUrl: true,
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

  const ranges = createZipPartRanges(gallery.photos);
  const partCount = ranges.length;
  const groupId = partCount > 1 ? randomUUID() : null;
  const createdPackages = await prisma.$transaction(
    ranges.map((range, partIndex) =>
      prisma.galleryDownloadPackage.create({
        data: {
          galleryId,
          scope: PUBLIC_DOWNLOAD_SCOPE,
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
      partIndex: true,
      partCount: true,
      photoOffset: true,
      photoLimit: true
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

  const gallery = await prisma.gallery.findUnique({
    where: { id: payload.galleryId },
    select: {
      id: true,
      title: true,
      slug: true,
      adminId: true,
      downloadsEnabled: true,
      galleryMode: true,
      proofingStatus: true,
      admin: {
        select: {
          email: true,
          siteSettings: {
            select: {
              contactEmail: true
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
          r2Key: true,
          fileSize: true
        }
      }
    }
  });

  if (!gallery) {
    throw new Error("Diese Galerie wurde nicht gefunden.");
  }

  if (!gallery.downloadsEnabled) {
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
      const mediaStream = photo.imageUrl
        ? createRemoteFileStream(photo)
        : createPhotoReadStream({
            r2Key: photo.r2Key,
            publicUrl: photo.imageUrl,
            byteLength: photo.fileSize
          });

      zip.append(mediaStream, {
        name: photoZipFileName(photo.filename, downloadPackage.photoOffset + index)
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
      await notifyGalleryZipReady({
        galleryId: gallery.id,
        adminId: gallery.adminId,
        recipient: gallery.admin?.siteSettings?.contactEmail || gallery.admin?.email,
        galleryTitle: gallery.title,
        gallerySlug: gallery.slug,
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
          photoCount: true,
          fileSize: true,
          gallery: {
            select: {
              title: true
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

  try {
    const sent = await sendGuestGalleryDownloadReadyEmail({
      to: download.email,
      galleryTitle: download.package.gallery.title,
      downloadUrl: galleryDownloadUrl(token),
      expiresAt,
      photoCount: download.package.photoCount,
      fileSizeBytes: download.package.fileSize
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

export async function sendGalleryDownloadLinksForPackages(packageIds: string[]) {
  const uniquePackageIds = [...new Set(packageIds)];

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
      photoCount: true,
      fileSize: true,
      gallery: {
        select: {
          title: true
        }
      },
      downloads: {
        where: { status: { in: ["waiting", "email_failed"] } },
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
    .filter((downloadPackage): downloadPackage is CompletedDownloadPackage => Boolean(downloadPackage))
    .sort((a, b) => a.partIndex - b.partIndex);
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
  const totalFileSize = sortedPackages.reduce((sum, downloadPackage) => sum + BigInt(downloadPackage.fileSize), BigInt(0));
  const totalPhotoCount = sortedPackages[0].photoCount;
  const downloadLinks = packageLinks.map((link) => ({
    label:
      link.package.partCount > 1
        ? `ZIP Teil ${link.package.partIndex + 1}/${link.package.partCount}`
        : "ZIP herunterladen",
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
        fileSizeBytes: totalFileSize
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
    } catch (error) {
      await prisma.galleryDownload.updateMany({
        where: { id: { in: downloadIds } },
        data: {
          status: "email_failed",
          downloadLinkEmailError: error instanceof Error ? error.message.slice(0, 500) : "Email sending failed."
        }
      });
    }
  }
}

export async function sendGalleryDownloadLinksForPackage(packageId: string) {
  const downloadPackage = await prisma.galleryDownloadPackage.findUnique({
    where: { id: packageId },
    select: {
      id: true,
      groupId: true,
      status: true,
      photoCount: true,
      fileSize: true,
      gallery: {
        select: {
          title: true
        }
      },
      downloads: {
        where: { status: { in: ["waiting", "email_failed"] } },
        select: {
          id: true,
          email: true
        }
      }
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

  if (downloadPackage.status !== "completed" || downloadPackage.downloads.length === 0) {
    return;
  }

  const { token, expiresAt } = await ensureDownloadPackageAccessToken(downloadPackage.id);
  const downloadUrl = galleryDownloadUrl(token);
  const downloadsByEmail = new Map<string, string[]>();

  for (const download of downloadPackage.downloads) {
    downloadsByEmail.set(download.email, [...(downloadsByEmail.get(download.email) ?? []), download.id]);
  }

  for (const [email, downloadIds] of downloadsByEmail) {
    const sentAt = new Date();

    try {
      const sent = await sendGuestGalleryDownloadReadyEmail({
        to: email,
        galleryTitle: downloadPackage.gallery.title,
        downloadUrl,
        expiresAt,
        photoCount: downloadPackage.photoCount,
        fileSizeBytes: downloadPackage.fileSize
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
    } catch (error) {
      await prisma.galleryDownload.updateMany({
        where: { id: { in: downloadIds } },
        data: {
          status: "email_failed",
          downloadLinkEmailError: error instanceof Error ? error.message.slice(0, 500) : "Email sending failed."
        }
      });
    }
  }
}

async function notifyGalleryZipReady({
  galleryId,
  adminId,
  recipient,
  galleryTitle,
  gallerySlug,
  photoCount,
  fileSizeBytes,
  generatedAt
}: {
  galleryId: string;
  adminId: string | null;
  recipient?: string;
  galleryTitle: string;
  gallerySlug: string;
  photoCount: number;
  fileSizeBytes: bigint;
  generatedAt: Date;
}) {
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

  try {
    await sendAdminGalleryZipReadyEmail({
      to: recipient,
      galleryTitle,
      galleryAdminUrl: adminGalleryUrl(galleryId),
      galleryPublicUrl: publicGalleryUrl(gallerySlug),
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

export async function processPendingJobs({ limit = 1 } = {}) {
  const staleLockCutoff = new Date(Date.now() - 15 * 60 * 1000);
  const jobs = await prisma.backgroundJob.findMany({
    where: {
      OR: [
        { status: "pending" },
        {
          status: "processing",
          lockedAt: { lt: staleLockCutoff }
        }
      ]
    },
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
