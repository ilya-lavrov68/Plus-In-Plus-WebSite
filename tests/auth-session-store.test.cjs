const assert = require("node:assert/strict");
const { test, beforeEach, after } = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const { randomUUID } = require("node:crypto");

// Отдельный временный файл SQLite: тест проверяет настоящие запросы сессий,
// не подменяя их объектом-двойником.
const databaseFile = path.join(os.tmpdir(), `pip-auth-sessions-${process.pid}-${Date.now()}.db`);
process.env.DATABASE_URL = `file:${databaseFile}`;

require.extensions[".ts"] = (module, filename) => {
  module._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    filename,
  );
};

let cookieValues;
let securityEvents;

const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === "next/headers") {
    return {
      cookies: async () => ({
        get: (key) => (cookieValues.has(key) ? { value: cookieValues.get(key).value } : undefined),
        set: (key, value, options) => cookieValues.set(key, { value, options }),
      }),
    };
  }
  if (name === "@/lib/security-log") {
    return { logSecurityEvent: (event) => securityEvents.push(event) };
  }
  if (name.startsWith("@/")) name = path.resolve(__dirname, "..", name.slice(2));
  return originalLoad.call(this, name, parent, isMain);
};

const db = require("../lib/db.ts");
const sessions = require("../lib/auth-sessions.ts");
const { MAX_CONCURRENT_SESSIONS } = require("../lib/session-policy.ts");

const USER_ID = "user-session-test";
const DEVICE_ID = "d".repeat(32);
const SESSION_ID = "a".repeat(32);
const REFRESH_SECRET = "s".repeat(32);

async function prepareDatabase() {
  await db.run(`create table if not exists accounts (
    id text primary key, email text not null, password_hash text, first_name text, last_name text,
    role text not null default 'USER', is_blocked integer default 0, avatar text, avatar_media_id text,
    created_at text, updated_at text)`);
  await db.run(`create table if not exists auth_sessions (
    id text primary key, user_id_id text not null, refresh_hash text not null, device_hash text not null,
    role text not null default 'USER', last_used_at text not null, expires_at text not null,
    revoked_at text, revoke_reason text, updated_at text, created_at text)`);
  await db.run(
    `insert or replace into accounts (id, email, first_name, last_name, role, is_blocked, created_at, updated_at)
     values (?, ?, ?, ?, ?, 0, ?, ?)`,
    [USER_ID, "session-test@example.invalid", "Test", "Session", "ADMIN", new Date().toISOString(), new Date().toISOString()],
  );
}

