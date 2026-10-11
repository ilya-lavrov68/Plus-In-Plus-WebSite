# Plus In Plus — Web Site

Next.js 15 (App Router), React 18, Prisma 6 / **Turso (libSQL/SQLite)**, Tailwind
CSS 4 and **Auth.js v5** (`next-auth@5.0.0-beta.32`). Use Node.js 20.19+ or 22 LTS.

## Getting started

```bash
cp .env.example .env      # PowerShell: Copy-Item .env.example .env
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
# Copy that value into AUTH_SECRET. TURSO_DATABASE_URL may stay empty locally:
# development then uses the SQLite file prisma/dev.db.
npm install              # generates the Prisma client, no database required
npm run db:push          # creates/updates every table (no migration files)
npm run db:check         # verifies that all tables and columns exist
npm run dev              # also syncs the schema automatically, then starts Next
```

There is no database server to install and nothing to configure twice: the same
schema, the same code and the same `npm run db:push` work locally (SQLite file) and
in production (Turso Cloud). Add `-- --hostname 0.0.0.0` to `npm run dev` to expose
the dev server on the network.

Prisma client output (`lib/generated/prisma/`) is ignored by Git. The postinstall
script generates it without opening a DB connection; `npm run prisma:generate`
can also be run manually. If Prisma's engine download host is unavailable and no
client exists yet, generation fails explicitly rather than leaving a broken build.

Scripts: `npm run dev`, `npm run build`, `npm run start`, `npm run lint`, `npm test`,
`npm run db:push`, `npm run db:check`, `npm run db:promote-admin`, `npm run deploy:verify`,
`npm run prisma:generate`. `npx tsc --noEmit` checks types.

Production setup (Turso database, hosting variables, schema push, verification,
backups) is a step-by-step list in **[DEPLOYMENT.md](DEPLOYMENT.md)**, in copy-paste
order. CI (`.github/workflows/ci.yml`) runs lint, types, tests, schema push/check,
build and a production smoke test with no secrets at all.

Public data sections display empty states if the database is unreachable. Admin
queries are protected at the data-access layer and report database failures,
rather than presenting them as an empty content database. `GET /api/health` reports
whether the configured database is reachable and whether every table exists.

## Environment

| Variable | Purpose |
| --- | --- |
| `TURSO_DATABASE_URL` | libSQL URL: `libsql://…turso.io` (production), `file:./prisma/dev.db` (local, also the development default), `http://…` (self-hosted sqld) |
| `TURSO_AUTH_TOKEN` | Turso auth token (remote databases only; create with `turso db tokens create <db>`) |
| `AUTH_SECRET` | Unique signing/encryption secret, at least 32 characters |
| `AUTH_URL` | Optional canonical public URL. Set to the real HTTPS URL in production |
| `NEXT_PUBLIC_SITE_URL` | Optional canonical URL for SEO |

Never commit `.env`. `NEXTAUTH_SECRET` and `NEXTAUTH_URL` remain supported for an
existing v4 deployment, but new setups should use the v5 names above. Existing v4
sessions must log in again after the upgrade. Registration, login and privileged
operations fail closed without a sufficiently long secret.

Auth.js trusts the Next.js reverse proxy's host headers. Configure your proxy to
**overwrite** `Host`, `X-Forwarded-Host`, `X-Forwarded-Proto`, `X-Real-IP` and
`X-Forwarded-For` appropriately; do not pass arbitrary client-supplied forwarding
headers. Client requests always use relative URLs, so local and proxied preview
origins work without browser requests to localhost. Development accepts
`*.e2b.app` and permits an embedded preview; production retains clickjacking headers.

## Header navigation

- **FOR PLAY**, **SHOP**, **ABOUT PIP** and **SOCNET** open their dropdown on
  **hover**, implemented with plain CSS (`group-hover`), not a click-driven menu
  library. The chevron rotates 180° and the panel stays visible for ~200 ms after
  the pointer leaves, which is what allows the cursor to cross the 8 px gap into
  the menu. Keyboard users get the same panel through `group-focus-within`.
  Touch layouts use the burger menu, where every link is listed without dropdowns.
