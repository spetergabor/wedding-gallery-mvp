import { task } from "@trigger.dev/sdk/v3";
import {
  PHOTO_MULTIPART_FINALIZATION_TASK_ID,
  type PhotoMultipartFinalizationPayload,
  processPhotoMultipartFinalization
} from "@/lib/photo-multipart";

const maxDuration = Number.parseInt(process.env.TRIGGER_MEDIA_UPLOAD_MAX_DURATION_SECONDS ?? "300", 10);

export const photoMultipartFinalizationTask = task({
  id: PHOTO_MULTIPART_FINALIZATION_TASK_ID,
  description: "Finalize large gallery media multipart uploads in R2 outside the Vercel request lifecycle.",
  queue: {
    name: "photo-multipart-finalization",
    concurrencyLimit: 2
  },
  machine: "small-1x",
  maxDuration: Number.isFinite(maxDuration) ? maxDuration : 300,
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 30_000,
    maxTimeoutInMs: 300_000,
    randomize: true
  },
  run: async (payload: PhotoMultipartFinalizationPayload) => {
    return processPhotoMultipartFinalization(payload);
  }
});
