import { task } from "@trigger.dev/sdk/v3";
import { processExternalZipJob } from "@/lib/jobs";

type GalleryZipPayload = {
  galleryId: string;
  packageId: string;
  jobId?: string;
};

const maxDuration = Number.parseInt(process.env.TRIGGER_ZIP_MAX_DURATION_SECONDS ?? "7200", 10);
const concurrencyLimit = Number.parseInt(process.env.TRIGGER_ZIP_CONCURRENCY ?? "4", 10);
const machinePresets = ["micro", "small-1x", "small-2x", "medium-1x", "medium-2x", "large-1x", "large-2x"] as const;
const machine = machinePresets.find((preset) => preset === process.env.TRIGGER_ZIP_MACHINE) ?? "small-2x";

export const galleryZipTask = task({
  id: "gallery-zip",
  description: "Build one streaming ZIP archive part for a gallery and upload it to R2.",
  queue: {
    name: "gallery-zip",
    concurrencyLimit: Number.isFinite(concurrencyLimit) ? concurrencyLimit : 4
  },
  machine,
  maxDuration: Number.isFinite(maxDuration) ? maxDuration : 7200,
  retry: {
    maxAttempts: 2,
    factor: 2,
    minTimeoutInMs: 60_000,
    maxTimeoutInMs: 300_000,
    randomize: true
  },
  run: async (payload: GalleryZipPayload) => {
    await processExternalZipJob(payload);

    return {
      ok: true,
      packageId: payload.packageId
    };
  }
});