- The dropdowns are server-rendered white cards
  (`bg-white border border-gray-200 shadow-lg rounded-xl p-4 min-w-[200px]`) with
  real targets: SHOP points at the `/shop` sections and SOCNET at the studio's
  social profiles (`SOCIAL_LINKS` at the top of `components/site/header.tsx` —
  replace the placeholder handles with the real ones).

## Account and authorization

- Header **Log in** opens `components/site/account-modal.tsx`. After login it
  becomes a local avatar or initials, opening the same dialog in profile mode.
- A successful regular login or registration closes the dialog and refreshes the
  session (`router.refresh()`), so the header switches to the avatar immediately.
  Admin logins close the dialog and `router.push("/admin/dashboard")`.
- **Log in**: email, password and an **Admin mode** switch, **off by default**.
  Switching tabs or closing the dialog resets the switch. It does not appear on
  Register or in the profile view.
- Admin mode **off** issues a **USER session**, including for accounts whose
  database role is ADMIN. It does not demote or otherwise change the database role.
- Admin mode **on** requires both a correct password and an existing `ADMIN` row in
  the database; success redirects to `/admin/dashboard`. An unknown or non-admin
  account receives `Admin account not found. Please log in as a regular user.`
- **Register** asks for first name, last name, email, password and confirmation.
  It always writes `role: USER`, hashes the password with bcrypt (cost 12), and
  automatically signs in in regular mode. There is no first-user exception, seed,
  preset admin, or role field accepted from the client.
- Passwords require at least 12 characters and at most **72 UTF-8 bytes**, the
  bcrypt input limit. Emails are normalized to lowercase. Names are at most 80
  characters. Name fields remain optional in the database and profile editor.
- **Edit profile** changes only the current session user's first name, last name
  and uploaded avatar. The action ignores client IDs, roles and password hashes.
  Saving refreshes the DB-backed session, header avatar and dialog immediately.
- The session includes `id`, `email`, `firstName`, `lastName`, `avatar`, `role`.
  Client session updates cannot forge those claims. Logout invalidates the Auth.js
  cookie and synchronizes the client session and other open tabs.

### Creating an administrator (manual only)

Register your **own real account**, then promote it directly in the database (or
Prisma Studio). No accounts are created by installation or schema pushes:

```bash
npm run db:promote-admin                             # list accounts (id, email, role)
npm run db:promote-admin -- you@example.com          # → ADMIN
npm run db:promote-admin -- you@example.com --revoke # → USER again
```

The same command with the production variables promotes the account on Turso:

```bash
TURSO_DATABASE_URL="libsql://…" TURSO_AUTH_TOKEN="…" npm run db:promote-admin -- you@example.com
```

Equivalent raw SQL (`turso db shell plus-in-plus "update users set role = 'ADMIN' where email = '…';"`)
works too, but the script checks that the account exists and is idempotent.

Table and column names are exactly the ones in `prisma/schema.prisma`
(`users`, `services`, `posts`, `activity_logs` via `@@map`).

Log out, reopen Log in, enable **Admin mode**, and log in again. A DB promotion
never upgrades an existing regular session automatically. Middleware redirects
unauthenticated and USER sessions from every `/admin/*` route to `/`. Server
pages, data queries and every content action also verify the **current DB role**,
so deleting or demoting an administrator revokes access even with a stale JWT.

## Admin panel

- `/admin/dashboard`: service/post/user counts and the latest 20 real actions.
- `/admin/services`: service list, create/edit forms, publish/draft switch, deletion.
- `/admin/blog`: post list, create/edit forms, publish/draft switch, deletion.
  Published date is preserved when editing an already-published post. Slug
  uniqueness is enforced and both old/new public URLs are revalidated on changes.
- `/admin/users`: email, first name, last name, role, registration date and ID.
  Password hashes are never selected for the table.

