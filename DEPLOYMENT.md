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

## Important upload note

The current MVP stores uploaded images in `public/uploads` on the local filesystem. This is fine for local development, but not reliable on serverless hosting such as Vercel. Before real production use, replace local uploads with Cloudflare R2 or another object storage provider.
