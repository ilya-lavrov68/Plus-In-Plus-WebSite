const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText, filename);
};

let account = { id: "admin-id", email: "admin@example.com", role: "ADMIN" };
let session = { user: { id: "admin-id", email: "admin@example.com", role: "ADMIN" } };
const originalLoad = Module._load;
let compareCalls = 0;
Module._load = function (name, parent, isMain) {
  if (name === "bcryptjs") {
    return {
      compare: async (password, passwordHash) => {
        compareCalls += 1;
        return password === "valid-passphrase" && passwordHash === "mock-password-hash";
      },
    };
  }
  if (name === "next-auth/providers/credentials") return (providerOptions) => providerOptions;
  if (name === "next-auth") return { getServerSession: async () => session };
  if (name === "@/auth") return { authOptions: {} };
  if (name === "@/lib/prisma") return { prisma: { user: { findUnique: async () => account } } };
  if (name.startsWith("@/")) name = path.resolve(__dirname, "..", name.slice(2));
  return originalLoad.call(this, name, parent, isMain);
};

process.env.NEXTAUTH_SECRET = "test-secret-with-at-least-32-characters";

const { requireAdmin } = require("../lib/admin-session.ts");
const { saveCoverUpload, deleteCoverUpload } = require("../lib/uploads.ts");
const { sanitizePostContent } = require("../lib/sanitize-post-content.ts");
const { checkRateLimit, getClientAddress, hashRateLimitIdentifier } = require("../lib/rate-limit.ts");
const { authOptions } = require("../auth.ts");

test("credential login accepts a valid email and throttles repeated attempts", async () => {
  account = {
    id: "admin-id",
    email: "admin@example.com",
    role: "ADMIN",
    passwordHash: "mock-password-hash",
  };
  compareCalls = 0;
  const authorize = authOptions.providers[0].authorize;
  const request = { headers: { "x-real-ip": "198.51.100.23" } };

  const authenticated = await authorize(
    { email: " ADMIN@example.com ", password: "valid-passphrase" },
    request,
  );
  assert.equal(authenticated?.id, "admin-id");
  assert.equal(
    await authorize({ email: "not-an-email", password: "valid-passphrase" }, {
      headers: { "x-real-ip": "198.51.100.24" },
    }),
    null,
  );

  for (let attempt = 0; attempt < 7; attempt += 1) {
    assert.equal(
      await authorize({ email: "admin@example.com", password: "wrong-password" }, request),
      null,
    );
  }
  const comparisonsAtLimit = compareCalls;
  assert.equal(
    await authorize({ email: "admin@example.com", password: "wrong-password" }, request),
    null,
  );
  assert.equal(compareCalls, comparisonsAtLimit);
});

test("admin actions reject short secrets, stale JWTs, demotion and deletion", async () => {
  const secureSecret = process.env.NEXTAUTH_SECRET;
  process.env.NEXTAUTH_SECRET = "too-short";
  assert.equal(await requireAdmin(), null);
  process.env.NEXTAUTH_SECRET = secureSecret;

  assert.equal((await requireAdmin())?.role, "ADMIN");
  account = { ...account, role: "USER" };
  assert.equal(await requireAdmin(), null);
  account = null;
  assert.equal(await requireAdmin(), null);
  session = null;
  assert.equal(await requireAdmin(), null);
});

test("post HTML sanitizer removes script, event handlers, embeds and unsafe URLs", () => {
  const html = sanitizePostContent(
    '<p onclick="alert(1)">Hello <strong>world</strong></p>' +
      '<script>alert(1)</script><iframe src="https://evil.example"></iframe>' +
      '<a href="javascript:alert(1)" target="_blank">unsafe link</a>' +
      '<a href="https://example.com" target="_blank">safe link</a>',
  );

  assert.ok(html.includes("<p>Hello <strong>world</strong></p>"));
  assert.doesNotMatch(html, /script|iframe|onclick|javascript:/i);
  assert.ok(html.includes('href="https://example.com"'));
  assert.ok(html.includes('rel="noopener noreferrer"'));
});

test("rate limits expire and do not expose raw identifiers", () => {
  const key = hashRateLimitIdentifier("registration:test@example.com");
  assert.notEqual(key, "registration:test@example.com");
  assert.equal(checkRateLimit(key, 2, 10_000, 1_000).allowed, true);
  assert.equal(checkRateLimit(key, 2, 10_000, 2_000).allowed, true);
  assert.deepEqual(checkRateLimit(key, 2, 10_000, 3_000), {
    allowed: false,
    retryAfterSeconds: 8,
  });
  assert.equal(checkRateLimit(key, 2, 10_000, 11_000).allowed, true);
  assert.equal(getClientAddress("203.0.113.4, 10.0.0.1"), "203.0.113.4");
});

test("upload checks MIME, extension and bytes; no files are written on failure", async () => {
  const forged = new File(["not a PNG"], "cover.png", { type: "image/png" });
  await assert.rejects(saveCoverUpload(forged, "services"), /Invalid image file/);
  const wrongMime = new File(["not an image"], "cover.png", { type: "text/plain" });
  await assert.rejects(saveCoverUpload(wrongMime, "blog"), /Only PNG/);
  await assert.rejects(saveCoverUpload(forged, "../assets"), /Unknown upload destination/);
});

test("deletion is confined to the expected upload kind and uploader names", async () => {
  const readme = path.join(__dirname, "..", "public", "uploads", "blog", "README.md");
  const before = fs.readFileSync(readme, "utf8");
  await deleteCoverUpload("/uploads/blog/README.md", "blog");
  await deleteCoverUpload("/uploads/services/../../assets/logos/README.md", "services");
  await deleteCoverUpload("/uploads/blog/00000000-0000-0000-0000-000000000000.png", "services");
  assert.equal(fs.readFileSync(readme, "utf8"), before);
});
