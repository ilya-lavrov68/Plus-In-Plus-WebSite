const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);

const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === "next-auth") return () => ({ auth: (callback) => callback });
  if (name.startsWith("@/")) name = path.resolve(__dirname, "..", name.slice(2));
  return originalLoad.call(this, name, parent, isMain);
};

const { proxy, config } = require("../proxy.ts");
const { adminOnly, founderOnly, readAccounts, readSubmittedOrders, staffOnly } = require("../payload/access.ts");

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
    ["/payload", "/admin"],
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

  const api = await proxy({ url: "https://preview.example/api/payload/posts", auth: null });
  assert.equal(api.status, 200);
  assert.equal(api.headers.get("location"), null);
});

test("Payload access gives managers orders but never the customer directory", async () => {
  const request = (role) => ({
    user: role ? { id: "actor", collection: "accounts", role } : null,
    payload: {
      find: async () => {
        throw new Error("manager account access must not query customers");
      },
    },
  });
  assert.equal(await readAccounts({ req: request("MANAGER") }), false);
  assert.equal(await readAccounts({ req: request("ADMIN") }), true);
  assert.equal(await readAccounts({ req: request("FOUNDER") }), true);
  assert.equal(await readAccounts({ req: request("USER") }), false);
  assert.equal(staffOnly({ req: request("MANAGER") }), true);
  assert.equal(adminOnly({ req: request("MANAGER") }), false);
  assert.equal(founderOnly({ req: request("ADMIN") }), false);
  assert.deepEqual(readSubmittedOrders({ req: request("MANAGER") }), { status: { not_equals: "cart" } });
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
