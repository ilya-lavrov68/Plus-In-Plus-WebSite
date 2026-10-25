const assert = require("node:assert/strict");
const { test, beforeEach } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => {
  module._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    filename,
  );
};

// Изолированное хранилище только для регрессий логики сессий; реальная БД не используется.
let records;
let cookieValues;
let securityEvents;
let dbUser;

function matches(record, where) {
  if (typeof where.id === "string" && record.id !== where.id) return false;
  if (where.id?.in && !where.id.in.includes(record.id)) return false;
  if (where.id?.not && record.id === where.id.not) return false;
  if (where.userId && record.userId !== where.userId) return false;
  if (where.refreshHash && record.refreshHash !== where.refreshHash) return false;
  if (where.deviceHash && record.deviceHash !== where.deviceHash) return false;
  if (where.role?.not && record.role === where.role.not) return false;
  if (Object.hasOwn(where, "revokedAt") && where.revokedAt === null && record.revokedAt !== null) return false;
  if (where.expiresAt?.gt && !(record.expiresAt > where.expiresAt.gt)) return false;
  return true;
}

const authSession = {
  create: async ({ data }) => {
    const record = { revokedAt: null, revokeReason: null, ...structuredClone(data) };
    records.push(record);
    return structuredClone(record);
  },
  findMany: async ({ where, orderBy, select }) => {
    const found = records.filter((record) => matches(record, where));
    if (orderBy?.lastUsedAt === "desc") found.sort((a, b) => b.lastUsedAt - a.lastUsedAt);
    return found.map((record) => select?.id ? { id: record.id } : structuredClone(record));
  },
  findUnique: async ({ where }) => {
    const record = records.find((item) => item.id === where.id);
    return record ? { ...structuredClone(record), user: structuredClone(dbUser) } : null;
  },
  findFirst: async ({ where }) => structuredClone(records.find((record) => matches(record, where)) ?? null),
  updateMany: async ({ where, data }) => {
    const selected = records.filter((record) => matches(record, where));
    for (const record of selected) Object.assign(record, structuredClone(data));
    return { count: selected.length };
  },
};

const prisma = {
  authSession,
  $transaction: async (callback) => callback(prisma),
};
const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === "@/lib/prisma") return { prisma };
  if (name === "next/headers") {
    return { cookies: async () => ({
      get: (key) => cookieValues.has(key) ? { value: cookieValues.get(key).value } : undefined,
      set: (key, value, options) => cookieValues.set(key, { value, options }),
    }) };
  }
  if (name === "@/lib/security-log") {
    return { logSecurityEvent: (event) => securityEvents.push(event) };
  }
  if (name.startsWith("@/")) name = path.resolve(__dirname, "..", name.slice(2));
  return originalLoad.call(this, name, parent, isMain);
};

const sessions = require("../lib/auth-sessions.ts");
const { MAX_CONCURRENT_SESSIONS } = require("../lib/session-policy.ts");

const USER_ID = "user-session-test";
const DEVICE_ID = "d".repeat(32);
const SESSION_ID = "a".repeat(32);
const REFRESH_SECRET = "s".repeat(32);

function seedSession(overrides = {}) {
  const now = new Date();
  const record = {
    id: SESSION_ID,
    userId: USER_ID,
    role: "ADMIN",
    refreshHash: sessions.hashRefreshSecret(REFRESH_SECRET),
    deviceHash: sessions.hashDevice(DEVICE_ID),
    createdAt: now,
    lastUsedAt: now,
    expiresAt: new Date(now.getTime() + 60_000),
    revokedAt: null,
    revokeReason: null,
    ...overrides,
  };
  records.push(record);
  return record;
}

beforeEach(() => {
  records = [];
  cookieValues = new Map();
  securityEvents = [];
  dbUser = {
    id: USER_ID,
    email: "session-test@example.invalid",
    firstName: "Test",
    lastName: "Session",
    avatar: null,
    role: "ADMIN",
    isBlocked: false,
  };
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
    seedSession({
      id: character.repeat(32),
      refreshHash: sessions.hashRefreshSecret(`${character}${REFRESH_SECRET}`.slice(0, 32)),
      lastUsedAt: new Date(now - (index + 1) * 60_000),
    });
  }

  const created = await sessions.createAuthSession(USER_ID, "USER");
  assert.ok(created.sessionId);
  const active = records.filter((record) => record.userId === USER_ID && record.revokedAt === null);
  assert.equal(active.length, MAX_CONCURRENT_SESSIONS);
  assert.equal(records.find((record) => record.id === "c".repeat(32)).revokeReason, "session_limit");
  assert.equal(records.find((record) => record.id === created.sessionId).revokedAt, null);
  assert.equal(cookieValues.get(sessions.refreshCookieName()).options.httpOnly, true);
  assert.equal(cookieValues.get(sessions.deviceCookieName()).options.httpOnly, true);
});