async function seedSession(overrides = {}) {
  const now = new Date();
  const record = {
    id: SESSION_ID,
    userId: USER_ID,
    role: "ADMIN",
    refreshHash: sessions.hashRefreshSecret(REFRESH_SECRET),
    deviceHash: sessions.hashDevice(DEVICE_ID),
    lastUsedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 60_000).toISOString(),
    revokedAt: null,
    revokeReason: null,
    ...overrides,
  };
  await db.run(
    `insert or replace into auth_sessions
       (id, user_id_id, refresh_hash, device_hash, role, last_used_at, expires_at, revoked_at, revoke_reason, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [record.id, record.userId, record.refreshHash, record.deviceHash, record.role, record.lastUsedAt,
      record.expiresAt, record.revokedAt, record.revokeReason, now.toISOString(), now.toISOString()],
  );
  return record;
}

async function sessionRow(id) {
  return db.row("select * from auth_sessions where id = ?", [id]);
}

async function setAccountRole(role) {
  await db.run("update accounts set role = ? where id = ?", [role, USER_ID]);
}

beforeEach(async () => {
  cookieValues = new Map();
  securityEvents = [];
  await prepareDatabase();
  await db.run("delete from auth_sessions");
  await setAccountRole("ADMIN");
});

after(async () => {
  await db.closeDb();
  fs.rmSync(databaseFile, { force: true });
});

test("refresh token parser rejects malformed and ambiguous values", () => {
  assert.deepEqual(sessions.parseRefreshToken(`${SESSION_ID}.${REFRESH_SECRET}`), {
    id: SESSION_ID,
    secret: REFRESH_SECRET,
  });
  for (const value of [null, "", SESSION_ID, `${SESSION_ID}.`, `${SESSION_ID}.${REFRESH_SECRET}.extra`, `bad.${REFRESH_SECRET}`]) {
    assert.equal(sessions.parseRefreshToken(value), null);
  }
});

test("creating a session keeps only the newest three active records", async () => {
  const now = Date.now();
  for (const [index, character] of ["a", "b", "c"].entries()) {
    await seedSession({
      id: character.repeat(32),
      refreshHash: sessions.hashRefreshSecret(`${character}${REFRESH_SECRET}`.slice(0, 32)),
      lastUsedAt: new Date(now - (index + 1) * 60_000).toISOString(),
    });
  }

  const created = await sessions.createAuthSession(USER_ID, "USER");
  assert.ok(created.sessionId);

  const active = await db.rows(
    "select id from auth_sessions where user_id_id = ? and revoked_at is null",
    [USER_ID],
  );
  assert.equal(active.length, MAX_CONCURRENT_SESSIONS);
  const oldest = await sessionRow("c".repeat(32));
  assert.equal(oldest.revoke_reason, "session_limit");
  const fresh = await sessionRow(created.sessionId);
  assert.equal(fresh.revoked_at, null);
  assert.equal(cookieValues.get(sessions.refreshCookieName()).options.httpOnly, true);
  assert.equal(cookieValues.get(sessions.deviceCookieName()).options.httpOnly, true);
});

test("successful rotation changes the stored hash and preserves absolute expiry", async () => {
  const existing = await seedSession();
  const rotated = await sessions.rotateAuthSession(`${SESSION_ID}.${REFRESH_SECRET}`, DEVICE_ID);

  assert.equal(rotated.sessionId, SESSION_ID);
  assert.equal(rotated.role, "ADMIN");
  const stored = await sessionRow(SESSION_ID);
  assert.notEqual(stored.refresh_hash, existing.refreshHash);
  assert.equal(stored.expires_at, existing.expiresAt);

  const nextCookie = cookieValues.get(sessions.refreshCookieName()).value;
  assert.notEqual(nextCookie, `${SESSION_ID}.${REFRESH_SECRET}`);
  assert.equal(sessions.parseRefreshToken(nextCookie).id, SESSION_ID);
  assert.equal(sessions.hashRefreshSecret(sessions.parseRefreshToken(nextCookie).secret), stored.refresh_hash);
});

test("a refresh-time demotion persists and later promotion cannot restore staff mode", async () => {
  await seedSession({ role: "ADMIN" });
  await setAccountRole("USER");

  const demoted = await sessions.rotateAuthSession(`${SESSION_ID}.${REFRESH_SECRET}`, DEVICE_ID);
  assert.equal(demoted.role, "USER");
  assert.equal((await sessionRow(SESSION_ID)).role, "USER");

  const refreshedCookie = cookieValues.get(sessions.refreshCookieName()).value;
  await setAccountRole("ADMIN");
  const promotedAgain = await sessions.rotateAuthSession(refreshedCookie, DEVICE_ID);
  assert.equal(promotedAgain.role, "USER", "a later DB promotion still requires a new staff login");
  assert.equal((await sessionRow(SESSION_ID)).role, "USER");
});

test("refresh-token reuse revokes every active session for the account", async () => {
  await seedSession();
  await seedSession({ id: "b".repeat(32), refreshHash: sessions.hashRefreshSecret("t".repeat(32)) });
  await db.run("update auth_sessions set refresh_hash = ? where id = ?", [sessions.hashRefreshSecret("x".repeat(32)), SESSION_ID]);

  const result = await sessions.rotateAuthSession(`${SESSION_ID}.${REFRESH_SECRET}`, DEVICE_ID);
  assert.equal(result, null);

  const revoked = await db.rows(
    "select revoke_reason from auth_sessions where user_id_id = ?",
    [USER_ID],
  );
  assert.equal(revoked.every((row) => row.revoke_reason === "refresh_reuse"), true);
  assert.deepEqual(securityEvents, ["auth.refresh.reuse_detected"]);
});

test("device mismatch fails closed without rotating the refresh secret", async () => {
  const existing = await seedSession();
  const result = await sessions.rotateAuthSession(`${SESSION_ID}.${REFRESH_SECRET}`, "e".repeat(32));

  assert.equal(result, null);
  const stored = await sessionRow(SESSION_ID);
  assert.equal(stored.refresh_hash, existing.refreshHash);
  assert.equal(stored.revoked_at, null);
  assert.deepEqual(securityEvents, ["auth.refresh.device_mismatch"]);
});

test("active-session checks enforce revocation, expiry and device binding", async () => {
  const existing = await seedSession();
  assert.equal(await sessions.authSessionIsActive(SESSION_ID, existing.deviceHash), true);
  assert.equal(await sessions.authSessionIsActive(SESSION_ID, sessions.hashDevice("e".repeat(32))), false);

  await db.run("update auth_sessions set revoked_at = ? where id = ?", [new Date().toISOString(), SESSION_ID]);
  assert.equal(await sessions.authSessionIsActive(SESSION_ID, existing.deviceHash), false);
});

test("persisted downgrade is scoped to the bound session and never elevates another", async () => {
  const current = await seedSession({ role: "FOUNDER" });
  await seedSession({ id: "b".repeat(32), role: "ADMIN", refreshHash: sessions.hashRefreshSecret("t".repeat(32)) });

  await sessions.downgradeAuthSession(current.id, current.deviceHash);
  assert.equal((await sessionRow(current.id)).role, "USER");
  assert.equal((await sessionRow("b".repeat(32))).role, "ADMIN");

  await sessions.downgradeAuthSession("b".repeat(32), sessions.hashDevice("e".repeat(32)));
  assert.equal((await sessionRow("b".repeat(32))).role, "ADMIN", "a mismatched device cannot alter the session");
});

test("revoke-other preserves only the current session and revoke-current checks device", async () => {
  await seedSession({ role: "USER" });
  await seedSession({ id: "b".repeat(32), refreshHash: sessions.hashRefreshSecret("t".repeat(32)) });
  const foreignId = "c".repeat(32);
  await db.run(
    `insert into accounts (id, email, role, is_blocked, created_at, updated_at) values (?, ?, 'USER', 0, ?, ?)`,
    [randomUUID(), "foreign@example.invalid", new Date().toISOString(), new Date().toISOString()],
  );
  await seedSession({ id: foreignId, userId: "another-user", refreshHash: sessions.hashRefreshSecret("u".repeat(32)) });

  cookieValues.set(sessions.refreshCookieName(), { value: `${SESSION_ID}.${REFRESH_SECRET}` });
  cookieValues.set(sessions.deviceCookieName(), { value: DEVICE_ID });

  await sessions.revokeOtherAuthSessions(USER_ID, "password_change");
  assert.equal((await sessionRow(SESSION_ID)).revoked_at, null);
  assert.equal((await sessionRow("b".repeat(32))).revoke_reason, "password_change");
  assert.equal((await sessionRow(foreignId)).revoked_at, null);

  await sessions.revokeCurrentAuthSession("logout");
  assert.equal((await sessionRow(SESSION_ID)).revoke_reason, "logout");
  assert.equal((await sessionRow(foreignId)).revoked_at, null);
});
