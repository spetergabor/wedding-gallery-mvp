import { spawnSync } from "node:child_process";

if (process.env.VERCEL_ENV !== "production") {
  console.log("Skipping production Prisma migration outside Vercel production.");
  process.exit(0);
}

if (!process.env.DATABASE_URL) {
  console.log("Skipping production Prisma migration because DATABASE_URL is missing.");
  process.exit(0);
}

console.log("Running production Prisma migrations before build...");

const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  env: {
    ...process.env,
    PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK: "1"
  }
});

process.exit(result.status ?? 1);
