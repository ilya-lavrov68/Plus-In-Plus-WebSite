// Small wrappers around the local Prisma CLI, with offline libSQL/SQLite DDL fallback.
const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.join(__dirname, "..", "..");
const prismaCli = path.join(rootDir, "node_modules", "prisma", "build", "index.js");
const FINISHED_PATTERN = /(?:Your database is now in sync|The database is already in sync)/;

const OFFLINE_SQLITE_DDL = [
  `CREATE TABLE IF NOT EXISTS "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "avatar" TEXT,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email")`,
  `CREATE TABLE IF NOT EXISTS "services" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "shortDesc" TEXT NOT NULL,
    "fullDesc" TEXT NOT NULL,
    "includes" TEXT NOT NULL,
    "shapes" TEXT NOT NULL,
    "resultText" TEXT NOT NULL,
    "coverImage" TEXT NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "basePrice" INTEGER NOT NULL DEFAULT 0,
    "priceType" TEXT NOT NULL DEFAULT 'quote',
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "isOrderable" BOOLEAN NOT NULL DEFAULT false
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "services_slug_key" ON "services"("slug")`,
  `CREATE TABLE IF NOT EXISTS "service_option_groups" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serviceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "service_option_groups_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "service_option_groups_serviceId_idx" ON "service_option_groups"("serviceId")`,
  `CREATE TABLE IF NOT EXISTS "service_options" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "priceDelta" INTEGER NOT NULL DEFAULT 0,
    "priceFactor" REAL NOT NULL DEFAULT 1,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "service_options_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "service_option_groups" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "service_options_groupId_idx" ON "service_options"("groupId")`,
  `CREATE TABLE IF NOT EXISTS "posts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "coverImage" TEXT NOT NULL,
    "images" TEXT,
    "readTime" INTEGER NOT NULL DEFAULT 5,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "sourceUrl" TEXT,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "posts_slug_key" ON "posts"("slug")`,
  `CREATE TABLE IF NOT EXISTS "activity_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "actorId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "activity_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "activity_logs_createdAt_idx" ON "activity_logs"("createdAt")`,
  `CREATE TABLE IF NOT EXISTS "page_views" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "path" TEXT NOT NULL,
    "sessionId" TEXT,
    "visitorId" TEXT,
    "referrer" TEXT,
    "utmSource" TEXT,
    "userAgent" TEXT,
    "device" TEXT,
    "durationMs" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS "page_views_createdAt_idx" ON "page_views"("createdAt")`,
  `CREATE INDEX IF NOT EXISTS "page_views_path_createdAt_idx" ON "page_views"("path", "createdAt")`,
  `CREATE INDEX IF NOT EXISTS "page_views_sessionId_idx" ON "page_views"("sessionId")`,
  `CREATE INDEX IF NOT EXISTS "page_views_visitorId_createdAt_idx" ON "page_views"("visitorId", "createdAt")`,
  `CREATE TABLE IF NOT EXISTS "cart_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "optionsJson" TEXT NOT NULL DEFAULT '[]',
    "optionsHash" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cart_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "cart_items_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "cart_items_userId_serviceId_optionsHash_key" ON "cart_items"("userId", "serviceId", "optionsHash")`,
  `CREATE INDEX IF NOT EXISTS "cart_items_userId_idx" ON "cart_items"("userId")`,
  `CREATE TABLE IF NOT EXISTS "orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'quote_requested',
    "estimatedAmount" INTEGER NOT NULL DEFAULT 0,
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "customerNote" TEXT,
    "managerNote" TEXT,
    "managerId" TEXT,
    "priceAgreedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" DATETIME,
    CONSTRAINT "orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "orders_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "orders_number_key" ON "orders"("number")`,
  `CREATE INDEX IF NOT EXISTS "orders_userId_idx" ON "orders"("userId")`,
  `CREATE INDEX IF NOT EXISTS "orders_status_idx" ON "orders"("status")`,
  `CREATE INDEX IF NOT EXISTS "orders_createdAt_idx" ON "orders"("createdAt")`,
  `CREATE INDEX IF NOT EXISTS "orders_managerId_idx" ON "orders"("managerId")`,
  `CREATE TABLE IF NOT EXISTS "order_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "serviceId" TEXT,
    "title" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "estimatedUnitPrice" INTEGER NOT NULL DEFAULT 0,
    "unitPrice" INTEGER NOT NULL DEFAULT 0,
    "totalPrice" INTEGER NOT NULL DEFAULT 0,
    "optionsSnapshot" TEXT NOT NULL DEFAULT '[]',
    CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "order_items_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services" ("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "order_items_orderId_idx" ON "order_items"("orderId")`,
  `CREATE TABLE IF NOT EXISTS "payments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "paymentUrl" TEXT,
    "rawPayload" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" DATETIME,
    CONSTRAINT "payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "payments_orderId_idx" ON "payments"("orderId")`,
  `CREATE INDEX IF NOT EXISTS "payments_provider_externalId_idx" ON "payments"("provider", "externalId")`,
  `CREATE TABLE IF NOT EXISTS "site_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "site_settings_key_key" ON "site_settings"("key")`,
];

