import { prisma } from "@/lib/prisma";
import { completeMultipartUpload, getPhotoObjectByteLength } from "@/lib/storage";

export const PHOTO_MULTIPART_FINALIZATION_TASK_ID = "photo-multipart-finalization";

export type PhotoMultipartFinalizationPayload = {
  galleryId: string;
  sessionId: string;
  uploadItemId: string;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "A videó összeillesztése nem sikerült.";
}

async function completedObjectMatches(r2Key: string, expectedSize: number) {
  try {
    const actualSize = await getPhotoObjectByteLength(r2Key);
    return actualSize !== null && actualSize > 0 && Math.round(actualSize) === Math.round(expectedSize);
  } catch (error) {
    console.warn("Could not verify completed multipart photo object", {
      r2Key,
      error
    });
    return false;
  }
}

export async function processPhotoMultipartFinalization({
  galleryId,
  sessionId,
  uploadItemId
}: PhotoMultipartFinalizationPayload) {
  const item = await prisma.galleryUploadItem.findFirst({
    where: {
      id: uploadItemId,
      sessionId,
      session: { galleryId }
    },
    select: {
      id: true,
      filename: true,
      r2Key: true,
      multipartUploadId: true,
      multipartPartCount: true,
      fileSize: true,
      uploadedAt: true
    }
  });

  if (!item?.r2Key || !item.multipartUploadId || !item.multipartPartCount) {
    throw new Error("A darabolt feltöltés nem található.");
  }

  if (item.uploadedAt) {
    return { ok: true, alreadyCompleted: true };
  }

  await prisma.galleryUploadItem.update({
    where: { id: item.id },
    data: {
      status: "finalizing",
      errorMessage: null
    }
  });

  try {
    await completeMultipartUpload({
      r2Key: item.r2Key,
      uploadId: item.multipartUploadId,
      parts: Array.from({ length: item.multipartPartCount }, (_, index) => ({ partNumber: index + 1 }))
    });
  } catch (error) {
    // R2 may have completed the object even if the response was interrupted. In that
    // case a retry receives an invalid upload id, so verify the final object first.
    if (!(await completedObjectMatches(item.r2Key, item.fileSize))) {
      const message = errorMessage(error).slice(0, 500);

      await prisma.galleryUploadItem.update({
        where: { id: item.id },
        data: {
          status: "failed",
          errorMessage: message
        }
      });

      console.error("Photo multipart finalization failed", {
        galleryId,
        sessionId,
        uploadItemId,
        filename: item.filename,
        error
      });
      throw error;
    }
  }

  await prisma.galleryUploadItem.update({
    where: { id: item.id },
    data: {
      status: "uploaded",
      uploadedAt: new Date(),
      errorMessage: null
    }
  });

  return { ok: true, alreadyCompleted: false };
}

export async function dispatchPhotoMultipartFinalization(payload: PhotoMultipartFinalizationPayload) {
  if (process.env.TRIGGER_SECRET_KEY) {
    const { tasks } = await import("@trigger.dev/sdk/v3");

    await tasks.trigger(PHOTO_MULTIPART_FINALIZATION_TASK_ID, payload, {
      queue: "photo-multipart-finalization",
      concurrencyKey: `upload:${payload.uploadItemId}`,
      tags: [
        `gallery:${payload.galleryId}`,
        `upload-session:${payload.sessionId}`,
        `upload-item:${payload.uploadItemId}`
      ]
    });

    return { driver: "trigger" as const, dispatched: true };
  }

  if (!process.env.VERCEL) {
    await processPhotoMultipartFinalization(payload);
    return { driver: "local" as const, dispatched: true };
  }

  return { driver: "unavailable" as const, dispatched: false };
}
