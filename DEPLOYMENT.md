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
STORAGE_DRIVER="local"
R2_BUCKET_NAME="wedding-gallery"
NEXT_PUBLIC_R2_PUBLIC_BASE_URL="https://cdn.hochzeitsfotografgraz.at"
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

The current MVP stores uploaded images in `public/uploads` on the local filesystem, while the database is already prepared with `Photo.r2Key`, `Photo.imageUrl`, and `Photo.thumbnailUrl`.

Keep `STORAGE_DRIVER="local"` until the actual R2 upload adapter is implemented. When R2 is connected, uploaded files should be written to the `wedding-gallery` bucket and served from `https://cdn.hochzeitsfotografgraz.at/{r2Key}`.

The planned production domains are:

- App: `gallery.hochzeitsfotografgraz.at`
- CDN: `cdn.hochzeitsfotografgraz.at`
- R2 bucket: `wedding-gallery`