test("successful rotation changes the stored hash and preserves absolute expiry", async () => {
  const existing = seedSession();
  const oldHash = existing.refreshHash;
  const originalExpiry = existing.expiresAt.getTime();
  const rotated = await sessions.rotateAuthSession(`${SESSION_ID}.${REFRESH_SECRET}`, DEVICE_ID);

  assert.equal(rotated.sessionId, SESSION_ID);
  assert.equal(rotated.role, "ADMIN");
  assert.notEqual(existing.refreshHash, oldHash);
  assert.equal(existing.expiresAt.getTime(), originalExpiry);
  const nextCookie = cookieValues.get(sessions.refreshCookieName()).value;
  assert.notEqual(nextCookie, `${SESSION_ID}.${REFRESH_SECRET}`);
  assert.deepEqual(sessions.parseRefreshToken(nextCookie).id, SESSION_ID);
  assert.equal(sessions.hashRefreshSecret(sessions.parseRefreshToken(nextCookie).secret), existing.refreshHash);
});

test("a refresh-time demotion persists and later promotion cannot restore staff mode", async () => {
  const existing = seedSession({ role: "ADMIN" });
  dbUser.role = "USER";
  const demoted = await sessions.rotateAuthSession(`${SESSION_ID}.${REFRESH_SECRET}`, DEVICE_ID);
  assert.equal(demoted.role, "USER");
  assert.equal(existing.role, "USER");

  const refreshedCookie = cookieValues.get(sessions.refreshCookieName()).value;
  dbUser.role = "ADMIN";
  const promotedAgain = await sessions.rotateAuthSession(refreshedCookie, DEVICE_ID);
  assert.equal(promotedAgain.role, "USER", "a later DB promotion still requires a new staff login");
  assert.equal(existing.role, "USER");
});

test("refresh-token reuse revokes every active session for the account", async () => {
  const existing = seedSession();
  seedSession({ id: "b".repeat(32), refreshHash: sessions.hashRefreshSecret("t".repeat(32)) });
  existing.refreshHash = sessions.hashRefreshSecret("x".repeat(32));

  const result = await sessions.rotateAuthSession(`${SESSION_ID}.${REFRESH_SECRET}`, DEVICE_ID);
  assert.equal(result, null);
  assert.equal(records.filter((record) => record.userId === USER_ID).every((record) => record.revokeReason === "refresh_reuse"), true);
  assert.deepEqual(securityEvents, ["auth.refresh.reuse_detected"]);
});

test("device mismatch fails closed without rotating the refresh secret", async () => {
  const existing = seedSession();
  const oldHash = existing.refreshHash;
  const result = await sessions.rotateAuthSession(`${SESSION_ID}.${REFRESH_SECRET}`, "e".repeat(32));

  assert.equal(result, null);
  assert.equal(existing.refreshHash, oldHash);
  assert.equal(existing.revokedAt, null);
  assert.deepEqual(securityEvents, ["auth.refresh.device_mismatch"]);
});

test("active-session checks enforce revocation, expiry and device binding", async () => {
  const existing = seedSession();
  assert.equal(await sessions.authSessionIsActive(SESSION_ID, existing.deviceHash), true);
  assert.equal(await sessions.authSessionIsActive(SESSION_ID, sessions.hashDevice("e".repeat(32))), false);
  existing.revokedAt = new Date();
  assert.equal(await sessions.authSessionIsActive(SESSION_ID, existing.deviceHash), false);
});

test("persisted downgrade is scoped to the bound session and never elevates another", async () => {
  const current = seedSession({ role: "FOUNDER" });
  const other = seedSession({ id: "b".repeat(32), role: "ADMIN", refreshHash: sessions.hashRefreshSecret("t".repeat(32)) });

  await sessions.downgradeAuthSession(current.id, current.deviceHash);
  assert.equal(current.role, "USER");
  assert.equal(other.role, "ADMIN");
  await sessions.downgradeAuthSession(other.id, sessions.hashDevice("e".repeat(32)));
  assert.equal(other.role, "ADMIN", "a mismatched device cannot alter the session");
});

test("revoke-other preserves only the current session and revoke-current checks device", async () => {
  const current = seedSession({ role: "USER" });
  const other = seedSession({ id: "b".repeat(32), refreshHash: sessions.hashRefreshSecret("t".repeat(32)) });
  const foreign = seedSession({
    id: "c".repeat(32),
    userId: "another-user",
    refreshHash: sessions.hashRefreshSecret("u".repeat(32)),
  });
  cookieValues.set(sessions.refreshCookieName(), { value: `${SESSION_ID}.${REFRESH_SECRET}` });
  cookieValues.set(sessions.deviceCookieName(), { value: DEVICE_ID });

  await sessions.revokeOtherAuthSessions(USER_ID, "password_change");
  assert.equal(current.revokedAt, null);
  assert.equal(other.revokeReason, "password_change");
  assert.equal(foreign.revokedAt, null);

  await sessions.revokeCurrentAuthSession("logout");
  assert.equal(current.revokeReason, "logout");
  assert.equal(foreign.revokedAt, null);
});
