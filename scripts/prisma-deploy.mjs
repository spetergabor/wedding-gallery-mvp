import { spawnSync } from "node:child_process";

const failedMigration = "20261126183000_dedupe_irismoment_walk_ins";
const env = {
  ...process.env,
  PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK: "1"
};

// The first production attempt failed while creating the unique index. Prisma
// blocks all following deploys until that attempt is explicitly marked rolled
// back. This recovery is intentionally scoped to that single known migration.
spawnSync("npx", ["prisma", "migrate", "resolve", "--rolled-back", failedMigration], {
  stdio: "inherit",
  env
});

const deploy = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  env
});

process.exit(deploy.status ?? 1);
