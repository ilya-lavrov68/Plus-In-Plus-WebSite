// One-off data migration: the previous PostgreSQL database → the new libSQL/Turso one.
//
//   npm i -D pg                                   # optional, only this script needs it
//   POSTGRES_URL="postgresql://user:pass@host:5432/db" \
//     TURSO_DATABASE_URL="libsql://…turso.io" TURSO_AUTH_TOKEN="…" \
//     node scripts/migrate-from-postgres.cjs --replace
//
// What it does:
//   * reads users / services / posts / activity_logs from PostgreSQL (read-only),
//   * writes them into the configured libSQL database using the value formats
//     Prisma's libSQL adapter uses (ISO-8601 text dates, 0/1 booleans, JSON strings
//     for the list columns),
//   * assigns a URL slug to services that do not have one yet,
//   * keeps primary keys, so nothing has to be re-linked.
//
// Without --replace the script refuses to touch a non-empty target database.
// Run `npm run db:push` first and `npm run db:check` afterwards.
const { loadDatabaseModule } = require("./lib/database-module.cjs");

const TABLES = ["users", "services", "posts", "activity_logs"];
const CHUNK_SIZE = 200;

/** Prisma's libSQL adapter stores DateTime as "2026-01-31T09:15:00.000+00:00". */
function toStoredDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString().replace("Z", "+00:00");
}

function toStoredJsonArray(value) {
  if (Array.isArray(value)) return JSON.stringify(value.filter((item) => typeof item === "string"));
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return JSON.stringify(Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : []);
    } catch {
      return "[]";
    }
  }
  return "[]";
}

const TRANSLITERATION = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i",
  й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t",
  у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "",
  э: "e", ю: "yu", я: "ya",
};

function slugify(value, fallback = "service") {
  const slug = String(value ?? "")
    .toLowerCase()
    .split("")
    .map((char) => TRANSLITERATION[char] ?? char)
    .join("")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)
    .replace(/-+$/g, "");
  return slug || fallback;
}

function loadPostgres() {
  try {
    return require("pg");
  } catch {
    console.error(
      "[migrate] The optional `pg` package is required to read the old database:\n" +
        "[migrate]   npm i -D pg\n" +
        "[migrate] It is intentionally not a runtime dependency of the app anymore.",
    );
    process.exit(1);
  }
}

async function writeInChunks(client, statements) {
  for (let index = 0; index < statements.length; index += CHUNK_SIZE) {
    // batch() is atomic per call and works both for local files and Turso Cloud.
    await client.batch(statements.slice(index, index + CHUNK_SIZE), "write");
  }
}

