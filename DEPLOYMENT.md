# Deployment

Everything needed to run this site on real infrastructure, in copy-paste order.
Nothing here has to be stored in Git: **secrets live in the hosting panel and in
your shell**, never in the repository.

| Step | What | Secrets involved |
| --- | --- | --- |
| [1](#1-create-the-turso-database-production) | Create the Turso database | no (Turso login) |
| [2](#2-set-up-the-production-environment-variables) | Set the hosting environment variables | yes — hosting panel |
| [3](#3-apply-the-schema-to-production) | Apply the schema to production | yes — your shell |
| [4](#4-verify-the-deployment) | Verify the deployment | no |
| [5](#5-create-the-administrator) | Promote your account to ADMIN | no |
| [6](#6-optional-local-development-on-production-data) | Optional: pull production data locally | no |
| [7](#7-backups) | Backups | no |
| [8](#8-later-schema-changes) | Later schema changes | yes — your shell |
| [9](#9-optional-apply-the-schema-from-github-actions) | Optional: schema push from CI | GitHub Secrets |
| [10](#10-migrating-existing-postgresql-data-when-needed) | Migrate old PostgreSQL data (when needed) | yes |

The runtime is stateless apart from `public/uploads/` (see
[Local file storage](README.md#local-file-storage) in the README): the database is
Turso, so no database server, no VPC and no connection pooler is required.

## 1. Create the Turso database (production)

```bash
curl -sSfL https://get.tur.so/install.sh | bash
turso auth signup                                    # or: turso auth login
turso db create plus-in-plus
turso db show plus-in-plus --url                     # → TURSO_DATABASE_URL
turso db tokens create plus-in-plus                  # → TURSO_AUTH_TOKEN
```

Write both values down; the URL of a new database looks like
`libsql://plus-in-plus-<your-org>.turso.io`.

Windows: run these in WSL or Git Bash (the installer is a bash script).

Optional hardening, if you want the production token to expire and be rotated:

```bash
turso db tokens create plus-in-plus --expiration 90d
turso db tokens invalidate plus-in-plus -y           # revokes every existing token
```

## 2. Set up the production environment variables

| Variable | Required | Value |
| --- | --- | --- |
| `TURSO_DATABASE_URL` | yes | `libsql://plus-in-plus-<org>.turso.io` |
| `TURSO_AUTH_TOKEN` | yes | token from step 1 |
| `AUTH_SECRET` | yes | ≥32 characters, unique per environment (see below) |
| `AUTH_URL` | yes in production | the real HTTPS URL, e.g. `https://plusinplus.example` |
| `NEXT_PUBLIC_SITE_URL` | recommended | same URL, used by SEO metadata and `sitemap.xml` |

Generate the secret (do not reuse the local one):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Vercel dashboard:** Project → *Settings* → *Environment Variables* → add the five
names above for *Production* (and *Preview*, if previews should have working
sign-in). **Vercel CLI:**

```bash
npx vercel env add TURSO_DATABASE_URL production
npx vercel env add TURSO_AUTH_TOKEN production
npx vercel env add AUTH_SECRET production
npx vercel env add AUTH_URL production
npx vercel env add NEXT_PUBLIC_SITE_URL production
```

Other hosts (Netlify, Fly.io, VPS, Docker): set the same five variables in the
service's secret/environment settings. The build command stays the default
`npm run build`; `postinstall` generates the Prisma client, which needs no database
access. **Deployment never touches the schema** — that is step 3, on purpose.

No `DATABASE_URL` is used anymore. If a leftover PostgreSQL `DATABASE_URL` exists in
the environment, the app logs that it is ignored instead of connecting somewhere
unexpected.

## 3. Apply the schema to production

Run once per schema change, from a checkout of this repository. bash / Git Bash /
WSL / macOS / Linux:

```bash
TURSO_DATABASE_URL="libsql://plus-in-plus-<org>.turso.io" \
TURSO_AUTH_TOKEN="<token>" \
npm run db:push
```

Windows PowerShell:

```powershell
$env:TURSO_DATABASE_URL="libsql://plus-in-plus-<org>.turso.io"
$env:TURSO_AUTH_TOKEN="<token>"
npm run db:push
```

`prisma db push` is idempotent: it creates missing tables/columns and never drops
data. Confirm the result:

```bash
TURSO_DATABASE_URL="libsql://…" TURSO_AUTH_TOKEN="…" npm run db:check
```

## 4. Verify the deployment

From any machine with the repository checked out:

```bash
npm run deploy:verify -- https://your-domain.example
```

Expected output:

```text
[verify] /api/health → 200 {"status":"ok","database":{"driver":"libsql","remote":true,"tables":4}}
[verify] /            → 200
[verify] /shop        → 200
[verify] /blog        → 200
[verify] /sitemap.xml → 200
[verify] All checks passed.
```

Without a checkout, `curl https://your-domain.example/api/health` is enough. A
`503` with `"status":"schema-out-of-date"` and `missingTables` means step 3 was not
run against that database; `"status":"unavailable"` means the URL/token are wrong.

Manual checks after the first deployment:

1. **Register** an account in the header dialog — you land back on the site, signed in.
2. **Log in** with a wrong password — you get `Invalid email or password.`
3. Try `/admin/dashboard` while signed out — you are redirected to `/`.
4. Upload a service cover in `/admin/services/new` (after step 5).

## 5. Create the administrator

Registration always creates a `USER`; administrators are promoted explicitly.

```bash
# 1. register your real account in the site, then:
TURSO_DATABASE_URL="libsql://…" TURSO_AUTH_TOKEN="…" npm run db:promote-admin            # list accounts
TURSO_DATABASE_URL="libsql://…" TURSO_AUTH_TOKEN="…" npm run db:promote-admin -- you@example.com
```

Then log out, open **Log in**, switch **Admin mode** on and log in again — an
existing session is never upgraded automatically. The equivalent raw SQL is
`turso db shell plus-in-plus "update users set role = 'ADMIN' where email = '…';"`.

## 6. Optional: local development on production data

Work against a copy of the real content without touching production:

```bash
turso db shell plus-in-plus .dump > dump.sql      # production dump
npm run db:load-dump -- dump.sql --replace        # into the local prisma/dev.db
npm run db:check
npm run dev
```

`db:load-dump` refuses to overwrite a non-empty database without `--replace`, and
refuses a **remote** target without `--yes-remote`. A dump contains real user rows:
`dump.sql`, `backup-*.sql` and `*.dump` at the repository root are gitignored, and
temporary dumps should be deleted when you are done with them.

Alternatively use a Turso branch: `turso db create plus-in-plus-dev --from-db plus-in-plus`
and point your local `TURSO_DATABASE_URL` at it with a token from
`turso db tokens create plus-in-plus-dev`.

## 7. Backups

```bash
turso db shell plus-in-plus .dump > backup-$(date +%F).sql
```

Restore into a fresh database by creating it and loading the dump:

```bash
turso db create plus-in-plus-restore
turso db shell plus-in-plus-restore < backup-2026-10-11.sql
```

Turso also supports point-in-time restore within the plan's retention window
(`turso db create new-db --from-db plus-in-plus --timestamp 2026-10-11T10:00:00Z`).
Back up `public/uploads/` together with the database — images live on disk, not in
SQLite. Runtime uploads are gitignored and are **not** part of a deployment build,
so they need their own copy (rsync, object storage, snapshot).

## 8. Later schema changes

1. Edit `prisma/schema.prisma`.
2. Locally: `npm run db:push && npm run db:check && npm test`.
3. Commit, deploy, then repeat [step 3](#3-apply-the-schema-to-production) against
   production and [step 4](#4-verify-the-deployment).

There are no migration files by design (the old PostgreSQL ones are archived in
`prisma/legacy-postgresql-migrations/`). `db push` on SQLite may recreate a table to
change a column; make a backup (step 7) before a destructive change.

## 9. Optional: apply the schema from GitHub Actions

Add the two values as **repository secrets** (`Settings → Secrets and variables →
Actions`): `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`. Then this workflow pushes the
schema when you trigger it manually:

```yaml
name: Push schema to production

on:
  workflow_dispatch:

jobs:
  push:
    runs-on: ubuntu-latest
    environment: production
    env:
      TURSO_DATABASE_URL: ${{ secrets.TURSO_DATABASE_URL }}
      TURSO_AUTH_TOKEN: ${{ secrets.TURSO_AUTH_TOKEN }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "22", cache: npm }
      - run: npm ci
      - run: npm run db:push
      - run: npm run db:check
```

The checked-in `.github/workflows/ci.yml` deliberately uses a throwaway SQLite file
and no secrets, so forks and pull requests can run it safely.

## 10. Migrating existing PostgreSQL data (when needed)

```bash
npm i -D pg
POSTGRES_URL="postgresql://user:pass@host:5432/plus_in_plus" \
TURSO_DATABASE_URL="libsql://…" TURSO_AUTH_TOKEN="…" \
npm run db:migrate-from-postgres -- --replace
```

IDs are preserved, `Json` columns become JSON strings, dates use the format the
libSQL adapter expects and services without a slug get one. `public/uploads/` is
already compatible. Afterwards `npm uninstall pg` (the app itself no longer needs
it). Details: [README → Database](README.md#database).

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `/api/health` → `503 schema-out-of-date` with `missingTables` | Step 3 was not run against this database. Run `npm run db:push` with the production variables. |
| `/api/health` → `503 unavailable`, logs mention the token | `TURSO_AUTH_TOKEN` is missing/invalid or the database was deleted. Recreate the token (`turso db tokens create <db>`) and redeploy. |
| Pages render, but sign-in says "unavailable" | `TURSO_DATABASE_URL` or a ≥32-character `AUTH_SECRET` is missing in the hosting panel; both are required at runtime. |
| `table does not exist` in the logs | The deployed code expects a schema the database does not have: run step 3 (and step 4) — the exact missing names are printed. |
| Admin mode returns the generic credential error | Verify the credentials and that the account has an `ADMIN`/`FOUNDER` role (step 5). The response intentionally does not reveal which check failed. |
| A stale `DATABASE_URL` is logged as ignored | Remove it from the hosting panel; only `TURSO_DATABASE_URL` is read. |
| New uploads disappear after a deploy | The host filesystem is ephemeral; mount a persistent disk for `public/uploads/` (see the README). |
| First page load after a deploy is slow | The instance is cold-starting; the free Turso tier plus a small instance is enough for this site. |

## Security checklist

- `AUTH_SECRET` is unique per environment, ≥32 characters, and never committed;
  `AUTH_SECRET` set incorrectly makes auth fail closed (no sessions issued).
- `.env*` files, the local `prisma/dev.db`, `dump.sql` backups and
  `lib/generated/` are gitignored — verify with `git status` before committing.
- Rotate a leaked token immediately: `turso db tokens invalidate <db> -y`, create a
  new one and update the hosting panel.
- `/api/health` reports booleans only (reachability, driver, `remote`) — no URL,
  token, table contents or user data. It is safe to expose publicly.
- Production sends `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`,
  `Permissions-Policy` and `X-XSS-Protection: 0`. HSTS uses
  `max-age=31536000; includeSubDomains`; before exposing the site, verify HTTPS on every
  subdomain and configure the proxy to redirect HTTP to HTTPS. No HSTS preload submission
  is implied. Run external Security Headers and SSL Labs checks on the real endpoint.
- `Content-Security-Policy` is built per request in `middleware.ts` with a fresh nonce
  (Next.js copies it onto its inline scripts). Production: `frame-ancestors 'none'`,
  no `unsafe-inline`/`unsafe-eval` for scripts. If a future integration needs an external
  script, add its origin to `lib/security-headers.ts` — do not weaken the policy ad hoc.
  `PIP_CSP=report-only` observes violations without blocking. `PIP_CSP=off` is honored only
  in local development; production ignores that value and keeps enforcing CSP.
- `npm run doctor` checks the install, the Prisma client, the database target, `AUTH_SECRET`
  and `engines.node`; it never prints secret values.
- Public write endpoints (`/api/support`, `/api/page-view`), authentication, password/profile
  changes, and staff uploads/imports use fixed-window rate limits. Configure both
  `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` for atomic shared limits across
  serverless instances. Without them a bounded process-local fallback remains; a CDN/WAF is
  still recommended as the first line of defence. Shared-backend outages fall back locally
  without logging credentials. The admin import preview only fetches public http(s) pages
  (`lib/ssrf-guard.ts`): loopback, private, link-local and cloud-metadata addresses are refused.
- Registration and password changes use HIBP k-anonymity by default. Production rejects the
  new password safely if the service is unavailable (`PIP_HIBP_REQUIRED=1`, also the production
  default); test provider connectivity before launch. `PIP_HIBP_REQUIRED=0` is an explicit
  availability exception, not a recommendation. Existing logins do not call HIBP.
- Complete the operational assessment and launch gaps in [`docs/security/README.md`](docs/security/README.md),
  including staff MFA, session architecture, centralized alerting and an isolated restore drill.
