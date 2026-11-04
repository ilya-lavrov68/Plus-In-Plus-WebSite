const assert = require("node:assert/strict");
const { test, beforeEach } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);

let database;
let tableError;
/** Имя таблицы, которую имитируем отсутствующей в свежей базе. */
let missingTable = null;
let addressSequence = 40;
const { after, before } = require("node:test");
const { createTestDatabase } = require("./helpers/test-db.cjs");

const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === "@/lib/database") return { resolveDatabaseConfig: () => ({ remote: false }) };
  if (name === "@/lib/db") {
    const real = originalLoad.call(this, path.resolve(__dirname, "..", "lib", "db.ts"), parent, isMain);
    return {
      ...real,
      rows: async (sql, args) => {
        if (tableError) throw tableError;
        const found = await real.rows(sql, args);
        return missingTable
          ? found.filter((row) => String(row.name ?? row.table_name ?? "") !== missingTable)
          : found;
      },
    };
  }
  if (name.startsWith("@/")) name = path.resolve(__dirname, "..", name.slice(2));
  return originalLoad.call(this, name, parent, isMain);
};

const pageView = require("../app/api/page-view/route.ts");
const health = require("../app/api/health/route.ts");
const consent = require("../lib/analytics-consent.ts");

const ALL_TABLES = [
  "accounts", "pending_logins", "auth_sessions", "mfa_backup_codes", "webauthn_credentials",
  "services", "products", "posts", "media", "orders", "order_services",
  "order_items", "payments", "activity_logs", "page_views", "site_settings",
];

function request(method, body) {
  return new Request("http://localhost/api/page-view", {
    method,
    headers: {
      "Content-Type": "application/json",
      "Origin": "http://localhost",
      "x-real-ip": `203.0.113.${addressSequence++}`,
    },
    body: JSON.stringify(body),
  });
}

before(async () => {
  database = createTestDatabase("pip-analytics-");
  await database.ready;
});

after(async () => {
  await database?.close();
});

beforeEach(async () => {
  tableError = null;
  missingTable = null;
  await database.reset();
});

test("page-view API rejects writes without analytics consent", async () => {
  const post = await pageView.POST(request("POST", { path: "/services" }));
  assert.equal(post.status, 403);
  assert.deepEqual(await database.rows("select id from page_views"), []);
  const patch = await pageView.PATCH(request("PATCH", { id: "view-1", durationMs: 100 }));
  assert.equal(patch.status, 403);
  assert.deepEqual(await database.rows("select id from page_views"), []);
});

test("consented page-view writes retain validation and write the duration once", async () => {
  const post = await pageView.POST(request("POST", {
    path: "/services",
    referral: "https://example.test/",
    analyticsConsent: true,
  }));
  assert.equal(post.status, 201);
  const { id } = await post.json();
  const stored = await database.one("select path, duration_ms from page_views where id = ?", [id]);
  assert.equal(stored.path, "/services");
  assert.equal(stored.duration_ms, null);

  const patch = await pageView.PATCH(request("PATCH", { id, durationMs: 100, analyticsConsent: true }));
  assert.equal(patch.status, 200);
  assert.equal(Number((await database.one("select duration_ms from page_views where id = ?", [id])).duration_ms), 100);

  // Повторный PATCH не перезаписывает измеренное время.
  await pageView.PATCH(request("PATCH", { id, durationMs: 900, analyticsConsent: true }));
  assert.equal(Number((await database.one("select duration_ms from page_views where id = ?", [id])).duration_ms), 100);

  // Служебные разделы не попадают в публичную аналитику.
  const staffArea = await pageView.POST(request("POST", { path: "/admin/orders", analyticsConsent: true }));
  assert.equal(staffArea.status, 400);
});

test("revoking analytics consent clears pseudonymous identifiers", () => {
  const values = new Map([
    [consent.ANALYTICS_VISITOR_KEY, "visitor"],
    [consent.CONSENT_STORAGE_KEY, JSON.stringify({ necessary: true, analytics: true, marketing: false, functional: false })],
  ]);
  const sessionValues = new Map([[consent.ANALYTICS_SESSION_KEY, "session"]]);
  global.window = {
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: (key) => values.delete(key),
    },
    sessionStorage: { removeItem: (key) => sessionValues.delete(key) },
    dispatchEvent: () => true,
  };
  assert.equal(consent.hasAnalyticsConsent(), true);
  consent.writeConsent({ necessary: true, analytics: false, marketing: false, functional: false });
  assert.equal(consent.hasAnalyticsConsent(), false);
  assert.equal(values.has(consent.ANALYTICS_VISITOR_KEY), false);
  assert.equal(sessionValues.has(consent.ANALYTICS_SESSION_KEY), false);
  delete global.window;
});

test("health check requires every table used by the current schema", async () => {
  const ok = await health.GET();
  assert.equal(ok.status, 200);
  const okBody = await ok.json();
  assert.equal(okBody.database.tables, ALL_TABLES.length);
  assert.equal(okBody.database.driver, "libsql");

  missingTable = "payments";
  const missing = await health.GET();
  assert.equal(missing.status, 503);
  assert.deepEqual((await missing.json()).database.missingTables, ["payments"]);
});

test("health failures use structured redacted logging without connection data", async () => {
  const secretConnection = "libsql://private.example.turso.io?authToken=do-not-log-this";
  tableError = Object.assign(new Error(`driver failed for ${secretConnection}`), { code: "P1001" });
  const errors = [];
  const originalError = console.error;
  console.error = (value) => errors.push(String(value));
  let response;
  let body;
  try {
    response = await health.GET();
    body = JSON.stringify(await response.json());
  } finally {
    console.error = originalError;
  }

  assert.equal(response.status, 503);
  assert.equal(errors.length, 1);
  const event = JSON.parse(errors[0]);
  assert.equal(event.event, "health.check_failed");
  assert.equal(event.level, "error");
  assert.equal(event.code, "P1001");
  assert.equal(JSON.stringify(event).includes(secretConnection), false);
  assert.equal(JSON.stringify(event).includes("driver failed"), false);
  assert.equal(body.includes(secretConnection), false);
  assert.equal(body.includes("do-not-log-this"), false);
});
