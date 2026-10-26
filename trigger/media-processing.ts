import { task, tasks } from "@trigger.dev/sdk/v3";
import { countPendingMediaProcessingJobs, processMediaProcessingJobs } from "@/lib/media-processing";

type MediaProcessingPayload = {
  galleryId?: string;
};

function readPositiveInteger(value: string | undefined, fallback: number, minimum: number) {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(parsed) || parsed < minimum) {
    return fallback;
  }

  return parsed;
}

const maxDuration = readPositiveInteger(process.env.TRIGGER_MEDIA_MAX_DURATION_SECONDS, 7200, 60);
const batchSize = readPositiveInteger(process.env.MEDIA_PROCESSING_BATCH_SIZE, 20, 1);

export const mediaProcessingTask = task({
  id: "media-processing",
  description: "Generate lightweight thumbnails and previews for uploaded gallery images.",
  queue: {
    name: "media-processing",
    concurrencyLimit: 2
  },
  machine: "small-1x",
  maxDuration,
  retry: {
    maxAttempts: 1
  },
  run: async (payload: MediaProcessingPayload) => {
    const result = await processMediaProcessingJobs({
      galleryId: payload.galleryId,
      limit: batchSize
    });
    const remaining = await countPendingMediaProcessingJobs(payload.galleryId);

    if (remaining > 0) {
      const concurrencyKey = payload.galleryId ? `gallery:${payload.galleryId}` : "global-recovery";
      const tags = payload.galleryId
        ? [`gallery:${payload.galleryId}`, "media-processing", "continuation"]
        : ["media-processing", "global-recovery", "continuation"];

      await tasks.trigger("media-processing", payload, {
        queue: "media-processing",
        concurrencyKey,
        tags
      });
    }

    return {
      ok: true,
      processed: result.processed,
      failed: result.failed,
      claimed: result.claimed,
      remaining,
      continued: remaining > 0
    };
  }
});
