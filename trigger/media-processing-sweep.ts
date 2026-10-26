import { schedules, tasks } from "@trigger.dev/sdk/v3";
import { countPendingMediaProcessingJobs } from "@/lib/media-processing";

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
    const pending = await countPendingMediaProcessingJobs();

    if (pending === 0) {
      return { ok: true, pending, dispatched: false };
    }

    const handle = await tasks.trigger(
      "media-processing",
      {},
      {
        queue: "media-processing",
        concurrencyKey: "global-recovery",
        tags: ["media-processing", "global-recovery", "scheduled"]
      }
    );

    return { ok: true, pending, dispatched: true, runId: handle.id };
  }
});
