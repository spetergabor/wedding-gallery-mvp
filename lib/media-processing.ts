import { revalidatePath } from "next/cache";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import {
  createPhotoVariantObjectKey,
  getPhotoPublicUrl,
  loadPhotoObjectBuffer,
  savePhotoObject
} from "@/lib/storage";

const MEDIA_PROCESSING_TASK_ID = "media-processing";
const MEDIA_PROCESSING_STALE_MS = 30 * 60 * 1000;
const DEFAULT_MEDIA_PROCESSING_LIMIT = 20;
const THUMBNAIL_MAX_SIZE = 900;
const PREVIEW_MAX_SIZE = 2400;

type MediaProcessingPayload = {
  galleryId?: string;
};

type ClaimedMediaJob = {
  id: string;
  galleryId: string;
  photoId: string;
  mediaType: string;
  sourceR2Key: string;
  thumbnailR2Key: string | null;
  previewR2Key: string | null;
  gallery: {
    slug: string;
  };
  photo: {
    filename: string;
    r2Key: string;
    imageUrl: string;
  };
};

function readPositiveInteger(value: string | undefined, fallback: number, minimum: number) {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(parsed) || parsed < minimum) {
    return fallback;
  }

  return parsed;
}

function safeRevalidatePath(path: string) {
  try {
    revalidatePath(path);
  } catch (error) {
    console.warn("Skipped media processing revalidation outside Next.js request context", {
      path,
      message: error instanceof Error ? error.message : "Unknown revalidation error"
    });
  }
}

function isTriggerMediaWorkerEnabled() {
  return Boolean(process.env.TRIGGER_SECRET_KEY) && process.env.MEDIA_WORKER_DRIVER !== "off";
}

async function markMediaJobFailed(job: ClaimedMediaJob, error: unknown) {
  const message = error instanceof Error ? error.message : "Media processing failed.";

  await prisma.$transaction([
    prisma.mediaProcessingJob.update({
      where: { id: job.id },
      data: {
        status: "failed",
        errorMessage: message.slice(0, 500),
        completedAt: new Date()
      }
    }),
    prisma.photo.update({
      where: { id: job.photoId },
      data: {
        processingStatus: "failed",
        processingError: message.slice(0, 500)
      }
    })
  ]);
}

