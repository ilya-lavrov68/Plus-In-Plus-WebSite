const assert = require("node:assert/strict");
const { test, beforeEach } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const sharp = require("sharp");

require.extensions[".ts"] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
};

// Test doubles only. These tests never connect to a database or create real accounts.
let account, session, options, compareCalls, lookupFails;
let addressSequence = 1;
class CredentialsSignin extends Error { code = "credentials"; }
function nextAuth(config) { options = config; return {}; }
nextAuth.CredentialsSignin = CredentialsSignin;
const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === "bcryptjs") return { compare: async (password, hash) => {
    compareCalls += 1;
    return password === "valid-passphrase" && hash === "mock-password-hash";
  } };
  if (name === "next-auth/providers/credentials") return (config) => config;
  if (name === "next-auth") return nextAuth;
  if (name === "@/auth") return { auth: async () => session };
  if (name === "@/lib/prisma") return { prisma: { user: { findUnique: async () => {
    if (lookupFails) throw new Error("simulated DB outage");
    return account;
  } } } };
  if (name.startsWith("@/")) name = path.resolve(__dirname, "..", name.slice(2));
  return originalLoad.call(this, name, parent, isMain);
};

const { requireAdmin } = require("../lib/admin-session.ts");
const { authorizeCredentials } = require("../lib/credentials.ts");
const { saveImageUpload, deleteImageUpload } = require("../lib/uploads.ts");
const { localAvatarPath } = require("../lib/upload-policy.ts");
const { sanitizePostContent } = require("../lib/sanitize-post-content.ts");
const { checkRateLimit, checkRateLimitAsync, getClientAddress, hashRateLimitIdentifier, progressiveLoginDelayMs, retryAfterHeaders } = require("../lib/rate-limit.ts");
const { GET: readUpload } = require("../app/uploads/[kind]/[filename]/route.ts");
require("../auth.ts");

const request = () => new Request("http://example.test/api/auth/callback/credentials", { headers: { "x-real-ip": `198.51.100.${addressSequence++}` } });
const credentials = (adminMode = "false") => ({ email: " ADMIN@example.com ", password: "valid-passphrase", adminMode });

beforeEach(() => {
  process.env.AUTH_SECRET = "test-secret-with-at-least-32-characters";
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  account = { id: "mock-admin-id", email: "admin@example.com", role: "ADMIN", firstName: "Test", lastName: "Double", avatar: null, passwordHash: "mock-password-hash" };
  session = { user: { ...account } };
  compareCalls = 0;
  lookupFails = false;
});

test("Credentials validates the password and includes the profile, but not the hash", async () => {
  const user = await authorizeCredentials(credentials("true"), request());
  assert.equal(user.id, account.id);
  assert.equal(user.firstName, "Test");
  assert.equal(user.lastName, "Double");
  assert.equal(user.role, "ADMIN");
  assert.equal(user.passwordHash, undefined);
  assert.equal(await authorizeCredentials({ ...credentials("true"), password: "wrong" }, request()), null);
});

test("regular login never grants ADMIN, even to an existing administrator", async () => {
  assert.equal((await authorizeCredentials(credentials(), request())).role, "USER");
  assert.equal(account.role, "ADMIN", "login must not mutate the database role");
  assert.equal((await authorizeCredentials({ ...credentials(), role: "ADMIN", adminMode: false }, request())).role, "USER");
});

test("Admin mode returns the same credential failure for USER and unknown accounts", async () => {
  account.role = "USER";
  assert.equal(await authorizeCredentials(credentials("true"), request()), null);
  account = null;
  assert.equal(await authorizeCredentials(credentials("true"), request()), null);
  assert.equal(compareCalls, 2, "unknown accounts must still run the password comparison");
});

test("invalid emails, overlong bcrypt passwords and weak configuration are rejected", async () => {
  assert.equal(await authorizeCredentials({ ...credentials(), email: "not-an-email" }, request()), null);
  assert.equal(await authorizeCredentials({ ...credentials(), password: "🙂".repeat(19) }, request()), null);
  process.env.AUTH_SECRET = "short";
  assert.equal(await authorizeCredentials(credentials("true"), request()), null);
});

