# Deployment

This app is a server-rendered Next.js app with Prisma and PostgreSQL. It is not a good fit for GitHub Pages.

Recommended deployment:

- GitHub for source code
- Vercel for the Next.js app
- Neon, Supabase, Railway, or another hosted PostgreSQL database
- Cloudflare R2 later for persistent image uploads

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
EMAIL_FROM="Wedding Gallery <gallery@hochzeitsfotografgraz.at>"
CRON_SECRET="a-long-random-worker-secret"
```

## Vercel setup

1. Import `spetergabor/wedding-gallery-mvp` in Vercel.
2. Add the environment variables above.
3. Deploy.
4. Run production migrations:

```bash
npm run prisma:deploy
```

On Vercel, this is usually run locally or from a one-off CI/job with the production `DATABASE_URL`.

## Background jobs

Long-running work, such as full-gallery ZIP generation, is queued in the database and processed by:

```text
/api/jobs/process
```

In production, call this route with:

```text
Authorization: Bearer CRON_SECRET
```

The gallery download flow also starts processing after the visitor submits their email, but this endpoint is the stable worker hook for retries and future scheduled processing.

## Storage

The planned production domains are:

- App: `gallery.hochzeitsfotografgraz.at`
- CDN: `cdn.hochzeitsfotografgraz.at`
- R2 bucket: `wedding-gallery`
