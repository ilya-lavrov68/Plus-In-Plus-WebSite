const assert = require("node:assert/strict");
const { test, beforeEach } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const bcrypt = require("bcryptjs");
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);

// All account records below exist ONLY in mocked repositories in this test process.
let users, session, activity, signIns, signOuts, uploads, cleaned, refreshed, signinError, transactionError, duplicateError;
let ip = 1;
class AuthError extends Error {}
class CredentialsSignin extends AuthError { code = "credentials"; }
class UploadValidationError extends Error {}
const prisma = {
  user: {
    findUnique: async ({ where }) => structuredClone(users.find((user) => where.id ? user.id === where.id : user.email === where.email) ?? null),
    create: async ({ data }) => {
      if (duplicateError) throw Object.assign(new Error("unique constraint"), { code: "P2002" });
      const user = { id: `mock-user-${users.length + 1}`, ...data, avatar: null };
      users.push(user); return user;
    },
    update: async ({ where, data }) => { const user = users.find((u) => u.id === where.id); if (!user) throw new Error("missing"); Object.assign(user, data); return user; },
  },
  activityLog: { create: async ({ data }) => { if (transactionError) throw new Error("simulated transaction failure"); activity.push(data); return data; } },
  $transaction: async (callback) => {
    const snapshot = structuredClone({ users, activity });
    try { return await callback(prisma); } catch (error) { users = snapshot.users; activity = snapshot.activity; throw error; }
  },
};
const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === "next-auth") return { AuthError, CredentialsSignin };
  if (name === "@/auth") return {
    auth: async () => session,
    signIn: async (provider, options) => { signIns.push({ provider, ...options }); if (signinError) throw signinError; },
    signOut: async (options) => { signOuts.push(options); },
  };
  if (name === "next/headers") return { headers: async () => new Headers({ "x-real-ip": `203.0.113.${ip}` }) };
  if (name === "next/cache") return { revalidatePath: (p) => refreshed.push(p) };
  if (name === "@/lib/prisma") return { prisma };
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

beforeEach(() => {
  process.env.AUTH_SECRET = "test-secret-with-at-least-32-characters";
  users = []; activity = []; signIns = []; signOuts = []; uploads = []; cleaned = []; refreshed = [];
  session = null; signinError = null; transactionError = false; duplicateError = false; ip += 1;
});

test("registration ALWAYS creates USER, even the first account with malicious admin fields", async () => {
  const input = { ...registration(), role: "ADMIN", adminMode: true, id: "chosen-id", avatar: "https://remote.test/avatar" };
  assert.deepEqual(await registerUser(input), { ok: true, success: true, isAdmin: false });
  assert.equal(users.length, 1);
  assert.equal(users[0].role, "USER");
  assert.equal(users[0].email, "person@example.com");
  assert.equal(users[0].firstName, "First");
  assert.equal(users[0].lastName, "Last");
  assert.notEqual(users[0].id, input.id);
  assert.equal(users[0].avatar, null);
  assert.notEqual(users[0].passwordHash, input.password);
  assert.equal(await bcrypt.compare(input.password, users[0].passwordHash), true);
  assert.equal(users[0].password, undefined);
  assert.equal(activity[0].action, "registered");
  assert.equal(activity[0].title, "User account");
  assert.equal(JSON.stringify(activity).includes(input.email), false, "audit titles must not contain email addresses");
  assert.equal(signIns[0].adminMode, "false");
  assert.equal(signIns[0].redirect, false);
});

test("registration validates names, confirm password and bcrypt UTF-8 byte limits", async () => {
  for (const changed of [{ firstName: " " }, { lastName: "x".repeat(81) }, { confirmPassword: "different" }, { password: "short", confirmPassword: "short" }, { password: "🙂".repeat(19), confirmPassword: "🙂".repeat(19) }]) {
    ip += 1;
    assert.equal((await registerUser({ ...registration(), ...changed })).ok, false);
  }
  assert.equal(users.length, 0);
  assert.equal(signIns.length, 0);
});

test("registration accepts plain FormData (spec) and still forces the USER role", async () => {
  const form = new FormData();
  form.set("firstName", " Form "); form.set("lastName", "Data");
  form.set("email", " Form@Example.com "); form.set("password", "a-Long-passphrase1");
  // Extra fields a hostile payload could submit; the action reads none of them.
  form.set("role", "ADMIN"); form.set("adminMode", "true"); form.set("id", "chosen-id");
  assert.deepEqual(await registerUser(form), { ok: true, success: true, isAdmin: false });
  assert.equal(users.length, 1);
  assert.equal(users[0].role, "USER");
  assert.equal(users[0].email, "form@example.com");
  assert.equal(users[0].firstName, "Form");
  assert.equal(users[0].id === "chosen-id", false);
  assert.equal(signIns[0].adminMode, "false");
});

test("duplicate registrations and unique-constraint races fail without automatic login", async () => {
  users.push({ id: "existing-mock", email: "person@example.com", role: "USER" });
  assert.equal((await registerUser(registration())).ok, false);
  users = []; duplicateError = true;
  assert.equal((await registerUser(registration())).ok, false);
  assert.equal(signIns.length, 0);
  assert.equal(activity.length, 0);
});

test("registration reports a created account if automatic login is temporarily unavailable", async () => {
  signinError = new CredentialsSignin();
  const result = await registerUser(registration());
  assert.equal(result.ok, false);
  assert.equal(result.accountCreated, true);
  assert.equal(users[0].role, "USER");
});

