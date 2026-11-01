const assert = require("node:assert/strict");
const { test, beforeEach } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);

let staff;
const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === "@/lib/admin-session") return { requireStaff: async () => staff };
  if (name.startsWith("@/")) name = path.resolve(__dirname, "..", name.slice(2));
  return originalLoad.call(this, name, parent, isMain);
};

const { authenticateAuthJsStaff } = require("../payload/auth/authjs-strategy.ts");
const { Accounts } = require("../payload/collections/accounts.ts");
const { Posts } = require("../payload/collections/posts.ts");

beforeEach(() => { staff = null; });

function payloadStub(account) {
  const calls = [];
  return {
    calls,
    find: async (args) => { calls.push(args); return { docs: account ? [account] : [] }; },
  };
}

test("Payload Auth.js strategy returns no user and performs no CMS query for a guest", async () => {
  const result = await authenticateAuthJsStaff({ payload: { find: async () => { throw new Error("guest must not query CMS"); } } });
  assert.equal(result.user, null);
});

test("Payload strategy uses the real account, never provisions a shadow user or exposes secrets", async () => {
  staff = { id: "account-admin", email: "admin@example.test", role: "ADMIN" };
  const payload = payloadStub({
    id: "account-admin", email: "admin@example.test", role: "ADMIN", firstName: "Admin", isBlocked: false,
    passwordHash: "secret-hash", mfaSecret: "secret-mfa", webAuthnRegistrationChallenge: "secret-challenge",
  });
  const result = await authenticateAuthJsStaff({ payload });
  assert.equal(result.user.collection, "accounts");
  assert.equal(result.user.id, "account-admin");
  assert.equal(result.user.role, "ADMIN");
  assert.equal(result.user._strategy, "authjs-staff");
  for (const key of ["passwordHash", "mfaSecret", "webAuthnRegistrationChallenge"]) assert.equal(key in result.user, false);
  assert.equal(payload.calls.length, 1);
  assert.equal(payload.calls[0].collection, "accounts");
  assert.equal(payload.calls[0].where.id.equals, staff.id);
  assert.equal(payload.calls[0].overrideAccess, true);
});

test("Payload strategy reapplies the lower current role and rejects blocked or customer accounts", async () => {
  staff = { id: "account-1", email: "staff@example.test", role: "ADMIN" };
  let result = await authenticateAuthJsStaff({ payload: payloadStub({ id: "account-1", email: "staff@example.test", role: "MANAGER" }) });
  assert.equal(result.user.role, "MANAGER");
  staff = { ...staff, role: "MANAGER" };
  result = await authenticateAuthJsStaff({ payload: payloadStub({ id: "account-1", email: "staff@example.test", role: "ADMIN" }) });
  assert.equal(result.user.role, "MANAGER");
  result = await authenticateAuthJsStaff({ payload: payloadStub({ id: "account-1", email: "staff@example.test", role: "ADMIN", isBlocked: true }) });
  assert.equal(result.user, null);
  staff = { ...staff, role: "ADMIN" };
  result = await authenticateAuthJsStaff({ payload: payloadStub({ id: "account-1", email: "staff@example.test", role: "USER" }) });
  assert.equal(result.user, null);
});

test("Payload collections deny public/password access and keep managers out of content and accounts", () => {
  assert.equal(Accounts.auth.disableLocalStrategy, true);
  assert.equal(Accounts.access.create(), false);
  const guest = { req: { user: null } };
  const manager = { req: { user: { collection: "accounts", role: "MANAGER" } } };
  const admin = { req: { user: { collection: "accounts", role: "ADMIN" } } };
  assert.equal(Accounts.access.read(guest), false);
  assert.equal(Accounts.access.read(manager), false);
  assert.equal(Accounts.access.read(admin), true);
  for (const operation of ["read", "create", "update", "delete"]) {
    assert.equal(Posts.access[operation](guest), false);
    assert.equal(Posts.access[operation](manager), false);
    assert.equal(Posts.access[operation](admin), true);
  }
});
