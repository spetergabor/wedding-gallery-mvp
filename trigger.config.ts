import { defineConfig } from "@trigger.dev/sdk/v3";
import { prismaExtension } from "@trigger.dev/build/extensions/prisma";

const maxDuration = Number.parseInt(process.env.TRIGGER_MAX_DURATION_SECONDS ?? "7200", 10);

export default defineConfig({
  project: process.env.TRIGGER_PROJECT_REF ?? "proj_ernxqehukwacwhubgqsp",
  dirs: ["./trigger"],
  maxDuration: Number.isFinite(maxDuration) ? maxDuration : 7200,
  machine: "small-1x",
  build: {
    extensions: [
      prismaExtension({
        mode: "legacy",
        schema: "prisma/schema.prisma"
      })
    ]
  },
  retries: {
    default: {
      maxAttempts: 2,
      factor: 2,
      minTimeoutInMs: 30_000,
      maxTimeoutInMs: 300_000,
      randomize: true
    }
  },
  enableConsoleLogging: true
});
