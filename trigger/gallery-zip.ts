import { task } from "@trigger.dev/sdk/v3";
import { processExternalZipJob } from "@/lib/jobs";

type GalleryZipPayload = {
  galleryId: string;
  packageId: string;
  jobId?: string;
};

const maxDuration = Number.parseInt(process.env.TRIGGER_ZIP_MAX_DURATION_SECONDS ?? "7200", 10);

export const galleryZipTask = task({
  id: "gallery-zip",
  description: "Build one streaming ZIP archive for a gallery and upload it to R2.",
  queue: {
    name: "gallery-zip",
    concurrencyLimit: 1
  },
  machine: "small-1x",
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
