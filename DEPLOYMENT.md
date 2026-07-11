# Deployment

This app is a server-rendered Next.js app with Prisma and PostgreSQL. It is not a good fit for GitHub Pages.

Recommended deployment:

- GitHub for source code
- Vercel for the Next.js app
- Neon, Supabase, Railway, or another hosted PostgreSQL database
- Cloudflare R2 for persistent image and video uploads

## Required environment variables

Set these in the hosting provider:

```text
DATABASE_URL="postgresql://..."
AUTH_SECRET="a-long-random-production-secret"
STORAGE_DRIVER="r2"
R2_BUCKET_NAME="wedding-gallery"
NEXT_PUBLIC_R2_PUBLIC_BASE_URL="https://cdn.hochzeitsfotografgraz.at"
NEXT_PUBLIC_APP_URL="https://gallery.hochzeitsfotografgraz.at"
RESEND_API_KEY="re_..."
ADMIN_NOTIFICATION_EMAIL="you@example.com"
EMAIL_FROM="Spetly <gallery@hochzeitsfotografgraz.at>"
CRON_SECRET="a-long-random-worker-secret"
MEDIA_PROCESSING_SECRET="a-long-random-media-worker-secret"
ZIP_WORKER_DRIVER="vercel"
R2_MULTIPART_UPLOAD_PART_SIZE_MB="64"
R2_OBJECT_READ_CHUNK_SIZE_MB="16"
```

## Vercel setup

1. Import `spetergabor/spetly` in Vercel.
2. Add the environment variables above.
3. Deploy.
4. Run production migrations:

```bash
npm run prisma:deploy
```

On Vercel, this is usually run locally or from a one-off CI/job with the production `DATABASE_URL`.

## Background jobs

Background work is queued in the database. Small or fallback jobs can still be processed by:

```text
/api/jobs/process
```

In production, call this route with:

```text
Authorization: Bearer CRON_SECRET
```

The gallery download flow also starts processing after the visitor submits their email.

The same route also runs ZIP maintenance. It marks stuck ZIP work as failed so the photographer can restart or regenerate
the package. Completed ZIP packages are retained for as long as the gallery exists. They are removed from R2 only when the
photographer deletes the gallery.

```text
ZIP_STUCK_PROCESSING_HOURS="3"
```

For large full-gallery ZIP files, use the Trigger.dev worker instead of Vercel functions:

```text
ZIP_WORKER_DRIVER="trigger"
MEDIA_WORKER_DRIVER="trigger"
TRIGGER_PROJECT_REF="proj_..."
TRIGGER_SECRET_KEY="tr_..."
TRIGGER_MAX_DURATION_SECONDS="7200"
TRIGGER_ZIP_MAX_DURATION_SECONDS="7200"
TRIGGER_MEDIA_MAX_DURATION_SECONDS="7200"
ZIP_TRIGGER_DISPATCH_CONCURRENCY="8"
MEDIA_PROCESSING_BATCH_SIZE="20"
MEDIA_PROCESSING_MAX_ROUNDS="200"
```

Deploy the Trigger task after setting the same production `DATABASE_URL`, `STORAGE_DRIVER`, `R2_*`, and `NEXT_PUBLIC_R2_PUBLIC_BASE_URL` values in Trigger.dev:

```bash
npx trigger.dev@latest deploy
```

When `ZIP_WORKER_DRIVER` is `trigger`, `/api/jobs/process` skips ZIP processing so Vercel does not accidentally pick up the same long-running job.

### External ZIP worker on Hetzner

For high-volume gallery ZIP generation, run the ZIP worker on a separate VPS/container and let Vercel only queue the jobs.

Set this on Vercel:

```text
ZIP_WORKER_DRIVER="external"
```

With this mode, the app creates `BackgroundJob` rows but does not process ZIPs inside Vercel. `/api/jobs/process` still runs ZIP maintenance,
but skips the heavy ZIP generation.

Recommended Hetzner VPS baseline:

- Ubuntu 24.04 LTS
- CPX21/CX32 or stronger for the first production test
- SSH key login
- Backups optional, because the worker is stateless and stores ZIPs in R2

Bootstrap a fresh server as `root`:

```bash
curl -fsSL https://raw.githubusercontent.com/spetergabor/wedding-gallery-mvp/main/scripts/zip-worker-bootstrap.sh -o /tmp/zip-worker-bootstrap.sh
bash /tmp/zip-worker-bootstrap.sh
```

Copy the example env file and fill it with production values:

```bash
cp .env.zip-worker.example .env.zip-worker
nano .env.zip-worker
```

Build and run the worker with Docker Compose:

```bash
bash scripts/zip-worker-deploy.sh
```

Minimum `.env.zip-worker` values:

```text
DATABASE_URL="postgresql://..."
STORAGE_DRIVER="r2"
R2_BUCKET_NAME="wedding-gallery"
R2_ACCOUNT_ID="..."
R2_ACCESS_KEY_ID="..."
R2_SECRET_ACCESS_KEY="..."
NEXT_PUBLIC_R2_PUBLIC_BASE_URL="https://..."
NEXT_PUBLIC_APP_URL="https://spetly.app"
RESEND_API_KEY="re_..."
EMAIL_FROM="Spetly <...>"
ZIP_WORKER_BATCH_SIZE="1"
ZIP_WORKER_POLL_INTERVAL_MS="5000"
ZIP_WORKER_MAINTENANCE_INTERVAL_MS="300000"
R2_MULTIPART_UPLOAD_PART_SIZE_MB="64"
R2_OBJECT_READ_CHUNK_SIZE_MB="16"
```

Smoke checks:

```bash
docker compose -f docker-compose.zip-worker.yml ps
docker compose -f docker-compose.zip-worker.yml logs -f --tail=100
docker compose -f docker-compose.zip-worker.yml run --rm zip-worker npm run zip-worker -- --check
docker compose -f docker-compose.zip-worker.yml run --rm zip-worker npm run zip-worker -- --once
bash scripts/zip-worker-health.sh
```

Only switch Vercel to `ZIP_WORKER_DRIVER="external"` after the worker is healthy. If no worker is running, ZIP jobs will stay queued.

The compose file uses a two-hour `stop_grace_period` so Docker updates do not kill a long ZIP generation immediately. The worker listens for
`SIGTERM`/`SIGINT` and stops after the current job.

## Media processing queue

Heavy image derivative generation runs in the Trigger.dev `media-processing` task. New uploads create rows in
`MediaProcessingJob`, and the app dispatches a deduplicated Trigger run as photos are saved. The worker reads originals
from R2, writes lightweight thumbnail and preview JPG files back to R2, then marks each photo `ready`.

The legacy HTTP worker API is still available for external workers. A worker can claim jobs from:

```text
POST /api/media-processing/jobs
Authorization: Bearer MEDIA_PROCESSING_SECRET
```

After writing generated thumbnails, previews, or video posters back to R2, the Worker can complete the job with:

```text
POST /api/media-processing/jobs/complete
Authorization: Bearer MEDIA_PROCESSING_SECRET
```

This keeps CPU-heavy processing on Cloudflare/R2 infrastructure instead of Vercel functions.

## Storage

The planned production domains are:

- App: `gallery.hochzeitsfotografgraz.at`
- CDN: `cdn.hochzeitsfotografgraz.at`
- R2 bucket: `wedding-gallery`