async function main() {
  const replace = process.argv.includes("--replace");
  const postgresUrl = process.env.POSTGRES_URL?.trim();
  if (!postgresUrl) {
    console.error("[migrate] Set POSTGRES_URL to the old PostgreSQL connection string.");
    process.exit(1);
  }

  const { resolveDatabaseConfig, describeDatabaseUrl } = loadDatabaseModule();
  const config = resolveDatabaseConfig({ allowDevelopmentFallback: false });
  if (!config) {
    console.error("[migrate] Set TURSO_DATABASE_URL (and TURSO_AUTH_TOKEN) to the new libSQL/Turso database.");
    process.exit(1);
  }

  const { Client } = loadPostgres();
  const { createClient } = require("@libsql/client");
  const source = new Client({ connectionString: postgresUrl });
  const target = createClient({ url: config.url, authToken: config.authToken });

  console.log(`[migrate] From: ${describeDatabaseUrl(postgresUrl)}`);
  console.log(`[migrate] To:   ${describeDatabaseUrl(config.url)}`);

  try {
    const counts = [];
    for (const table of TABLES) {
      const result = await target.execute(`select count(*) as total from "${table}"`);
      counts.push(Number(result.rows[0]?.total ?? 0));
    }
    const total = counts.reduce((sum, count) => sum + count, 0);
    if (total > 0 && !replace) {
      console.error(
        `[migrate] The target already contains ${total} row(s). Re-run with --replace to overwrite them.`,
      );
      process.exit(1);
    }

    await source.connect();
    const [users, services, posts, activity] = await Promise.all([
      source.query('select * from "User" order by "createdAt"'),
      source.query('select * from "Service" order by "createdAt"'),
      source.query('select * from "Post" order by "createdAt"'),
      source.query('select * from "ActivityLog" order by "createdAt"'),
    ]);

    const usedSlugs = new Set(services.rows.map((row) => row.slug).filter(Boolean));
    const slugFor = (row) => {
      const base = row.slug || slugify(row.title, "service");
      let candidate = base;
      let index = 2;
      while (usedSlugs.has(candidate)) {
        const suffix = `-${index++}`;
        candidate = `${base.slice(0, 120 - suffix.length)}${suffix}`;
      }
      usedSlugs.add(candidate);
      return candidate;
    };

    const statements = [];
    if (replace) {
      // Children first: activity_logs references users.
      for (const table of ["activity_logs", "posts", "services", "users"]) {
        statements.push({ sql: `delete from "${table}"`, args: [] });
      }
    }

    for (const row of users.rows) {
      const createdAt = toStoredDate(row.createdAt) ?? toStoredDate(new Date());
      statements.push({
        sql: `insert into "users" ("id", "email", "passwordHash", "firstName", "lastName", "avatar", "role", "createdAt", "updatedAt")
              values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          row.id, row.email, row.passwordHash, row.firstName ?? null, row.lastName ?? null,
          row.avatar ?? null, row.role || "USER", createdAt, toStoredDate(row.updatedAt) ?? createdAt,
        ],
      });
    }

    for (const row of services.rows) {
      const createdAt = toStoredDate(row.createdAt) ?? toStoredDate(new Date());
      statements.push({
        sql: `insert into "services" ("id", "title", "slug", "category", "shortDesc", "fullDesc", "includes", "shapes", "resultText", "coverImage", "isPublished", "createdAt", "updatedAt")
              values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          row.id, row.title, slugFor(row), row.category || "small", row.shortDesc, row.fullDesc,
          toStoredJsonArray(row.includes), toStoredJsonArray(row.shapes), row.resultText, row.coverImage,
          row.isPublished ? 1 : 0, createdAt, toStoredDate(row.updatedAt) ?? createdAt,
        ],
      });
    }

    for (const row of posts.rows) {
      const createdAt = toStoredDate(row.createdAt) ?? toStoredDate(new Date());
      statements.push({
        sql: `insert into "posts" ("id", "title", "slug", "excerpt", "content", "coverImage", "readTime", "source", "isPublished", "publishedAt", "createdAt", "updatedAt")
              values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          row.id, row.title, row.slug, row.excerpt, row.content, row.coverImage, Number(row.readTime ?? 5),
          row.source || "manual", row.isPublished ? 1 : 0, toStoredDate(row.publishedAt), createdAt,
          toStoredDate(row.updatedAt) ?? createdAt,
        ],
      });
    }

    for (const row of activity.rows) {
      statements.push({
        sql: `insert into "activity_logs" ("id", "action", "entityType", "entityId", "title", "actorId", "createdAt")
              values (?, ?, ?, ?, ?, ?, ?)`,
        args: [
          row.id, row.action, row.entityType, row.entityId, row.title, row.actorId ?? null,
          toStoredDate(row.createdAt) ?? toStoredDate(new Date()),
        ],
      });
    }

    await writeInChunks(target, statements);

    console.log(
      `[migrate] Done: ${users.rowCount} user(s), ${services.rowCount} service(s), ${posts.rowCount} post(s), ${activity.rowCount} activity log(s).`,
    );
    console.log("[migrate] Uploaded files in public/uploads/ are already compatible — copy them as-is.");
    console.log("[migrate] Verify with `npm run db:check` and `curl http://localhost:3000/api/health`.");
  } catch (error) {
    console.error(`[migrate] Failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await source.end().catch(() => {});
    target.close();
  }
}

main().catch((error) => {
  console.error(`[migrate] Failed: ${error.message}`);
  process.exit(1);
});
