const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);

let sessionUser = null;
let accountRow = null;

const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === "next-auth") return () => ({ auth: (callback) => callback });
  if (name === "@/auth") return { auth: async () => (sessionUser ? { user: sessionUser } : null) };
  if (name === "@/lib/db") {
    const real = originalLoad.call(this, path.resolve(__dirname, "..", "lib", "db.ts"), parent, isMain);
    return { ...real, row: async () => accountRow };
  }
  if (name.startsWith("@/")) name = path.resolve(__dirname, "..", name.slice(2));
  return originalLoad.call(this, name, parent, isMain);
};

const { proxy, config } = require("../proxy.ts");
const { requireAdmin, requireFounder, requireStaff } = require("../lib/admin-session.ts");

test("proxy protects Payload admin while allowing every staff role into the shared panel", async () => {
  process.env.AUTH_SECRET = "test-secret-with-at-least-32-characters";
  assert.deepEqual(config.matcher, ["/((?!_next|api|uploads|.*\\..*).*)", "/api/:path*", "/admin/:path*"]);
  for (const auth of [null, { user: { id: "test", role: "USER" } }, { user: { role: "ADMIN" } }]) {
    const response = await proxy({ url: "https://preview.example/admin", auth });
    assert.equal(response.status, 307);
  }
  for (const role of ["MANAGER", "ADMIN", "FOUNDER"]) {
    const response = await proxy({
      url: "https://preview.example/admin",
      auth: { user: { id: "staff", role } },
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-security-policy"), /^default-src 'self'; /);
  }

  const api = await proxy({ url: "https://preview.example/api/health", auth: null });
  assert.equal(api.status, 200);
  assert.equal(api.headers.get("x-content-type-options"), "nosniff");

  process.env.AUTH_SECRET = "weak";
  const unconfigured = await proxy({
    url: "https://preview.example/admin",
    auth: { user: { id: "test", role: "ADMIN" } },
  });
  assert.equal(unconfigured.status, 307);
});

test("legacy staff URLs and locale-prefixed protected routes use trusted public origin", async () => {
  process.env.AUTH_SECRET = "test-secret-with-at-least-32-characters";
  const cases = [
    ["/cart", "/login"],
    ["/admin/dashboard", "/admin"],
    ["/manager/orders", "/admin/orders"],
    ["/manager/users", "/admin/accounts"],
    ["/ru/admin", "/admin"],
  ];
  for (const [pathname, expectedPath] of cases) {
    const response = await proxy({
      url: `http://0.0.0.0:3444${pathname}`,
      headers: {
        host: "0.0.0.0:3444",
        "x-forwarded-host": "preview.example",
        "x-forwarded-proto": "https",
      },
      nextUrl: { pathname, search: "", host: "0.0.0.0:3444", protocol: "http:" },
      auth: null,
    });
    assert.equal(response.status, 307);
    assert.equal(response.headers.get("location"), `https://preview.example${expectedPath}`);
  }

  // REST-поверхности Payload больше нет; публичный API не требует staff-сессии.
  const api = await proxy({ url: "https://preview.example/api/services", auth: null });
  assert.equal(api.status, 200);
  assert.equal(api.headers.get("location"), null);
});

test("staff guards read the role from the database on every request", async () => {
  process.env.AUTH_SECRET = "test-secret-with-at-least-32-characters";
  const as = (role) => {
    sessionUser = { id: "actor", email: "actor@example.test", role };
    accountRow = { id: "actor", email: "actor@example.test", role, is_blocked: 0 };
  };

  as("MANAGER");
  assert.ok(await requireStaff(), "a manager reaches the shared panel");
  assert.equal(await requireAdmin(), null, "a manager never gets admin-only actions");
  assert.equal(await requireFounder(), null);

  as("ADMIN");
  assert.equal((await requireAdmin())?.role, "ADMIN");
  assert.equal(await requireFounder(), null, "only the founder gets founder actions");
  assert.equal((await requireStaff())?.isAdmin, true);

  as("FOUNDER");
  assert.equal((await requireFounder())?.isFounder, true);
  assert.equal((await requireAdmin())?.isFounder, true);

  as("USER");
  assert.equal(await requireStaff(), null);
  assert.equal(await requireAdmin(), null);

  // Понижение роли в базе действует сразу, даже если JWT ещё говорит ADMIN.
  sessionUser = { id: "actor", email: "actor@example.test", role: "ADMIN" };
  accountRow = { id: "actor", email: "actor@example.test", role: "USER", is_blocked: 0 };
  assert.equal(await requireAdmin(), null);
  assert.equal(await requireStaff(), null);

  // Блокировка тоже закрывает доступ без ожидания истечения токена.
  as("ADMIN");
  accountRow = { id: "actor", email: "actor@example.test", role: "ADMIN", is_blocked: 1 };
  assert.equal(await requireAdmin(), null);

  // Без настроенного секрета staff-доступ закрыт полностью.
  process.env.AUTH_SECRET = "weak";
  sessionUser = { id: "actor", email: "actor@example.test", role: "FOUNDER" };
  accountRow = { id: "actor", email: "actor@example.test", role: "FOUNDER", is_blocked: 0 };
  assert.equal(await requireStaff(), null);
  process.env.AUTH_SECRET = "test-secret-with-at-least-32-characters";
});

test("old admin data and page modules are physically absent", () => {
  for (const filename of [
    "lib/admin-data.ts",
    "lib/admin-orders.ts",
    "app/actions/admin.ts",
    "app/(site)/admin/page.tsx",
    "app/(site)/manager/page.tsx",
  ]) {
    assert.equal(fs.existsSync(path.resolve(__dirname, "..", filename)), false, filename);
  }
});
