import { revalidatePath } from "next/cache";
import { createRequire } from "node:module";
import { PassThrough, Readable } from "node:stream";
import { Prisma } from "@prisma/client";
import type { Archiver, ArchiverOptions } from "archiver";
import { prisma } from "@/lib/prisma";
import { createGalleryZipObjectKey, getPhotoPublicUrl, savePhotoStream } from "@/lib/storage";

const ZIP_GENERATION_JOB = "zip_generation";
const require = createRequire(import.meta.url);
const archiver = require("archiver") as (format: "zip", options: ArchiverOptions) => Archiver;

type ZipGenerationPayload = {
  galleryId: string;
  packageId: string;
};

function photoZipFileName(filename: string, index: number) {
  const fallback = `photo-${String(index + 1).padStart(3, "0")}.jpg`;
  return (filename || fallback).replace(/[\\/:*?"<>|]/g, "-");
}

function createRemoteFileStream(photo: { filename: string; imageUrl: string }) {
  return Readable.from(
    (async function* () {
      const response = await fetch(photo.imageUrl, { cache: "no-store" });

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

async function generateGalleryZip(payload: ZipGenerationPayload) {
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

  const downloadPackageId = downloadPackage.id;

  const gallery = await prisma.gallery.findUnique({
    where: { id: payload.galleryId },
    select: {
      id: true,
      title: true,
      slug: true,
      isActive: true,
      photos: {
        where: { isClientHidden: false },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        skip: downloadPackage.photoOffset,
        take: downloadPackage.photoLimit ?? undefined,
        select: {
          filename: true,
          imageUrl: true
        }
      }
    }
  });

  if (!gallery || !gallery.isActive) {
    throw new Error("Diese Galerie ist derzeit nicht verfügbar.");
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

    const zip = archiver("zip", {
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
      zip.append(createRemoteFileStream(photo), {
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
        generatedAt: new Date()
      }
    });

    revalidatePath(`/admin/galleries/${gallery.id}`);
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