`app/actions/auth.ts` exports `registerUser`, `loginUser`, `updateUserProfile`,
`logout`; `services.ts` and `posts.ts` expose create/update/delete actions.
Content mutations and their `ActivityLog` entries are committed in the **same
transaction**. Registrations/profile updates are logged as well; deletion history
is retained. There is no fabricated historical activity. Dashboard timestamps are UTC.

## Local file storage

| Folder | DB path | Input limit |
| --- | --- | --- |
| `public/uploads/avatars/` | `User.avatar`: `/uploads/avatars/<uuid>.webp` | 2 MB |
| `public/uploads/services/` | `Service.coverImage`: `/uploads/services/<uuid>.webp` | 8 MB |
| `public/uploads/blog/` | `Post.coverImage`: `/uploads/blog/<uuid>.webp` | 8 MB |

PNG, JPEG, WebP, GIF and AVIF inputs are checked by extension, MIME, signature and
actual image decoding (max 25 megapixels). Sharp re-encodes them to **static WebP**,
removing metadata and embedded payloads: up to 256×256 for avatars, 2400×2400 for
covers, preserving aspect ratio. Animated inputs use the first frame. SVG, remote
URLs, arbitrary filenames and traversal paths are rejected. No external avatar
service is used, even if a remote avatar URL is manually inserted into the DB.

A failed DB transaction removes its new upload. Replacement/deletion cleans up
old files only after commit, and a cleanup failure does not undo a successful
mutation. UUID filenames avoid collisions and stale-image caching.
`app/uploads/[kind]/[filename]/route.ts` serves images created **after startup**,
including under `next start` where Next's static public-file index would otherwise
miss new uploads. It allows only known folders and generated filenames, refuses
symlinks, and sends image MIME types plus `nosniff`.

Runtime uploads are gitignored. The three upload directories must be **writable
and persistent**. Use a persistent disk/volume for a self-hosted Node deployment;
an ephemeral/read-only serverless filesystem cannot provide this local-storage
feature reliably. Back up the database (`turso db dump`, or the SQLite file) and the
uploads together. Multi-instance
hosting needs a shared persistent filesystem (not an external avatar service).

Static brand assets remain separate in `public/assets/logos/` and
`public/assets/gradients/`. Background gradients come from the supplied PNGs.

## Database

One setup for development and production:

| | Development | Production |
| --- | --- | --- |
| `TURSO_DATABASE_URL` | empty (→ `prisma/dev.db`) or `file:./prisma/dev.db` | `libsql://plus-in-plus-<org>.turso.io` |
| `TURSO_AUTH_TOKEN` | not needed | required |
| Schema | `npm run db:push` | `npm run db:push` |
| Driver | `@prisma/adapter-libsql` | `@prisma/adapter-libsql` |

**Why libSQL/SQLite and not PostgreSQL.** Turso speaks the SQLite wire format, so
the Prisma datasource provider is `sqlite` — a `libsql://` endpoint is *not* a
PostgreSQL server, and pretending otherwise is exactly what produces confusing
"table does not exist" failures. The trade-offs are handled explicitly:

- no `prisma migrate`, no migration files: `prisma db push` is idempotent and works
  on an empty file and on a Turso database alike (`npm run db:push`);
- SQLite has no enum → `User.role` is a `String` constrained by the application
  (`USER` | `ADMIN`), never by a client payload;
- SQLite has no JSON column → `Service.includes` / `Service.shapes` are JSON-encoded
  **strings**, read and written through `lib/db-helpers.ts`
  (`parseJsonArray` / `toJsonArray`, both tolerant of legacy arrays and broken JSON);
- explicit table names through `@@map`: `users`, `services`, `posts`, `activity_logs`.

### Turso Cloud (production)

```bash
curl -sSfL https://get.tur.so/install.sh | bash      # Turso CLI
turso auth signup                                    # or: turso auth login
turso db create plus-in-plus
turso db show plus-in-plus --url                     # → TURSO_DATABASE_URL
turso db tokens create plus-in-plus                  # → TURSO_AUTH_TOKEN
```

