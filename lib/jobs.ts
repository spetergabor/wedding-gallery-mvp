import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import JSZip from "jszip";
import { prisma } from "@/lib/prisma";
import { createGalleryZipObjectKey, getPhotoPublicUrl, savePhotoObject } from "@/lib/storage";

const ZIP_GENERATION_JOB = "zip_generation";
const ZIP_PHOTO_FETCH_CONCURRENCY = 4;

type ZipGenerationPayload = {
  galleryId: string;
  packageId: string;
};

function photoZipFileName(filename: string, index: number) {
  const fallback = `photo-${String(index + 1).padStart(3, "0")}.jpg`;
  return (filename || fallback).replace(/[\\/:*?"<>|]/g, "-");
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

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
) {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));

  return results;
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
      errorMessage: null
    }
  });

  try {
    const zip = new JSZip();
    const downloadedPhotos = await mapWithConcurrency(gallery.photos, ZIP_PHOTO_FETCH_CONCURRENCY, async (photo, index) => {
      const response = await fetch(photo.imageUrl, { cache: "no-store" });

      if (!response.ok) {
        throw new Error(`${photo.filename} konnte nicht geladen werden.`);
      }

      const bytes = Buffer.from(await response.arrayBuffer());
      return {
        filename: photoZipFileName(photo.filename, downloadPackage.photoOffset + index),
        bytes
      };
    });

    for (const photo of downloadedPhotos) {
      zip.file(photo.filename, photo.bytes);
    }

    const zipBuffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "STORE"
    });
    const r2Key = createGalleryZipObjectKey({ gallerySlug: gallery.slug });
    const downloadUrl = getPhotoPublicUrl(r2Key);

    await savePhotoObject({
      r2Key,
      bytes: zipBuffer,
      contentType: "application/zip"
    });

    await prisma.galleryDownloadPackage.update({
      where: { id: downloadPackage.id },
      data: {
        status: "completed",
        photoCount: totalPhotoCount,
        fileSize: zipBuffer.length,
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
