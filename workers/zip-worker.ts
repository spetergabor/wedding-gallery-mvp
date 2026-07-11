import { prisma } from "@/lib/prisma";
import { cleanupStuckGalleryZipWork, processPendingJobs, ZIP_GENERATION_JOB } from "@/lib/jobs";

function readPositiveInteger(value: string | undefined, fallback: number, minimum: number) {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(parsed) || parsed < minimum) {
    return fallback;
  }

  return parsed;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown worker error";
}

const workerName = process.env.ZIP_WORKER_NAME?.trim() || `zip-worker-${process.pid}`;
const pollIntervalMs = readPositiveInteger(process.env.ZIP_WORKER_POLL_INTERVAL_MS, 5000, 500);
const errorBackoffMs = readPositiveInteger(process.env.ZIP_WORKER_ERROR_BACKOFF_MS, 15000, 1000);
const batchSize = readPositiveInteger(process.env.ZIP_WORKER_BATCH_SIZE, 1, 1);
const maintenanceEveryMs = readPositiveInteger(process.env.ZIP_WORKER_MAINTENANCE_INTERVAL_MS, 5 * 60 * 1000, 30_000);
const runOnce = process.argv.includes("--once") || process.env.ZIP_WORKER_ONCE === "1";
const checkOnly = process.argv.includes("--check");

let shouldStop = false;
let lastMaintenanceAt = 0;

process.on("SIGINT", () => {
  shouldStop = true;
  console.log(`[${workerName}] SIGINT received, stopping after the current job.`);
});

process.on("SIGTERM", () => {
  shouldStop = true;
  console.log(`[${workerName}] SIGTERM received, stopping after the current job.`);
});

async function runMaintenanceIfNeeded(force = false) {
  const now = Date.now();

  if (!force && now - lastMaintenanceAt < maintenanceEveryMs) {
    return;
  }

  lastMaintenanceAt = now;
  const maintenance = await cleanupStuckGalleryZipWork();

  if (maintenance.stuckJobs > 0 || maintenance.stuckPackages > 0) {
    console.log(
      `[${workerName}] ZIP maintenance marked ${maintenance.stuckJobs} jobs and ${maintenance.stuckPackages} packages as failed.`
    );
  }
}

async function runWorkerLoop() {
  if (checkOnly) {
    console.log(
      `[${workerName}] ZIP worker check passed. batchSize=${batchSize}, pollIntervalMs=${pollIntervalMs}, maintenanceEveryMs=${maintenanceEveryMs}`
    );
    await prisma.$disconnect();
    return;
  }

  console.log(
    `[${workerName}] Starting Spetly ZIP worker. batchSize=${batchSize}, pollIntervalMs=${pollIntervalMs}, runOnce=${runOnce}`
  );

  while (!shouldStop) {
    try {
      await runMaintenanceIfNeeded(runOnce);

      const startedAt = Date.now();
      const results = await processPendingJobs({ limit: batchSize, type: ZIP_GENERATION_JOB });
      const durationMs = Date.now() - startedAt;

      if (results.processed > 0 || results.failed > 0) {
        console.log(
          `[${workerName}] ZIP batch finished in ${durationMs}ms. processed=${results.processed}, failed=${results.failed}`
        );
      }

      if (runOnce) {
        break;
      }

      if (results.processed === 0 && results.failed === 0) {
        await sleep(pollIntervalMs);
      }
    } catch (error) {
      console.error(`[${workerName}] ZIP worker loop failed: ${errorMessage(error)}`);

      if (runOnce) {
        process.exitCode = 1;
        break;
      }

      await sleep(errorBackoffMs);
    }
  }

  await prisma.$disconnect();
  console.log(`[${workerName}] Stopped.`);
}

runWorkerLoop().catch(async (error) => {
  console.error(`[${workerName}] Fatal ZIP worker error: ${errorMessage(error)}`);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