Put both values into the hosting panel (Vercel/Netlify/…) together with
`AUTH_SECRET`, then run the schema push against production **once per schema
change**, e.g. from your machine:

```bash
TURSO_DATABASE_URL="libsql://…" TURSO_AUTH_TOKEN="…" npm run db:push
TURSO_DATABASE_URL="libsql://…" TURSO_AUTH_TOKEN="…" npm run db:check
```

`TURSO_DATABASE_URL` is intentionally **required** for the production runtime: with
no database configured, content sections render empty states and sign-in reports
"unavailable" instead of silently using a local file.

**Deployment check:** `curl https://<your-domain>/api/health` answers `200` with
`{"status":"ok","database":{"driver":"libsql","remote":true,"tables":4}}` when the
database is reachable and every table exists, and `503` with the missing table names
otherwise. It never exposes the URL, the token or any row.

### Local development without an account

An empty `TURSO_DATABASE_URL` (or `file:./prisma/dev.db`) uses a plain SQLite file:
`npm run dev` creates it, pushes the schema and starts Next. `prisma/dev.db` and its
`-wal`/`-shm` files are gitignored, so every clone starts clean.

| Command | Purpose |
| --- | --- |
| `npm run db:push` | create/update every table from `prisma/schema.prisma` |
| `npm run db:check` | verify connection + every table/column; exits 1 with the missing names |
| `npm run db:promote-admin` | list accounts / grant or revoke the ADMIN role |
| `npm run db:load-dump` | load a Turso/SQLite dump (e.g. production) into this database |
| `npm run deploy:verify` | check a running deployment: `/api/health` + public pages |
| `npm run dev` | checks the schema, pushes only when needed, then starts Next |
| `npm run db:migrate-from-postgres` | one-off data import from the old PostgreSQL database |

`prisma db push` prints its result after a few hundred milliseconds but keeps its
adapter connection open for about a minute before the CLI exits (Prisma 6.19 +
`@prisma/adapter-libsql`). `scripts/lib/prisma-cli.cjs` therefore stops the CLI as
soon as it reports success and then **verifies the schema structure**; if anything
were still missing, the script falls back to running the CLI normally and waiting.

### Migrating the existing PostgreSQL data (one-off)

```bash
npm i -D pg                                        # only this script needs the driver
POSTGRES_URL="postgresql://user:pass@host:5432/plus_in_plus"   TURSO_DATABASE_URL="libsql://…" TURSO_AUTH_TOKEN="…"   npm run db:migrate-from-postgres -- --replace
```

It copies users, services, posts and activity logs with their ids, converts JSON
columns to JSON strings, converts dates to the format the libSQL adapter expects and
generates a URL slug for services that do not have one. `public/uploads/` files are
already compatible — copy them as they are. The old PostgreSQL migration files are
kept for reference only in `prisma/legacy-postgresql-migrations/` and must not be
applied to the SQLite database.

### Inspecting the database

**Prisma Studio — built in, no extension required**

```bash
npx prisma studio                                                 # http://localhost:5555
npx prisma studio --hostname 0.0.0.0 --port 5555 --browser none   # remote/preview host
```

It loads `prisma.config.ts`, so it connects through exactly the same driver adapter
and `TURSO_DATABASE_URL` as the application. Tables: `users`, `services`, `posts`,
`activity_logs`; rows can be browsed, filtered and edited. Set the environment
variable in the shell (or rely on `.env`) when targeting Turso.

Studio writes **directly** to the database, so it bypasses the app's validation,
rate limits and `ActivityLog`. That is intended for administration, with rules:

- `users.passwordHash` must be a real bcrypt hash (cost 12). Never type one by hand —
  generate it and paste the output:

  ```bash
  node -e "console.log(require('bcryptjs').hashSync('new-passphrase-2026', 12))"
  ```

- `users.avatar` must be `/uploads/avatars/<uuid>.webp`. Any other value (including
  remote URLs) is ignored by the app, which then renders initials instead.
