const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
let admin = null;
let queries = [];
const findMany = async (query) => { queries.push(query); return []; };
const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === "next-auth") return () => ({ auth: (callback) => callback });
  if (name === "next/navigation") return { redirect: (url) => { throw new Error(`redirect:${url}`); } };
  if (name === "@/lib/admin-session") return { requireAdmin: async () => admin };
  if (name === "@/lib/prisma") return { prisma: {
    user: { findMany, count: async () => 0 }, post: { findMany, findUnique: findMany, count: async () => 0 },
    service: { findMany, findUnique: findMany, count: async () => 0 }, activityLog: { findMany },
  } };
  if (name.startsWith("@/")) name = path.resolve(__dirname, "..", name.slice(2));
  return originalLoad.call(this, name, parent, isMain);
};
const { middleware, config } = require("../middleware.ts");
const data = require("../lib/admin-data.ts");

// The middleware is async: it awaits the NextAuth decision so that it can re-issue "continue"
// with the request headers that carry the per-request CSP nonce.
test("middleware redirects every non-admin or missing session to /", async () => {
  process.env.AUTH_SECRET = "test-secret-with-at-least-32-characters";
  assert.deepEqual(config.matcher, ["/((?!_next|api|uploads|.*\\..*).*)", "/api/:path*", "/admin/:path*"]);
  for (const auth of [null, { user: { id: "test", role: "USER" } }, { user: { role: "ADMIN" } }]) {
    const response = await middleware({ url: "https://preview.example/admin/services/new", auth });
    assert.equal(response.status, 307);
    assert.equal(response.headers.get("location"), "https://preview.example/");
  }

  const allowed = await middleware({
    url: "https://preview.example/admin/dashboard",
    auth: { user: { id: "test", role: "ADMIN" } },
  });
  assert.equal(allowed.status, 200);
  // Guarded pages are documents like any other: they get the same policy and nonce.
  const policy = allowed.headers.get("content-security-policy");
  assert.match(policy, /^default-src 'self'; /);
  assert.match(policy, /script-src 'self' 'nonce-[^']+'/);
  assert.equal(allowed.headers.get("x-content-type-options"), "nosniff");

  const api = await middleware({ url: "https://preview.example/api/health", auth: null });
  assert.equal(api.status, 200);
  assert.equal(api.headers.get("x-content-type-options"), "nosniff");
  assert.match(api.headers.get("content-security-policy"), /^default-src 'self'; /);

  process.env.AUTH_SECRET = "weak";
  const unconfigured = await middleware({
    url: "https://preview.example/admin/dashboard",
    auth: { user: { id: "test", role: "ADMIN" } },
  });
  assert.equal(unconfigured.status, 307);
});

test("protected redirects use the trusted public origin instead of the bind address", async () => {
  process.env.AUTH_SECRET = "test-secret-with-at-least-32-characters";
  const cases = [
    ["/cart", null, "/login"],
    ["/admin/services", { user: { id: "user-1", role: "USER" } }, "/"],
    ["/admin/services", { user: { id: "manager-1", role: "MANAGER" } }, "/manager/orders"],
    ["/admin/settings", { user: { id: "admin-1", role: "ADMIN" } }, "/admin/dashboard"],
    ["/ru/admin/settings", null, "/admin/settings"],
  ];

  for (const [pathname, auth, expectedPath] of cases) {
    const response = await middleware({
      url: `http://0.0.0.0:3444${pathname}`,
      headers: {
        host: "0.0.0.0:3444",
        "x-forwarded-host": "preview.example",
        "x-forwarded-proto": "https",
      },
      nextUrl: { pathname, search: "", host: "0.0.0.0:3444", protocol: "http:" },
      auth,
    });
    assert.equal(response.status, 307);
    assert.equal(response.headers.get("location"), `https://preview.example${expectedPath}`);
  }
});

test("admin data queries have their own guard; layouts alone are not trusted", async () => {
  for (const getter of Object.values(data)) await assert.rejects(getter("id"), /redirect:\//);
  assert.equal(queries.length, 0);
});

test("the users table never selects password hashes and the activity query is bounded", async () => {
  admin = { id: "mock-admin", role: "ADMIN" };
  await data.getAllUsers();
  assert.deepEqual(queries.at(-1).select, { id: true, email: true, firstName: true, lastName: true, role: true, createdAt: true });
  await data.getRecentActivity();
  assert.equal(queries.at(-1).take, 20);
  assert.deepEqual(queries.at(-1).orderBy, [{ createdAt: "desc" }, { id: "desc" }]);
});