async function applyOfflineSqliteDdl(env) {
  const url = env?.TURSO_DATABASE_URL || `file:${path.join(rootDir, "prisma", "dev.db")}`;
  const authToken = env?.TURSO_AUTH_TOKEN || undefined;
  if (url.startsWith("file:")) {
    const filePath = url.slice("file:".length);
    const dir = path.dirname(path.resolve(rootDir, filePath));
    fs.mkdirSync(dir, { recursive: true });
  }
  const { createClient } = require("@libsql/client");
  const client = createClient({ url, authToken });
  try {
    for (const statement of OFFLINE_SQLITE_DDL) {
      await client.execute(statement);
    }
    return true;
  } finally {
    client.close();
  }
}

function cliAvailable() {
  return fs.existsSync(prismaCli);
}

function pushSchema({ env, useWatchdog = true, extraArgs = [] }) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [prismaCli, "db", "push", "--skip-generate", ...extraArgs], {
      cwd: rootDir,
      env,
      stdio: useWatchdog ? ["ignore", "pipe", "pipe"] : "inherit",
    });

    let finished = false;
    let forcedKill;

    if (useWatchdog) {
      const watch = (stream, target) => {
        let tail = "";
        stream.on("data", (chunk) => {
          target.write(chunk);
          tail += chunk.toString();
          if (tail.length > 4000) tail = tail.slice(-4000);
          if (!finished && FINISHED_PATTERN.test(tail)) {
            finished = true;
            forcedKill = setTimeout(() => child.kill("SIGKILL"), 5000);
            child.kill("SIGTERM");
          }
        });
      };
      watch(child.stdout, process.stdout);
      watch(child.stderr, process.stderr);
    }

    child.on("error", async (error) => {
      clearTimeout(forcedKill);
      try {
        await applyOfflineSqliteDdl(env);
        resolve({ ok: true, finished: true });
      } catch {
        resolve({ ok: false, finished, error });
      }
    });

    child.on("close", async (code, signal) => {
      clearTimeout(forcedKill);
      if (code === 0 || finished) {
        resolve({ ok: true, finished, code, signal });
        return;
      }
      try {
        await applyOfflineSqliteDdl(env);
        resolve({ ok: true, finished: true, code: 0, signal });
      } catch {
        resolve({ ok: false, finished, code, signal });
      }
    });
  });
}

function generateClient({ env }) {
  const result = spawnSync(process.execPath, [prismaCli, "generate", "--no-engine"], {
    cwd: rootDir,
    env,
    stdio: "inherit",
  });
  if (result.status === 0) {
    const generatedClassFile = path.join(rootDir, "lib", "generated", "prisma", "internal", "class.ts");
    if (fs.existsSync(generatedClassFile)) {
      const content = fs.readFileSync(generatedClassFile, "utf8");
      if (content.includes('"copyEngine": false')) {
        fs.writeFileSync(generatedClassFile, content.replace('"copyEngine": false', '"copyEngine": true'));
      }
    }
  }
  return result.status === 0;
}

module.exports = { cliAvailable, generateClient, prismaCli, pushSchema, rootDir };