- Promoting an admin through the `users.role` column is the one supported manual
  edit (see above). It applies to the **next** login, never to a live session.
- Manual edits do not appear in the dashboard activity feed, because
  `activity_logs` only records actions performed through the app.

**Turso CLI**

```bash
turso db shell plus-in-plus ".tables"
turso db shell plus-in-plus "select email, role from users order by createdAt;"
turso db shell plus-in-plus "select action, entityType, title, createdAt from activity_logs order by createdAt desc limit 20;"
```

**VS Code extensions** (declared in `.vscode/extensions.json`)

- **Prisma** (`Prisma.prisma`) — schema language support, formatting and
  highlighting for `prisma/schema.prisma`.
- **SQLTools** (`mtxr.sqltools`) + **SQLite driver**
  (`mtxr.sqltools-driver-sqlite`) — sidebar explorer and ad-hoc SQL against the
  local `prisma/dev.db` file. Run *SQLTools: Add New Connection*, choose SQLite and
  select the absolute path of `prisma/dev.db` (GUI extensions read the **VS Code
  process** environment, not `.env`). Studio cannot run raw SQL — use this, the
  Turso CLI, or `turso db shell` for queries.

### Schema changes

Edit `prisma/schema.prisma`, then run `npm run db:push` locally and the same command
with the production `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN`. Finish with
`npm run db:check` and `curl …/api/health`. No seed script is configured —
registration always creates `USER` accounts and admins are promoted manually.

## Troubleshooting sign-in

| Symptom | Cause / fix |
| --- | --- |
| `Login is unavailable right now.` / `Registration is unavailable right now.` | `TURSO_DATABASE_URL` or a ≥32-character `AUTH_SECRET` is missing, so auth fails closed. Copy `.env.example` to `.env` and restart the dev server. |
| Form submits, no session, no error | The database is unreachable or the schema was never pushed: run `npm run db:push` and `npm run db:check`, then `curl <url>/api/health`. |
| `table does not exist` (or an empty site after a deploy) | The schema was imported into a database where `db:push` never ran, or `TURSO_DATABASE_URL` points at a different database. Run `npm run db:push` with the production variables and re-check `/api/health`. |
| A leftover `DATABASE_URL` prints "is not a libSQL/SQLite URL" | The app no longer connects to PostgreSQL: set `TURSO_DATABASE_URL` (or remove `DATABASE_URL` from `.env`). |
| `Admin account not found. Please log in as a regular user.` | Admin mode is on, but that email is not an `ADMIN` row. Promote the account with the SQL in the section above (registration can never create admins). |
| Login works, `/admin/*` still redirects to `/` | The session was created without admin mode. Log out, reopen **Log in**, enable **Admin mode**, and log in again. |
| Avatar not shown after upload | Avatars live in `public/uploads/avatars/` and are served by `/uploads/avatars/<file>`; check the file exists on disk and that the deployment does not wipe that folder between releases. |

## Verification and security

`npm test` covers authorization modes, registration role injection, profile
ownership, session claim forgery, admin guards, CRUD/audit transactions, local
uploads, sanitization, the account UI, the database target resolution, the
JSON-in-TEXT helpers, the zod validation schemas and the assumption that the Prisma
schema stays libSQL/SQLite (provider, `@@map` names, `slug`, JSON columns). Account/role scenarios use **mocked
repositories**, not database users or admin seeds. Upload tests create and remove
only temporary image files. Public-page regression tests are retained.

`.github/workflows/ci.yml` repeats the important checks on every push and pull
request without any secret: lint, `tsc --noEmit`, `npm test`, `npm run db:push` plus
`db:check` against a throwaway SQLite file, `npm run build`, and a smoke test of
`next start` (health endpoint and public pages).

Login, registration and profile changes are throttled in-process. For multiple
instances, also enforce shared rate limits at your trusted proxy/CDN. Blog HTML is
allowlist-sanitized before saving and before public rendering. Production sends
MIME-sniffing, clickjacking, referrer and permissions-policy headers; HTTPS canonical
URLs additionally enable HSTS.
