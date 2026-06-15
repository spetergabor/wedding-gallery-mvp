# Wedding Gallery MVP

Online gallery MVP for wedding photographers.

## Stack

- Next.js 15 App Router
- React
- TypeScript
- Tailwind CSS
- Prisma ORM
- PostgreSQL

## Setup

```bash
npm install
cp .env.example .env
docker compose up -d
npm run prisma:migrate
npm run dev
```

Open `http://localhost:3000` or the port printed by Next.js.

On first launch, create the first admin user at:

```text
/admin/register
```

After an admin exists, registration is locked and admins sign in at:

```text
/admin/login
```

## Scope

This first version only covers gallery management and public gallery viewing. Stripe, webshop flows, ordering, Cloudflare R2, multi-admin, and customer registration are intentionally not included.
