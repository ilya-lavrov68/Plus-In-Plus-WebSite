# Plus In Plus — Web Site

Next.js 15 (App Router), React 18, Prisma 6 / PostgreSQL, Tailwind CSS 4 and
**Auth.js v5** (`next-auth@5.0.0-beta.32`). Use Node.js 20.19+ or 22 LTS.

## Getting started

```bash
cp .env.example .env      # PowerShell: Copy-Item .env.example .env
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
# Copy that value into AUTH_SECRET in .env and configure DATABASE_URL.
npm install              # generates the Prisma client, no running DB required
npx prisma migrate deploy # start PostgreSQL first, applies migrations without seed data
npm run dev -- --hostname 0.0.0.0
```

Prisma client output (`lib/generated/prisma/`) is ignored by Git. The postinstall
script generates it without opening a DB connection; `npm run prisma:generate`
can also be run manually. If Prisma's engine download host is unavailable and no
client exists yet, generation fails explicitly rather than leaving a broken build.

Scripts: `npm run dev`, `npm run build`, `npm run start`, `npm run lint`, `npm test`,
`npm run prisma:generate`. `npx tsc --noEmit` checks types.

Public data sections display empty states if PostgreSQL is unavailable. Admin
queries are protected at the data-access layer and report database failures,
rather than presenting them as an empty content database.

## Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
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
- Admin mode **on** requires both a correct password and an existing `ADMIN` in
  PostgreSQL; success redirects to `/admin/dashboard`. An unknown or non-admin
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

Register your **own real account**, then promote it directly in PostgreSQL (or
Prisma Studio). No accounts are created by installation or migrations:

```sql
UPDATE "User" SET "role" = 'ADMIN' WHERE "email" = 'your-real-email@example.com';
```

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
feature reliably. Back up PostgreSQL and the uploads together. Multi-instance
hosting needs a shared persistent filesystem (not an external avatar service).

Static brand assets remain separate in `public/assets/logos/` and
`public/assets/gradients/`. Background gradients come from the supplied PNGs.

## Inspecting the database from VS Code

Every option below uses the same `DATABASE_URL` from `.env`.

**Prisma Studio — built in, no extension required**

```bash
npx prisma studio                                                 # http://localhost:5555
npx prisma studio --hostname 0.0.0.0 --port 5555 --browser none   # remote/preview host
```

It loads `prisma.config.ts`, so it connects through exactly the same driver
adapter and `DATABASE_URL` as the application. Tables: `User`, `Service`, `Post`,
`ActivityLog`; rows can be browsed, filtered and edited.

Studio writes **directly** to PostgreSQL, so it bypasses the app's validation,
rate limits and `ActivityLog`. That is intended for administration, with rules:

- `User.passwordHash` must be a real bcrypt hash (cost 12). Never type one by hand —
  generate it and paste the output:

  ```bash
  node -e "console.log(require('bcryptjs').hashSync('new-passphrase-2026', 12))"
  ```

- `User.avatar` must be `/uploads/avatars/<uuid>.webp`. Any other value (including
  remote URLs) is ignored by the app, which then renders initials instead.
- Promoting an admin through the `User.role` column is the one supported manual
  edit (see above). It applies to the **next** login, never to a live session.
- Manual edits do not appear in the dashboard activity feed, because
  `ActivityLog` only records actions performed through the app.

**VS Code extensions** (declared in `.vscode/extensions.json`)

- **Prisma** (`Prisma.prisma`) — schema language support, formatting and
  highlighting for `prisma/schema.prisma`.
- **SQLTools** (`mtxr.sqltools`) + **PostgreSQL/Cockroach driver**
  (`mtxr.sqltools-driver-pg`) — sidebar explorer and ad-hoc SQL. Run
  *SQLTools: Add New Connection*, choose PostgreSQL and fill in host, port,
  database, user and password from `DATABASE_URL` (for the default example:
  `localhost`, `5432`, `plus_in_plus`, `postgres`). Keep `"askForPassword": true`
  instead of storing the password in `.vscode/settings.json`, and do not commit
  credentials. Studio cannot run raw SQL — use this (or `psql`) for queries.
- Alternatives: *Database Client* (`cweijan.vscode-database-client2`) or
  *PostgreSQL* (`ckolkman.vscode-postgres`). GUI extensions read the **VS Code
  process** environment, not `.env`, so paste values in the connection wizard.

**Terminal / one-off queries**

```bash
psql "$DATABASE_URL" -c 'select email, role, "firstName", "lastName" from "User" order by "createdAt";'
psql "$DATABASE_URL" -c 'select action, "entityType", title, "createdAt" from "ActivityLog" order by "createdAt" desc limit 20;'
```

Prisma models map to quoted, case-sensitive table names (`"User"`, `"ActivityLog"`).
`npx prisma migrate status` shows whether every migration was applied.

## Database migrations

- `20261010000000_init`: original tables.
- `20261010191800_add_user_profile_fields`: nullable profile fields and a safe
  `updatedAt` default/backfill for existing users. No user data is reset.
- `20261010191900_add_activity_log`: transactional action history.

For subsequent development changes use `npx prisma migrate dev --name <change>`;
for deployment use `npx prisma migrate deploy`. No seed script is configured.

## Troubleshooting sign-in

| Symptom | Cause / fix |
| --- | --- |
| `Login is unavailable right now.` / `Registration is unavailable right now.` | `DATABASE_URL` or a ≥32-character `AUTH_SECRET` is missing, so auth fails closed. Copy `.env.example` to `.env` and restart the dev server. |
| Form submits, no session, no error | PostgreSQL is unreachable or migrations were never applied: run `npx prisma migrate deploy`, then check `npx prisma migrate status`. |
| `Admin account not found. Please log in as a regular user.` | Admin mode is on, but that email is not an `ADMIN` row. Promote the account with the SQL in the section above (registration can never create admins). |
| Login works, `/admin/*` still redirects to `/` | The session was created without admin mode. Log out, reopen **Log in**, enable **Admin mode**, and log in again. |
| Avatar not shown after upload | Avatars live in `public/uploads/avatars/` and are served by `/uploads/avatars/<file>`; check the file exists on disk and that the deployment does not wipe that folder between releases. |

## Verification and security

`npm test` covers authorization modes, registration role injection, profile
ownership, session claim forgery, admin guards, CRUD/audit transactions, local
uploads, sanitization and the account UI. Account/role scenarios use **mocked
repositories**, not database users or admin seeds. Upload tests create and remove
only temporary image files. Public-page regression tests are retained.

Login, registration and profile changes are throttled in-process. For multiple
instances, also enforce shared rate limits at your trusted proxy/CDN. Blog HTML is
allowlist-sanitized before saving and before public rendering. Production sends
MIME-sniffing, clickjacking, referrer and permissions-policy headers; HTTPS canonical
URLs additionally enable HSTS.