test("admin mode delegates account classification to Auth.js and uses one credential failure", async () => {
  users.push({ id: "user-mock", email: "person@example.com", role: "USER", passwordHash: "hash" });
  signinError = new CredentialsSignin();
  const regularResult = await loginUser({ ...registration(), adminMode: true });
  assert.deepEqual(regularResult, {
    ok: false, success: false, error: "Invalid email or password.",
  });
  assert.equal(signIns.length, 1, "the role prelookup does not reject before credential verification");

  users = [{ id: "admin-mock", email: "person@example.com", role: "ADMIN", passwordHash: "hash", mfaSecret: "encrypted-test-secret", webAuthnCredentials: [] }];
  signinError = Object.assign(new CredentialsSignin(), { code: "admin_account_not_found" });
  const adminResult = await loginUser({ ...registration(), adminMode: true });
  assert.deepEqual(adminResult, regularResult, "legacy/provider codes cannot leak account classification");

  signinError = null;
  assert.deepEqual(await loginUser({ ...registration(), adminMode: true }), {
    ok: true, success: true, isAdmin: true, redirectTo: "/admin/dashboard",
  });
  assert.equal(signIns.at(-1).adminMode, "true");
  assert.deepEqual(await loginUser({ ...registration(), adminMode: false, redirectTo: "https://evil.test" }), {
    ok: true, success: true, isAdmin: false,
  });
  assert.deepEqual(activity.map((entry) => entry.action), ["staff login", "login"]);
  assert.equal(activity.every((entry) => entry.title === "User account"), true);
  assert.equal(JSON.stringify(activity).includes("person@example.com"), false);
  // An admin account that does not ask for admin mode gets a regular session.
  assert.equal(signIns.at(-1).adminMode, "false");
  assert.equal(signIns.at(-1).redirectTo, "/");
});

test("login accepts FormData with the isAdminMode flag", async () => {
  users.push({ id: "user-mock", email: "person@example.com", role: "USER", passwordHash: "hash" });
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
  users.push({ id: "self-mock", email: "self@example.com", role: "USER", avatar: null, passwordHash: "unchanged" });
  users.push({ id: "other-mock", firstName: "Untouched", email: "other@example.com", role: "ADMIN" });
  session = { user: { id: "self-mock", role: "USER" } };
  for (const [key, value] of Object.entries({ id: "other-mock", email: "attacker@example.com", role: "ADMIN", passwordHash: "injected" })) form.set(key, value);
  assert.equal((await updateUserProfile(form)).ok, true);
  assert.equal(users[0].firstName, "Changed");
  assert.equal(users[0].email, "self@example.com");
  assert.equal(users[0].role, "USER");
  assert.equal(users[0].passwordHash, "unchanged");
  assert.equal(users[1].firstName, "Untouched");
  assert.equal(activity[0].actorId, "self-mock");
});

test("avatar replacement saves only in avatars and deletes the old upload after commit", async () => {
  const old = "/uploads/avatars/22222222-2222-4222-a222-222222222222.webp";
  users.push({ id: "self-mock", email: "self@example.com", role: "USER", avatar: old });
  session = { user: { id: "self-mock" } };
  const form = profileForm(); form.set("avatar", new File(["mock"], "photo.png", { type: "image/png" }));
  assert.equal((await updateUserProfile(form)).ok, true);
  assert.equal(uploads[0].kind, "avatars");
  assert.equal(users[0].avatar, uploads[0].url);
  assert.deepEqual(cleaned, [{ url: old, kind: "avatars" }]);
});

test("remote avatar paths are rejected and absent files preserve the current avatar", async () => {
  users.push({ id: "self-mock", email: "self@example.com", role: "USER", avatar: "/uploads/avatars/existing.webp" });
  session = { user: { id: "self-mock" } };
  const form = profileForm(); form.set("avatar", "https://remote.test/avatar.png");
  assert.equal((await updateUserProfile(form)).ok, false);
  form.delete("avatar");
  assert.equal((await updateUserProfile(form)).ok, true);
  assert.equal(users[0].avatar, "/uploads/avatars/existing.webp");
  assert.equal(uploads.length, 0);
});

test("failed profile transaction removes the new file, preserving the previous avatar and log", async () => {
  users.push({ id: "self-mock", email: "self@example.com", role: "USER", avatar: "/uploads/avatars/old.webp" });
  session = { user: { id: "self-mock" } };
  transactionError = true;
  const form = profileForm(); form.set("avatar", new File(["mock"], "photo.png", { type: "image/png" }));
  const oldError = console.error; console.error = () => {};
  try { assert.equal((await updateUserProfile(form)).ok, false); } finally { console.error = oldError; }
  assert.equal(users[0].avatar, "/uploads/avatars/old.webp");
  assert.deepEqual(cleaned, [{ url: uploads[0].url, kind: "avatars" }]);
  assert.equal(activity.length, 0);
});

test("logout delegates cookie invalidation to Auth.js and writes a PII-free audit event", async () => {
  session = { user: { id: "self-mock" } };
  assert.deepEqual(await logout(), { ok: true, success: true });
  assert.deepEqual(signOuts, [{ redirect: false, redirectTo: "/" }]);
  assert.equal(activity[0].action, "logout");
  assert.equal(activity[0].title, "User account");
});
