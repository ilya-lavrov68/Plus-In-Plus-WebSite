const assert = require("node:assert/strict");
const { test, beforeEach } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);

let creates;
let updates;
let tableRows;
let addressSequence = 40;
const prisma = {
  pageView: {
    create: async ({ data }) => { creates.push(structuredClone(data)); return { id: "view-1" }; },
    updateMany: async ({ where, data }) => { updates.push({ where: structuredClone(where), data: structuredClone(data) }); return { count: 1 }; },
  },
  $queryRaw: async () => structuredClone(tableRows),
};
const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === "@/lib/prisma") return { prisma };
  if (name === "@/lib/database") return { resolveDatabaseConfig: () => ({ remote: true }) };
  if (name.startsWith("@/")) name = path.resolve(__dirname, "..", name.slice(2));
  return originalLoad.call(this, name, parent, isMain);
};

const pageView = require("../app/api/page-view/route.ts");
const health = require("../app/api/health/route.ts");
const consent = require("../lib/analytics-consent.ts");

const ALL_TABLES = [
  "users", "services", "products", "service_option_groups", "service_options",
  "posts", "activity_logs", "page_views", "orders", "order_services",
  "order_items", "payments", "site_settings",
];

function request(method, body) {
  return new Request("http://localhost/api/page-view", {
    method,
    headers: { "Content-Type": "application/json", "x-real-ip": `203.0.113.${addressSequence++}` },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  creates = [];
  updates = [];
  tableRows = ALL_TABLES.map((name) => ({ name }));
});

test("page-view API rejects writes without analytics consent", async () => {
  const post = await pageView.POST(request("POST", { path: "/services" }));
  assert.equal(post.status, 403);
  assert.equal(creates.length, 0);
  const patch = await pageView.PATCH(request("PATCH", { id: "view-1", durationMs: 100 }));
  assert.equal(patch.status, 403);
  assert.equal(updates.length, 0);
});

test("consented page-view writes retain validation and duration updates", async () => {
  const post = await pageView.POST(request("POST", { path: "/services", analyticsConsent: true }));
  assert.equal(post.status, 201);
  assert.equal(creates.length, 1);
  const patch = await pageView.PATCH(request("PATCH", { id: "view-1", durationMs: 100, analyticsConsent: true }));
  assert.equal(patch.status, 200);
  assert.equal(updates.length, 1);
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
  assert.equal((await ok.json()).database.tables, ALL_TABLES.length);
  tableRows = ALL_TABLES.filter((name) => name !== "payments").map((name) => ({ name }));
  const missing = await health.GET();
  assert.equal(missing.status, 503);
  assert.deepEqual((await missing.json()).database.missingTables, ["payments"]);
});
