import { schedules } from "@trigger.dev/sdk/v3";
import { countPendingMediaProcessingJobs, processMediaProcessingJobs } from "@/lib/media-processing";

function readPositiveInteger(value: string | undefined, fallback: number, minimum: number) {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(parsed) || parsed < minimum) {
    return fallback;
  }

  return parsed;
}

const batchSize = readPositiveInteger(process.env.MEDIA_PROCESSING_SWEEP_BATCH_SIZE, 20, 1);
const maxRounds = readPositiveInteger(process.env.MEDIA_PROCESSING_SWEEP_MAX_ROUNDS, 5, 1);

export const mediaProcessingSweepTask = schedules.task({
  id: "media-processing-sweep",
  description: "Recover gallery media processing jobs that were not claimed or became stale.",
  cron: {
    pattern: "*/15 * * * *",
    environments: ["PRODUCTION"]
  },
  queue: {
    name: "media-processing",
    concurrencyLimit: 2
  },
  machine: "small-1x",
  maxDuration: 3600,
  retry: {
    maxAttempts: 1
  },
  run: async () => {
    const totals = {
      processed: 0,
      failed: 0,
      claimed: 0,
      rounds: 0
    };

    for (let round = 0; round < maxRounds; round += 1) {
      const result = await processMediaProcessingJobs({ limit: batchSize });

      totals.processed += result.processed;
      totals.failed += result.failed;
      totals.claimed += result.claimed;
      totals.rounds += 1;

      if (result.claimed === 0) {
        break;
      }
    }

    return {
      ok: true,
      ...totals,
      remaining: await countPendingMediaProcessingJobs()
    };
  }
});
