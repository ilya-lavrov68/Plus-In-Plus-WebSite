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
const { revokeAllAuthSessions } = require("../lib/auth-sessions.ts");
const { isSecretSiteSettingKey, normalizePublicSiteSettings } = require("../lib/site-settings.ts");
const publicSiteSettingsSource = fs.readFileSync(path.join(__dirname, "..", "lib", "public-site-settings.ts"), "utf8");

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
});

test("role and block changes exist only in the server runbook, never in the panel", () => {
  const root = path.resolve(__dirname, "..");
  const runbook = fs.readFileSync(path.join(root, "scripts", "promote-admin.ts"), "utf8");
  assert.match(runbook, /updateAccount\(account\.id, \{ role \}\)/);
  assert.match(runbook, /revokeAllAuthSessions\(account\.id, "role_changed"\)/);
  assert.match(runbook, /is the FOUNDER/, "demoting the founder is called out explicitly");

  // В админке изменение роли или блокировки недоступно: панель только читает.
  const accountsPage = fs.readFileSync(path.join(root, "app", "(admin)", "admin", "accounts", "page.tsx"), "utf8");
  assert.doesNotMatch(accountsPage, /updateAccount|is_blocked\s*=/);
  // Мутации панели ограничены заказами и каталогом услуг: роли, блокировки и
  // аккаунты из интерфейса не меняются вообще.
  const allowedSurfaces = new Set(["orders", "services"]);
  const actionFiles = fs.readdirSync(path.join(root, "app", "(admin)", "admin"))
    .map((name) => ({ name, file: path.join(root, "app", "(admin)", "admin", name, "actions.ts") }))
    .filter((entry) => fs.existsSync(entry.file));
  for (const entry of actionFiles) {
    assert.ok(allowedSurfaces.has(entry.name), `${entry.name} must not mutate data from the panel`);
    assert.doesNotMatch(
      fs.readFileSync(entry.file, "utf8"),
      /update accounts set|insert into accounts|delete from accounts/i,
      `${entry.name} must never write to accounts`,
    );
  }

  // Единственный SQL-писатель аккаунтов — lib/accounts.ts.
  const writers = [];
  const walk = (relative) => {
    for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
      const next = path.join(relative, entry.name);
      if (entry.isDirectory()) walk(next);
      else if (/\.(ts|tsx)$/.test(entry.name) && !next.endsWith(path.join("lib", "accounts.ts"))) {
        if (/update accounts set/i.test(fs.readFileSync(path.join(root, next), "utf8"))) writers.push(next);
      }
    }
  };
  for (const directory of ["app", "lib"]) walk(directory);
  assert.deepEqual(writers, [], "account writes go through one reviewed module");

  // Скрипты обслуживания меняют роли только через runbook, а чистка — лишь имена.
  const cleanup = fs.readFileSync(path.join(root, "scripts", "cleanup-database.ts"), "utf8");
  assert.doesNotMatch(cleanup, /set\s+role|is_blocked\s*=/);
});

test("a security change revokes every live session of that account", async () => {
  const now = new Date().toISOString();
  await database.exec(
    `insert into auth_sessions (id, user_id_id, refresh_hash, device_hash, role, last_used_at, expires_at, created_at, updated_at)
     values ('role-session', 'user-1', 'refresh-hash-2', 'device-hash-2', 'USER', ?, ?, ?, ?)`,
    [now, new Date(Date.now() + 60_000).toISOString(), now, now],
  );
  await revokeAllAuthSessions("user-1", "role_changed");
  const session = await database.one("select revoked_at, revoke_reason from auth_sessions where id = 'role-session'");
  assert.ok(session.revoked_at);
  assert.equal(session.revoke_reason, "role_changed");

  // Чужие сессии не задеваются.
  await database.exec(
    `insert into auth_sessions (id, user_id_id, refresh_hash, device_hash, role, last_used_at, expires_at, created_at, updated_at)
     values ('other-session', 'admin-1', 'refresh-hash-3', 'device-hash-3', 'ADMIN', ?, ?, ?, ?)`,
    [now, new Date(Date.now() + 60_000).toISOString(), now, now],
  );
  await revokeAllAuthSessions("user-1", "account_security_changed");
  const other = await database.one("select revoked_at from auth_sessions where id = 'other-session'");
  assert.equal(other.revoked_at, null);
});

test("nothing in the application deletes accounts, so the founder row is safe by construction", () => {
  const root = path.resolve(__dirname, "..");
  const offenders = [];
  const walk = (relative) => {
    for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
      const next = path.join(relative, entry.name);
      if (entry.isDirectory()) walk(next);
      else if (/\.(ts|tsx)$/.test(entry.name) && /delete from accounts/i.test(fs.readFileSync(path.join(root, next), "utf8"))) {
        offenders.push(next);
      }
    }
  };
  for (const directory of ["app", "lib"]) walk(directory);
  assert.deepEqual(offenders, [], "account deletion lives in the maintenance scripts only");
  const cleanup = fs.readFileSync(path.join(root, "scripts", "cleanup-database.ts"), "utf8");
  assert.match(cleanup, /role <> 'FOUNDER'/, "the cleanup script never touches the founder");
});

test("site settings keep secrets out of the public projection", () => {
  assert.equal(isSecretSiteSettingKey("robokassaPassword1"), true);
  assert.equal(isSecretSiteSettingKey("studioName"), false);
  const settingsRows = [
    { key: "studioName", value: "Plus In Plus" },
    { key: "robokassaPassword1", value: "server-only-secret" },
    { key: "attackerControlledKey", value: "ignored" },
  ];
  const normalized = normalizePublicSiteSettings(settingsRows);
  assert.equal(normalized.studioName, "Plus In Plus");
  assert.equal(JSON.stringify(normalized).includes("server-only-secret"), false);
  assert.equal(JSON.stringify(normalized).includes("attackerControlledKey"), false);
  assert.equal(publicSiteSettingsSource.includes("robokassaPassword"), false);
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
