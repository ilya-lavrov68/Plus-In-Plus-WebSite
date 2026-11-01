const assert = require("node:assert/strict");
const { test, beforeEach } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const bcrypt = require("bcryptjs");
const { createNativeModuleMock } = require("./helpers/native-payload-mock.cjs");

require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);

let admin;
let accounts;
let revoked;
let logs;
const db = {
  user: {
    findUnique: async ({ where }) => structuredClone(accounts.get(where.id) ?? null),
    update: async ({ where, data }) => {
      const row = accounts.get(where.id);
      if (!row) throw new Error("missing account");
      Object.assign(row, structuredClone(data));
      return structuredClone(row);
    },
  },
  authSession: {
    updateMany: async ({ where, data }) => { revoked.push({ where, data }); return { count: 2 }; },
  },
  activityLog: { create: async ({ data }) => { logs.push(structuredClone(data)); return data; } },
  transaction: async (callback) => callback(db),
};
const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === "@/lib/payload-native") return createNativeModuleMock(db);
  if (name === "@/lib/admin-session") return { requireAdmin: async () => admin };
  if (name === "@/lib/action-i18n") return { getActionTranslator: async () => (key) => key };
  if (name === "next/cache") return { revalidatePath: () => {} };
  if (name.startsWith("@/")) name = path.resolve(__dirname, "..", name.slice(2));
  return originalLoad.call(this, name, parent, isMain);
};

const { resetUserPassword } = require("../app/actions/account.ts");
const { protectAccount, protectAccountDeletion, revokeAccountSessions } = require("../payload/hooks.ts");
const { SiteSettings } = require("../payload/collections/system.ts");

beforeEach(() => {
  admin = { id: "admin-1", role: "ADMIN" };
  accounts = new Map([
    ["founder-1", { id: "founder-1", email: "founder@example.test", role: "FOUNDER", isBlocked: false, passwordHash: "old" }],
    ["user-1", { id: "user-1", email: "user@example.test", role: "USER", isBlocked: false, passwordHash: "old" }],
  ]);
  revoked = [];
  logs = [];
});

function req(role = "ADMIN", id = "admin-1") {
  return { user: { id, collection: "accounts", role }, context: {}, payload: {} };
}

test("founder role, block and privilege assignment remain server-runbook only", async () => {
  const originalDoc = accounts.get("founder-1");
  for (const data of [{ role: "ADMIN" }, { isBlocked: true }]) {
    await assert.rejects(protectAccount({ operation: "update", originalDoc, data, req: req("FOUNDER", "founder-1") }), /основателя/);
  }
  await assert.rejects(protectAccount({
    operation: "update", originalDoc: accounts.get("user-1"), data: { role: "FOUNDER" }, req: req(),
  }), /FOUNDER/);
  await assert.rejects(protectAccount({
    operation: "update", originalDoc: { ...accounts.get("user-1"), role: "ADMIN" }, data: { role: "USER" }, req: req("ADMIN", "user-1"),
  }), /собственную staff-роль/);
});

test("admin can assign and remove manager role, but not block or demote itself", async () => {
  const manager = await protectAccount({ operation: "update", originalDoc: accounts.get("user-1"), data: { role: "MANAGER" }, req: req() });
  assert.equal(manager.role, "MANAGER");
  const customer = await protectAccount({ operation: "update", originalDoc: { ...accounts.get("user-1"), role: "MANAGER" }, data: { role: "USER" }, req: req() });
  assert.equal(customer.role, "USER");
  await assert.rejects(protectAccount({ operation: "update", originalDoc: accounts.get("user-1"), data: { isBlocked: true }, req: req("ADMIN", "user-1") }), /собственный аккаунт/);
  const blocked = await protectAccount({ operation: "update", originalDoc: accounts.get("user-1"), data: { isBlocked: true }, req: req() });
  assert.equal(blocked.isBlocked, true);
});

test("security changes revoke Payload auth sessions while profile-only edits do not", async () => {
  const calls = [];
  const request = { payload: { update: async (options) => { calls.push(options); return { docs: [] }; } } };
  for (const [previousDoc, doc] of [
    [{ role: "USER", isBlocked: false, passwordHash: "a" }, { role: "MANAGER", isBlocked: false, passwordHash: "a" }],
    [{ role: "USER", isBlocked: false, passwordHash: "a" }, { role: "USER", isBlocked: true, passwordHash: "a" }],
    [{ role: "USER", isBlocked: false, passwordHash: "a" }, { role: "USER", isBlocked: false, passwordHash: "b" }],
  ]) {
    await revokeAccountSessions({ doc: { id: "user-1", ...doc }, previousDoc, operation: "update", req: request });
  }
  assert.equal(calls.length, 3);
  assert.ok(calls.every((call) => call.collection === "auth-sessions" && call.where.and[0].userId.equals === "user-1"));
  await revokeAccountSessions({ doc: { id: "user-1", role: "USER", isBlocked: false, passwordHash: "a", firstName: "New" }, previousDoc: { role: "USER", isBlocked: false, passwordHash: "a", firstName: "Old" }, operation: "update", req: request });
  assert.equal(calls.length, 3);
});

test("founder account deletion is blocked before any cascade", async () => {
  const request = { payload: { find: async () => ({ docs: [{ role: "FOUNDER" }] }) } };
  await assert.rejects(protectAccountDeletion({ id: "founder-1", req: request }), /нельзя удалить/);
  request.payload.find = async () => ({ docs: [{ role: "USER" }] });
  await protectAccountDeletion({ id: "user-1", req: request });
});

test("site settings remain founder-only and reject unknown keys", () => {
  const key = SiteSettings.fields.find((field) => field.name === "key");
  assert.equal(key.validate("robokassaPassword1"), true);
  assert.match(key.validate("attackerControlledKey"), /Unknown/);
  for (const operation of ["read", "create", "update", "delete"]) {
    assert.equal(SiteSettings.access[operation]({ req: req("ADMIN") }), false);
    assert.equal(SiteSettings.access[operation]({ req: req("MANAGER") }), false);
    assert.equal(SiteSettings.access[operation]({ req: req("FOUNDER") }), true);
  }
  assert.equal(key.access.update(), false, "keys are stable after creation");
});

test("password reset never targets founder, revokes ordinary sessions and returns a one-time secret", async () => {
  admin = null;
  assert.equal((await resetUserPassword("user-1")).ok, false);
  admin = { id: "founder-1", role: "FOUNDER" };
  assert.equal((await resetUserPassword("founder-1")).ok, false, "founder cannot reset even their own password through the panel");
  assert.equal(revoked.length, 0);

  admin = { id: "admin-1", role: "ADMIN" };
  const result = await resetUserPassword("user-1");
  assert.equal(result.ok, true);
  assert.ok(result.temporaryPassword);
  assert.notEqual(result.temporaryPassword, accounts.get("user-1").passwordHash);
  assert.equal(await bcrypt.compare(result.temporaryPassword, accounts.get("user-1").passwordHash), true);
  assert.equal(revoked.length, 1);
  assert.equal(revoked[0].data.revokeReason, "password_reset");
  assert.equal(logs[0].actorId, "admin-1");
  assert.equal(JSON.stringify(logs).includes("user@example.test"), false);
});
