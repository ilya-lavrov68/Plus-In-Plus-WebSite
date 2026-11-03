const assert = require("node:assert/strict");
const { test, beforeEach } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const bcrypt = require("bcryptjs");
const { createTestDatabase } = require("./helpers/test-db.cjs");

require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);

let admin;
let accounts;
let database;
const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === "@/lib/admin-session") return { requireAdmin: async () => admin };
  if (name === "@/lib/action-i18n") return { getActionTranslator: async () => (key) => key };
  if (name === "next/cache") return { revalidatePath: () => {} };
  if (name.startsWith("@/")) name = path.resolve(__dirname, "..", name.slice(2));
  return originalLoad.call(this, name, parent, isMain);
};

const { resetUserPassword } = require("../app/actions/account.ts");
const { protectAccount, protectAccountDeletion, revokeAccountSessions } = require("../payload/hooks.ts");
const { SiteSettings } = require("../payload/collections/system.ts");

const { after, before } = require("node:test");

before(async () => {
  database = createTestDatabase("pip-founder-");
  await database.ready;
});

after(async () => {
  await database?.close();
});

beforeEach(async () => {
  admin = { id: "admin-1", role: "ADMIN" };
  await database.reset();
  await database.insertAccount({ id: "admin-1", email: "admin@example.test", role: "ADMIN", passwordHash: "old" });
  await database.insertAccount({ id: "founder-1", email: "founder@example.test", role: "FOUNDER", passwordHash: "old" });
  await database.insertAccount({ id: "user-1", email: "user@example.test", role: "USER", passwordHash: "old" });
  // Payload hooks still receive plain document objects in this test.
  accounts = new Map([
    ["founder-1", { id: "founder-1", email: "founder@example.test", role: "FOUNDER", isBlocked: false, passwordHash: "old" }],
    ["user-1", { id: "user-1", email: "user@example.test", role: "USER", isBlocked: false, passwordHash: "old" }],
  ]);
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
  assert.equal((await database.one("select password_hash from accounts where id = ?", ["user-1"])).password_hash, "old");

  admin = { id: "admin-1", role: "ADMIN" };
  await database.exec(
    `insert into auth_sessions (id, user_id_id, refresh_hash, device_hash, role, last_used_at, expires_at, created_at, updated_at)
     values ('session-1', 'user-1', 'refresh-hash', 'device-hash', 'USER', ?, ?, ?, ?)`,
    [new Date().toISOString(), new Date(Date.now() + 60_000).toISOString(), new Date().toISOString(), new Date().toISOString()],
  );
  const result = await resetUserPassword("user-1");
  assert.equal(result.ok, true);
  assert.ok(result.temporaryPassword);
  const reset = await database.one("select password_hash from accounts where id = ?", ["user-1"]);
  assert.notEqual(result.temporaryPassword, reset.password_hash);
  assert.equal(await bcrypt.compare(result.temporaryPassword, reset.password_hash), true);
  const session = await database.one("select revoked_at, revoke_reason from auth_sessions where id = 'session-1'");
  assert.ok(session.revoked_at, "ordinary sessions are revoked with the new password");
  assert.equal(session.revoke_reason, "password_reset");
  const log = await database.rows("select * from activity_logs where entity_id = 'user-1'");
  assert.equal(log[0].actor_id_id, "admin-1");
  assert.equal(log[0].action, "password reset");
  assert.equal(JSON.stringify(log).includes("user@example.test"), false);
});
