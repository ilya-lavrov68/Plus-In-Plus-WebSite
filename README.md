# Plus In Plus — Web Site

Design studio website built with Next.js 15 (App Router), Prisma 6, Tailwind CSS 4 and
NextAuth.js.

## Getting started

```bash
cp .env.example .env      # PowerShell: Copy-Item .env.example .env
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
# Copy the generated value into NEXTAUTH_SECRET in .env.
npm install               # also generates the Prisma client (no running DB required)
npx prisma migrate deploy # start PostgreSQL first; creates the empty tables (no seed data)
npm run dev               # http://localhost:3000
```

The Prisma client is generated automatically by the `postinstall` script
(`scripts/prisma-generate.cjs`), so `npm run build` works on a fresh checkout.
Generation does not connect to PostgreSQL and does not require `DATABASE_URL` to
be configured. If generation ever fails in an offline environment, re-run
`npm run prisma:generate` once you are online.

Scripts: `npm run dev`, `npm run build`, `npm run start`, `npm run lint`, `npm test`, `npm run prisma:generate`.

The site renders empty states when the database is unreachable — it never ships
fake/seed data.

## Environment (.env)

| Variable          | Purpose                                    |
| ----------------- | ------------------------------------------ |
| `DATABASE_URL`    | PostgreSQL connection string (Prisma)      |
| `NEXTAUTH_SECRET` | Unique JWT signing secret; generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL`    | Public site URL (HTTPS in production) |

Never commit `.env`. Admin routes fail closed when `NEXTAUTH_SECRET` is unset or shorter than 32 characters.

## Project structure

- `app/` — public pages (`/`, `/shop`, `/blog`), admin panel (`/admin/*`),
  API routes (`/api/auth/[...nextauth]`), server actions (`app/actions/`).
- `components/site/` — public UI (header, auth modal, partners, cards…).
- `components/admin/` — admin panel UI (nav, forms, delete button).
- `components/ui/` — shared UI primitives (dialog, tabs, table…).
- `auth.ts` — NextAuth configuration (Credentials provider, bcrypt, session with
  `id`, `email`, `role`).
- `middleware.ts` — guards `/admin/*` (session + `role === "ADMIN"`).
- `lib/` — data access (`lib/data.ts`), Prisma client (`lib/prisma.ts`),
  upload storage (`lib/uploads.ts`).

## Asset folders (important)

**Static brand assets** — uploaded manually into the repository by the customer
(never generated, never uploaded through the admin panel):

- `public/assets/logos/` — `plus-in-plus.svg`, `pip-ts-connect.svg`
- `public/assets/gradients/` — `hero-gradient.png`, `category-bg.png`

**Dynamic uploads** — written only by the admin panel:

- `public/uploads/services/` — service covers (`Service.coverImage` stores `/uploads/services/…`)
- `public/uploads/blog/` — blog covers (`Post.coverImage` stores `/uploads/blog/…`)

Static assets (`/public/assets/`) and dynamic uploads (`/public/uploads/`) are never
mixed. Background gradients come from the PNG files — CSS gradients are not used.

## Auth & admin panel

- **Log in / Register** — modal in the header (`components/site/auth-modal.tsx`).
  Register creates a `USER` (bcrypt-hashed password) and logs in automatically.
  On login, `ADMIN` is redirected to `/admin/dashboard`, `USER` stays on the page.
- **Admin panel** (`/admin/*`) — Dashboard, Services, Blog, Users. Services and
  blog posts support full CRUD with cover uploads (stored in `/public/uploads/…`).

### Creating the first admin

Register through the site, then promote the account in the database (no seed data
is shipped):

```sql
UPDATE "User" SET role = 'ADMIN' WHERE email = 'you@example.com';
```

Sign out and log in again after promotion so NextAuth issues a fresh JWT with the
new role. The server also checks the account's **current** database role on every
admin page render and privileged server action, so demoting or deleting an admin
immediately revokes access.

### Security notes

- Login attempts and registrations are throttled in-process. The limiter uses
  `x-real-ip` / `x-forwarded-for`; configure the trusted reverse proxy to set
  these headers rather than trusting client-supplied values. For multiple app
  instances, also enforce shared rate limits at a CDN/WAF.
- Blog HTML is allowlist-sanitized before saving and again before rendering;
  scripts, embeds, event attributes, and unsafe URL schemes are removed.
- The app sends clickjacking, MIME-sniffing, referrer, and permissions-policy
  headers. HSTS is enabled only for production deployments configured with an
  HTTPS `NEXTAUTH_URL` or `NEXT_PUBLIC_SITE_URL`.