test("repeated credential attempts are throttled before additional bcrypt work", async () => {
  const req = request();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    assert.equal(await authorizeCredentials({ ...credentials(), password: "wrong" }, req), null);
  }
  const atLimit = compareCalls;
  await assert.rejects(authorizeCredentials(credentials(), req), { code: "rate_limited" });
  assert.equal(compareCalls, atLimit);
});

test("JWT refresh reads the DB, ignores forged client updates, and never auto-elevates", async () => {
  const token = await options.callbacks.jwt({ token: {}, user: { ...account, role: "USER" } });
  assert.equal(token.passwordHash, undefined);
  account.firstName = "Changed";
  const refreshed = await options.callbacks.jwt({ token, trigger: "update", session: { role: "ADMIN", id: "other-user", firstName: "Injected" } });
  assert.equal(refreshed.id, account.id);
  assert.equal(refreshed.firstName, "Changed");
  assert.equal(refreshed.role, "USER", "a DB promotion is not an admin login");
  assert.equal(refreshed.passwordHash, undefined);
});

test("password changes revoke existing JWTs without exposing the bcrypt hash", async () => {
  const token = await options.callbacks.jwt({ token: {}, user: account });
  assert.equal(token.passwordHash, undefined);
  assert.ok(token.passwordStamp);
  assert.notEqual(token.passwordStamp, account.passwordHash);
  account.passwordHash = "replacement-password-hash";
  assert.equal(await options.callbacks.jwt({ token }), null);
  assert.equal(await options.callbacks.jwt({ token: { id: account.id } }), null, "legacy unmarked sessions must reauthenticate");
});

test("sessions reflect demotion and disappear after account deletion", async () => {
  const token = await options.callbacks.jwt({ token: {}, user: account });
  account.role = "USER";
  assert.equal((await options.callbacks.jwt({ token })).role, "USER");
  account = null;
  assert.equal(await options.callbacks.jwt({ token }), null);
});

test("session serialization includes all required fields and no credentials", async () => {
  const token = await options.callbacks.jwt({ token: {}, user: account });
  const result = await options.callbacks.session({ session: { user: {}, expires: "future" }, token });
  for (const field of ["id", "email", "firstName", "lastName", "avatar", "role"]) assert.ok(field in result.user, field);
  assert.equal(result.user.passwordHash, undefined);
});

test("server guards reject weak secrets, ordinary mode, demotion and deleted accounts", async () => {
  assert.equal((await requireAdmin()).role, "ADMIN");
  process.env.AUTH_SECRET = "short";
  assert.equal(await requireAdmin(), null);
  process.env.AUTH_SECRET = "test-secret-with-at-least-32-characters";
  session.user.role = "USER";
  assert.equal(await requireAdmin(), null);
  session.user.role = "ADMIN";
  account.role = "USER";
  assert.equal(await requireAdmin(), null);
  account = null;
  assert.equal(await requireAdmin(), null);
  session = null;
  assert.equal(await requireAdmin(), null);
});

test("post sanitizer removes scripts, events, embeds and unsafe URLs", () => {
  const html = sanitizePostContent('<p onclick="alert(1)">Hello <strong>world</strong></p><script>alert(1)</script><iframe src="https://evil.example"></iframe><a href="javascript:alert(1)">unsafe</a><a href="https://example.com" target="_blank">safe</a>');
  assert.ok(html.includes("<p>Hello <strong>world</strong></p>"));
  assert.doesNotMatch(html, /script|iframe|onclick|javascript:/i);
  assert.ok(html.includes('rel="noopener noreferrer"'));
});

test("rate limits expire without exposing raw identifiers", () => {
  const key = hashRateLimitIdentifier("registration:test@example.com");
  assert.notEqual(key, "registration:test@example.com");
  assert.equal(checkRateLimit(key, 2, 10_000, 1_000).allowed, true);
  assert.equal(checkRateLimit(key, 2, 10_000, 2_000).allowed, true);
  assert.deepEqual(checkRateLimit(key, 2, 10_000, 3_000), { allowed: false, retryAfterSeconds: 8, attempts: 2 });
  assert.equal(checkRateLimit(key, 2, 10_000, 11_000).allowed, true);
  assert.equal(getClientAddress("203.0.113.4, 10.0.0.1"), "203.0.113.4");
  assert.deepEqual([1, 2, 3, 4, 5, 20].map(progressiveLoginDelayMs), [0, 0, 250, 500, 1000, 2000]);
  assert.deepEqual(retryAfterHeaders(5.2), { "Retry-After": "6" });
});

