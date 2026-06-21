import { task } from "@trigger.dev/sdk/v3";
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
const maxRounds = readPositiveInteger(process.env.MEDIA_PROCESSING_MAX_ROUNDS, 200, 1);

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
    const totals = {
      processed: 0,
      failed: 0,
      rounds: 0
    };

    for (let round = 0; round < maxRounds; round += 1) {
      const result = await processMediaProcessingJobs({
        galleryId: payload.galleryId,
        limit: batchSize
      });

      totals.processed += result.processed;
      totals.failed += result.failed;
      totals.rounds += 1;

      if (result.claimed === 0) {
        break;
      }
    }

    return {
      ok: true,
      ...totals,
      remaining: await countPendingMediaProcessingJobs(payload.galleryId)
    };
  }
});
