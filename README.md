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

## Account and authorization

- Header **Log in** opens `components/site/account-modal.tsx`. After login it
  becomes a local avatar or initials, opening the same dialog in profile mode.
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

## Database migrations

- `20261010000000_init`: original tables.
- `20261010191800_add_user_profile_fields`: nullable profile fields and a safe
  `updatedAt` default/backfill for existing users. No user data is reset.
- `20261010191900_add_activity_log`: transactional action history.

For subsequent development changes use `npx prisma migrate dev --name <change>`;
for deployment use `npx prisma migrate deploy`. No seed script is configured.

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
