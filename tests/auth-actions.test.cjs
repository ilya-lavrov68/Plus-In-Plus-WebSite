const assert = require("node:assert/strict");
const { after, before, beforeEach, test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const bcrypt = require("bcryptjs");
const { createTestDatabase } = require("./helpers/test-db.cjs");

require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);

// Accounts below are real SQLite rows in a temporary database.
let database, session, signIns, signOuts, uploads, cleaned, refreshed, signinError, transactionError, duplicateError;
let ip = 1;
class AuthError extends Error {}
class CredentialsSignin extends AuthError { code = "credentials"; }
class UploadValidationError extends Error {}

const originalLoad = Module._load;
const ACCOUNTS_FILE = path.resolve(__dirname, "..", "lib", "accounts.ts");

Module._load = function (name, parent, isMain) {
  if (name === "next-auth") return { AuthError, CredentialsSignin };
  if (name === "@/auth") return {
    auth: async () => session,
    signIn: async (provider, options) => { signIns.push({ provider, ...options }); if (signinError) throw signinError; },
    signOut: async (options) => { signOuts.push(options); },
  };
  if (name === "next/headers") return { headers: async () => new Headers({ "x-real-ip": `203.0.113.${ip}` }) };
  if (name === "next/cache") return { revalidatePath: (p) => refreshed.push(p) };
  // Two deterministic failure seams, resolved per call: a registration race and
  // a broken audit write inside an otherwise real transaction.
  if (name === "@/lib/accounts") {
    const real = originalLoad.call(this, ACCOUNTS_FILE, parent, isMain);
    return {
      ...real,
      findAccountByEmail: async (...args) => (duplicateError ? null : real.findAccountByEmail(...args)),
      recordActivity: async (...args) => {
        if (transactionError) throw new Error("simulated transaction failure");
        return real.recordActivity(...args);
      },
    };
  }
  if (name === "@/lib/password-breach") return {
    CompromisedPasswordError: class CompromisedPasswordError extends Error {},
    assertPasswordNotCompromised: async () => {},
  };
  if (name === "@/lib/uploads") return {
    UploadValidationError,
    saveImageUpload: async (file, kind) => { const url = `/uploads/${kind}/11111111-1111-4111-a111-111111111111.webp`; uploads.push({ file, kind, url }); return url; },
    cleanupUpload: async (url, kind) => { if (url) cleaned.push({ url, kind }); },
  };
  if (name.startsWith("@/")) name = path.resolve(__dirname, "..", name.slice(2));
  return originalLoad.call(this, name, parent, isMain);
};

const { registerUser, loginUser, updateUserProfile, logout } = require("../app/actions/auth.ts");
const registration = () => ({ firstName: "  First ", lastName: " Last ", email: " PERSON@example.com ", password: "a-Long-passphrase1", confirmPassword: "a-Long-passphrase1" });
const profileForm = () => { const f = new FormData(); f.set("firstName", "Changed"); f.set("lastName", "Name"); return f; };

async function accounts() {
  return database.rows("select * from accounts order by created_at");
}
async function activityLog() {
  return database.rows("select * from activity_logs order by created_at");
}

before(async () => {
  database = createTestDatabase("pip-auth-actions-");
  await database.ready;
});

after(async () => {
  Module._load = originalLoad;
  await database?.close();
});

beforeEach(async () => {
  process.env.AUTH_SECRET = "test-secret-with-at-least-32-characters";
  await database.reset();
  signIns = []; signOuts = []; uploads = []; cleaned = []; refreshed = [];
  session = null; signinError = null; transactionError = false; duplicateError = false; ip += 1;
});

test("registration ALWAYS creates USER, even the first account with malicious admin fields", async () => {
  const input = { ...registration(), role: "ADMIN", adminMode: true, id: "chosen-id", avatar: "https://remote.test/avatar" };
  assert.deepEqual(await registerUser(input), { ok: true, success: true, isAdmin: false });
  const rows = await accounts();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].role, "USER");
  assert.equal(rows[0].email, "person@example.com");
  assert.equal(rows[0].first_name, "First");
  assert.equal(rows[0].last_name, "Last");
  assert.notEqual(rows[0].id, input.id);
  assert.equal(rows[0].avatar, null);
  assert.notEqual(rows[0].password_hash, input.password);
  assert.equal(await bcrypt.compare(input.password, rows[0].password_hash), true);
  const log = await activityLog();
  assert.equal(log[0].action, "registered");
  assert.equal(log[0].title, "User account");
  assert.equal(JSON.stringify(log).includes(input.email), false, "audit titles must not contain email addresses");
  assert.equal(signIns[0].adminMode, "false");
  assert.equal(signIns[0].redirect, false);
});