async function claimMediaProcessingJobs({ galleryId, limit }: { galleryId?: string; limit: number }) {
  const staleCutoff = new Date(Date.now() - MEDIA_PROCESSING_STALE_MS);
  const candidates = await prisma.mediaProcessingJob.findMany({
    where: {
      ...(galleryId ? { galleryId } : {}),
      mediaType: "image",
      OR: [
        { status: "pending" },
        {
          status: "processing",
          claimedAt: { lt: staleCutoff }
        }
      ]
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: {
      id: true,
      galleryId: true,
      photoId: true,
      mediaType: true,
      sourceR2Key: true,
      thumbnailR2Key: true,
      previewR2Key: true,
      gallery: {
        select: {
          slug: true
        }
      },
      photo: {
        select: {
          filename: true,
          r2Key: true,
          imageUrl: true
        }
      }
    }
  });
  const claimedJobs: ClaimedMediaJob[] = [];

  for (const job of candidates) {
    const locked = await prisma.mediaProcessingJob.updateMany({
      where: {
        id: job.id,
        OR: [
          { status: "pending" },
          {
            status: "processing",
            claimedAt: { lt: staleCutoff }
          }
        ]
      },
      data: {
        status: "processing",
        attempts: { increment: 1 },
        claimedAt: new Date(),
        completedAt: null,
        errorMessage: null
      }
    });

    if (locked.count === 0) {
      continue;
    }

    await prisma.photo.update({
      where: { id: job.photoId },
      data: {
        processingStatus: "processing",
        processingError: null
      }
    });

    claimedJobs.push(job);
  }

  return claimedJobs;
}

async function processImageMediaJob(job: ClaimedMediaJob) {
  const sourceR2Key = job.sourceR2Key || job.photo.r2Key;

  if (!sourceR2Key) {
    throw new Error("Missing source R2 key for image processing.");
  }

  const thumbnailR2Key =
    job.thumbnailR2Key ??
    createPhotoVariantObjectKey({
      gallerySlug: job.gallery.slug,
      originalFilename: job.photo.filename,
      variant: "thumbnail"
    });
  const previewR2Key =
    job.previewR2Key ??
    createPhotoVariantObjectKey({
      gallerySlug: job.gallery.slug,
      originalFilename: job.photo.filename,
      variant: "preview"
    });
  const sourceBuffer = await loadPhotoObjectBuffer({
    r2Key: sourceR2Key,
    publicUrl: job.photo.imageUrl
  });
  const image = sharp(sourceBuffer, { failOn: "none" }).rotate();
  const thumbnailBuffer = await image
    .clone()
    .resize({
      width: THUMBNAIL_MAX_SIZE,
      height: THUMBNAIL_MAX_SIZE,
      fit: "inside",
      withoutEnlargement: true
    })
    .jpeg({ quality: 78, mozjpeg: true })
    .toBuffer();
  const previewOutput = await image
    .clone()
    .resize({
      width: PREVIEW_MAX_SIZE,
      height: PREVIEW_MAX_SIZE,
      fit: "inside",
      withoutEnlargement: true
    })
    .jpeg({ quality: 84, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });

  await Promise.all([
    savePhotoObject({
      r2Key: thumbnailR2Key,
      bytes: thumbnailBuffer,
      contentType: "image/jpeg"
    }),
    savePhotoObject({
      r2Key: previewR2Key,
      bytes: previewOutput.data,
      contentType: "image/jpeg"
    })
  ]);

  const thumbnailUrl = getPhotoPublicUrl(thumbnailR2Key);
  const previewUrl = getPhotoPublicUrl(previewR2Key);

  await prisma.$transaction([
    prisma.mediaProcessingJob.update({
      where: { id: job.id },
      data: {
        status: "completed",
        thumbnailR2Key,
        previewR2Key,
        errorMessage: null,
        completedAt: new Date()
      }
    }),
    prisma.photo.update({
      where: { id: job.photoId },
      data: {
        thumbnailUrl,
        previewUrl,
        imageWidth: previewOutput.info.width,
        imageHeight: previewOutput.info.height,
        processingStatus: "ready",
        processingError: null,
        processingCompletedAt: new Date()
      }
    })
  ]);
}

export async function processMediaProcessingJobs({
  galleryId,
  limit = DEFAULT_MEDIA_PROCESSING_LIMIT
}: {
  galleryId?: string;
  limit?: number;
} = {}) {
  const jobs = await claimMediaProcessingJobs({ galleryId, limit });
  const results = {
    processed: 0,
    failed: 0,
    claimed: jobs.length
  };

  for (const job of jobs) {
    try {
      await processImageMediaJob(job);
      results.processed += 1;
    } catch (error) {
      await markMediaJobFailed(job, error);
      results.failed += 1;
    }
  }

  for (const galleryIdToRevalidate of new Set(jobs.map((job) => job.galleryId))) {
    safeRevalidatePath(`/admin/galleries/${galleryIdToRevalidate}`);
  }

  return results;
}

export async function countPendingMediaProcessingJobs(galleryId?: string) {
  const staleCutoff = new Date(Date.now() - MEDIA_PROCESSING_STALE_MS);

  return prisma.mediaProcessingJob.count({
    where: {
      ...(galleryId ? { galleryId } : {}),
      mediaType: "image",
      OR: [
        { status: "pending" },
        {
          status: "processing",
          claimedAt: { lt: staleCutoff }
        }
      ]
    }
  });
}

export async function kickGalleryMediaProcessing({
  galleryId,
  force = false
}: {
  galleryId: string;
  force?: boolean;
}) {
  if (!galleryId) {
    return { driver: "none", dispatched: false };
  }

  if (isTriggerMediaWorkerEnabled()) {
    try {
      const { tasks } = await import("@trigger.dev/sdk/v3");
      const idempotencyBucket = force ? Date.now() : Math.floor(Date.now() / 60_000);

      await tasks.trigger(MEDIA_PROCESSING_TASK_ID, { galleryId } satisfies MediaProcessingPayload, {
        idempotencyKey: `media-processing:${galleryId}:${idempotencyBucket}`,
        queue: "media-processing",
        concurrencyKey: `gallery:${galleryId}`,
        tags: [`gallery:${galleryId}`, "media-processing"]
      });

      return { driver: "trigger", dispatched: true };
    } catch (error) {
      console.error("Trigger.dev media processing dispatch failed", {
        galleryId,
        error
      });

      if (process.env.MEDIA_WORKER_DRIVER === "trigger") {
        return { driver: "trigger_unavailable", dispatched: false };
      }
    }
  }

  if (!process.env.VERCEL) {
    const fallbackLimit = readPositiveInteger(process.env.MEDIA_PROCESSING_LOCAL_LIMIT, 5, 1);
    await processMediaProcessingJobs({ galleryId, limit: fallbackLimit });

    return { driver: "local", dispatched: true };
  }

  return { driver: "unavailable", dispatched: false };
}
