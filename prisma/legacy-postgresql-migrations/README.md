# Legacy PostgreSQL migrations (not used anymore)

These migration files belong to the **old PostgreSQL** setup. They are kept only as
a historical record for anyone still holding a PostgreSQL dump; they contain
PostgreSQL-specific SQL (`CREATE TYPE … AS ENUM`, quoted `"User"` tables) and must
**never** be applied to the libSQL/SQLite database.

The current setup uses no migration files at all:

```bash
npm run db:push     # creates/updates every table from prisma/schema.prisma
npm run db:check    # verifies that all tables and columns exist
```

The schema itself has no enum and no JSON column (SQLite has neither), and table
names are mapped with `@@map` (`users`, `services`, `posts`, `activity_logs`).

Moving existing data over is a one-off script, not a migration:

```bash
POSTGRES_URL="postgresql://…" TURSO_DATABASE_URL="libsql://…" TURSO_AUTH_TOKEN="…" \
  node scripts/migrate-from-postgres.cjs --replace
```