test("registration validates names, confirm password and bcrypt UTF-8 byte limits", async () => {
  for (const changed of [{ firstName: " " }, { lastName: "x".repeat(81) }, { confirmPassword: "different" }, { password: "short", confirmPassword: "short" }, { password: "🙂".repeat(19), confirmPassword: "🙂".repeat(19) }]) {
    ip += 1;
    assert.equal((await registerUser({ ...registration(), ...changed })).ok, false);
  }
  assert.equal((await accounts()).length, 0);
  assert.equal(signIns.length, 0);
});

test("registration accepts plain FormData (spec) and still forces the USER role", async () => {
  const form = new FormData();
  form.set("firstName", " Form "); form.set("lastName", "Data");
  form.set("email", " Form@Example.com "); form.set("password", "a-Long-passphrase1");
  // Extra fields a hostile payload could submit; the action reads none of them.
  form.set("role", "ADMIN"); form.set("adminMode", "true"); form.set("id", "chosen-id");
  assert.deepEqual(await registerUser(form), { ok: true, success: true, isAdmin: false });
  const rows = await accounts();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].role, "USER");
  assert.equal(rows[0].email, "form@example.com");
  assert.equal(rows[0].first_name, "Form");
  assert.equal(rows[0].id === "chosen-id", false);
  assert.equal(signIns[0].adminMode, "false");
});

test("duplicate registrations and unique-constraint races fail without automatic login", async () => {
  await database.insertAccount({ email: "person@example.com" });
  assert.equal((await registerUser(registration())).ok, false);

  // The second attempt hides the pre-check, so SQLite's unique index is what rejects it.
  duplicateError = true;
  assert.equal((await registerUser(registration())).ok, false);
  duplicateError = false;
  assert.equal(signIns.length, 0);
  assert.equal((await activityLog()).length, 0);
  assert.equal((await accounts()).length, 1);
});

test("registration reports a created account if automatic login is temporarily unavailable", async () => {
  signinError = new CredentialsSignin();
  const result = await registerUser(registration());
  assert.equal(result.ok, false);
  assert.equal(result.accountCreated, true);
  const rows = await accounts();
  assert.equal(rows[0].role, "USER");
});

test("admin mode delegates account classification to Auth.js and uses one credential failure", async () => {
  await database.insertAccount({ id: "user-mock", email: "person@example.com", role: "USER", passwordHash: "hash" });
  signinError = new CredentialsSignin();
  const regularResult = await loginUser({ ...registration(), adminMode: true });
  assert.deepEqual(regularResult, {
    ok: false, success: false, error: "Invalid email or password.",
  });
  assert.equal(signIns.length, 1, "the role prelookup does not reject before credential verification");

  await database.reset();
  await database.insertAccount({ id: "admin-mock", email: "person@example.com", role: "ADMIN", passwordHash: "hash", mfaSecret: "encrypted-test-secret" });
  signinError = Object.assign(new CredentialsSignin(), { code: "admin_account_not_found" });
  const adminResult = await loginUser({ ...registration(), adminMode: true });
  assert.deepEqual(adminResult, regularResult, "legacy/provider codes cannot leak account classification");

  signinError = null;
  assert.deepEqual(await loginUser({ ...registration(), adminMode: true }), {
    ok: true, success: true, isAdmin: true, redirectTo: "/admin",
  });
  assert.equal(signIns.at(-1).adminMode, "true");
  assert.deepEqual(await loginUser({ ...registration(), adminMode: false, redirectTo: "https://evil.test" }), {
    ok: true, success: true, isAdmin: false,
  });
  const log = await activityLog();
  assert.deepEqual(log.map((entry) => entry.action), ["staff login", "login"]);
  assert.equal(log.every((entry) => entry.title === "User account"), true);
  assert.equal(JSON.stringify(log).includes("person@example.com"), false);
  // An admin account that does not ask for admin mode gets a regular session.
  assert.equal(signIns.at(-1).adminMode, "false");
  assert.equal(signIns.at(-1).redirectTo, "/");
});

