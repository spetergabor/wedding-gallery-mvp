import { task } from "@trigger.dev/sdk/v3";
import {
  PHOTO_MULTIPART_FINALIZATION_MAX_DURATION_SECONDS,
  PHOTO_MULTIPART_FINALIZATION_TASK_ID,
  type PhotoMultipartFinalizationPayload,
  processPhotoMultipartFinalization
} from "@/lib/photo-multipart";

export const photoMultipartFinalizationTask = task({
  id: PHOTO_MULTIPART_FINALIZATION_TASK_ID,
  description: "Finalize large gallery media multipart uploads in R2 outside the Vercel request lifecycle.",
  queue: {
    name: "photo-multipart-finalization",
    concurrencyLimit: 2
  },
  machine: "small-1x",
  maxDuration: PHOTO_MULTIPART_FINALIZATION_MAX_DURATION_SECONDS,
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