test("shared rate limits use an atomic backend command and hashed keys", async () => {
  const originalFetch = global.fetch;
  let requestBody;
  global.fetch = async (url, init) => {
    assert.equal(String(url), "https://upstash.example.test/");
    assert.equal(init.headers.Authorization, "Bearer test-token");
    requestBody = JSON.parse(init.body);
    return new Response(JSON.stringify({ result: [3, 5_000] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  process.env.UPSTASH_REDIS_REST_URL = "https://upstash.example.test";
  process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
  try {
    const raw = "login:test@example.com";
    const result = await checkRateLimitAsync(hashRateLimitIdentifier(raw), 2, 10_000);
    assert.deepEqual(result, { allowed: false, retryAfterSeconds: 5, attempts: 3 });
    assert.equal(requestBody[0], "EVAL");
    assert.equal(requestBody[2], "1");
    assert.ok(requestBody[3].startsWith("pip:rate-limit:"));
    assert.equal(requestBody.includes(raw), false);
  } finally {
    global.fetch = originalFetch;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  }
});

test("uploads reject forged, truncated, oversized, SVG and non-local destinations", async () => {
  await assert.rejects(saveImageUpload(new File(["not a PNG"], "cover.png", { type: "image/png" }), "services"), /Invalid image file/);
  await assert.rejects(saveImageUpload(new File(["x"], "cover.png", { type: "text/plain" }), "blog"), /Only PNG/);
  await assert.rejects(saveImageUpload(new File(["x"], "avatar.svg", { type: "image/svg+xml" }), "avatars"), /Only PNG/);
  await assert.rejects(saveImageUpload(new File([Buffer.alloc(2 * 1024 * 1024 + 1)], "avatar.png", { type: "image/png" }), "avatars"), /2 MB/);
  const truncated = new File([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])], "avatar.png", { type: "image/png" });
  await assert.rejects(saveImageUpload(truncated, "avatars"), /Invalid image file/);
  for (const kind of ["../assets", "__proto__", "constructor"]) await assert.rejects(saveImageUpload(truncated, kind), /Unknown upload destination/);
});

test("real images are saved in each local folder and served after startup; cleanup is confined", async () => {
  const png = await sharp({ create: { width: 400, height: 300, channels: 3, background: "#336699" } }).png().toBuffer();
  for (const kind of ["avatars", "services", "blog"]) {
    const url = await saveImageUpload(new File([png], "image.png", { type: "image/png" }), kind);
    try {
      assert.match(url, new RegExp(`^/uploads/${kind}/[0-9a-f-]+\\.webp$`));
      const diskPath = path.join(process.cwd(), "public", url);
      const info = await sharp(diskPath).metadata();
      assert.equal(info.format, "webp");
      if (kind === "avatars") assert.equal(info.width, 256);
      await deleteImageUpload(url, kind === "blog" ? "services" : "blog");
      assert.equal(fs.existsSync(diskPath), true);
      const response = await readUpload(new Request(`http://example.test${url}`), { params: Promise.resolve({ kind, filename: path.basename(url) }) });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("content-type"), "image/webp");
      assert.equal(response.headers.get("x-content-type-options"), "nosniff");
      assert.ok((await response.arrayBuffer()).byteLength > 0);
    } finally {
      await deleteImageUpload(url, kind);
    }
  }
});

test("upload paths cannot traverse folders, expose docs, or request remote avatars", async () => {
  const readme = path.join(process.cwd(), "public/uploads/blog/README.md");
  const before = fs.readFileSync(readme, "utf8");
  await deleteImageUpload("/uploads/blog/README.md", "blog");
  await deleteImageUpload("/uploads/blog/../../assets/logos/README.md", "blog");
  assert.equal(fs.readFileSync(readme, "utf8"), before);
  for (const filename of ["README.md", "../../.env", "not-an-image.svg"]) {
    const response = await readUpload(new Request("http://example.test"), { params: Promise.resolve({ kind: "avatars", filename }) });
    assert.equal(response.status, 404);
  }
  for (const url of ["https://gravatar.com/avatar/x", "//remote.test/avatar.png", "/uploads/blog/anything.png", "/uploads/avatars/../image.png"]) assert.equal(localAvatarPath(url), null);
});