test("login accepts FormData with the isAdminMode flag", async () => {
  await database.insertAccount({ id: "user-mock", email: "person@example.com", role: "USER", passwordHash: "hash" });
  const regular = new FormData();
  regular.set("email", " Person@Example.com "); regular.set("password", "a-Long-passphrase1"); regular.set("isAdminMode", "false");
  assert.deepEqual(await loginUser(regular), { ok: true, success: true, isAdmin: false });
  assert.equal(signIns[0].adminMode, "false");
  assert.equal(signIns[0].email, "person@example.com");

  const admin = new FormData();
  admin.set("email", "person@example.com"); admin.set("password", "a-Long-passphrase1"); admin.set("isAdminMode", "true");
  signinError = new CredentialsSignin();
  assert.deepEqual(await loginUser(admin), {
    ok: false, success: false, error: "Invalid email or password.",
  });
  assert.equal(signIns.length, 2);
});

test("profile changes require authentication and ignore submitted id, email, role and hash", async () => {
  const form = profileForm();
  assert.equal((await updateUserProfile(form)).ok, false);
  await database.insertAccount({ id: "self-mock", email: "self@example.com", role: "USER", passwordHash: "unchanged" });
  await database.insertAccount({ id: "other-mock", firstName: "Untouched", email: "other@example.com", role: "ADMIN" });
  session = { user: { id: "self-mock", role: "USER" } };
  for (const [key, value] of Object.entries({ id: "other-mock", email: "attacker@example.com", role: "ADMIN", passwordHash: "injected" })) form.set(key, value);
  assert.equal((await updateUserProfile(form)).ok, true);
  const self = await database.one("select * from accounts where id = ?", ["self-mock"]);
  const other = await database.one("select * from accounts where id = ?", ["other-mock"]);
  assert.equal(self.first_name, "Changed");
  assert.equal(self.email, "self@example.com");
  assert.equal(self.role, "USER");
  assert.equal(self.password_hash, "unchanged");
  assert.equal(other.first_name, "Untouched");
  const log = await activityLog();
  assert.equal(log[0].actor_id_id, "self-mock");
});

test("avatar replacement saves only in avatars and deletes the old upload after commit", async () => {
  const old = "/uploads/avatars/22222222-2222-4222-a222-222222222222.webp";
  await database.insertAccount({ id: "self-mock", email: "self@example.com", role: "USER", avatar: old });
  session = { user: { id: "self-mock" } };
  const form = profileForm(); form.set("avatar", new File(["mock"], "photo.png", { type: "image/png" }));
  assert.equal((await updateUserProfile(form)).ok, true);
  assert.equal(uploads[0].kind, "avatars");
  assert.equal((await database.one("select avatar from accounts where id = ?", ["self-mock"])).avatar, uploads[0].url);
  assert.deepEqual(cleaned, [{ url: old, kind: "avatars" }]);
});

test("remote avatar paths are rejected and absent files preserve the current avatar", async () => {
  await database.insertAccount({ id: "self-mock", email: "self@example.com", role: "USER", avatar: "/uploads/avatars/existing.webp" });
  session = { user: { id: "self-mock" } };
  const form = profileForm(); form.set("avatar", "https://remote.test/avatar.png");
  assert.equal((await updateUserProfile(form)).ok, false);
  form.delete("avatar");
  assert.equal((await updateUserProfile(form)).ok, true);
  assert.equal((await database.one("select avatar from accounts where id = ?", ["self-mock"])).avatar, "/uploads/avatars/existing.webp");
  assert.equal(uploads.length, 0);
});

test("failed profile transaction removes the new file, preserving the previous avatar and log", async () => {
  await database.insertAccount({ id: "self-mock", email: "self@example.com", role: "USER", avatar: "/uploads/avatars/old.webp" });
  session = { user: { id: "self-mock" } };
  transactionError = true;
  const form = profileForm(); form.set("avatar", new File(["mock"], "photo.png", { type: "image/png" }));
  const oldError = console.error; console.error = () => {};
  try { assert.equal((await updateUserProfile(form)).ok, false); } finally { console.error = oldError; }
  transactionError = false;
  assert.equal((await database.one("select avatar from accounts where id = ?", ["self-mock"])).avatar, "/uploads/avatars/old.webp");
  assert.deepEqual(cleaned, [{ url: uploads[0].url, kind: "avatars" }]);
  assert.equal((await activityLog()).length, 0);
});

test("logout delegates cookie invalidation to Auth.js and writes a PII-free audit event", async () => {
  await database.insertAccount({ id: "self-mock", email: "self@example.com" });
  session = { user: { id: "self-mock" } };
  assert.deepEqual(await logout(), { ok: true, success: true });
  assert.deepEqual(signOuts, [{ redirect: false, redirectTo: "/" }]);
  const log = await activityLog();
  assert.equal(log[0].action, "logout");
  assert.equal(log[0].title, "User account");
});
