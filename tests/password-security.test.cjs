const assert = require("node:assert/strict");
const { test, afterEach } = require("node:test");
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);

const {
  checkPasswordBreach,
  assertPasswordNotCompromised,
  CompromisedPasswordError,
} = require("../lib/password-breach.ts");
const {
  isCommonPassword,
  passwordCharacterClassCount,
  passwordSchema,
} = require("../lib/validators.ts");

const originalFetch = global.fetch;
const originalEnv = {
  NODE_ENV: process.env.NODE_ENV,
  PIP_HIBP_CHECK: process.env.PIP_HIBP_CHECK,
  PIP_HIBP_REQUIRED: process.env.PIP_HIBP_REQUIRED,
};

afterEach(() => {
  global.fetch = originalFetch;
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function digest(password) {
  return createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
}

test("new passwords require 12+ characters, three character classes and no offline denylist match", () => {
  assert.equal(passwordCharacterClassCount("a-Long-passphrase1"), 4);
  assert.equal(passwordSchema.safeParse("a-Long-passphrase1").success, true);
  assert.equal(passwordSchema.safeParse("Ab1!").success, false, "length still matters");
  assert.equal(passwordSchema.safeParse("a-long-passphrase").success, false, "only two classes");
  assert.equal(passwordSchema.safeParse("Password123!").success, false, "case-insensitive common password");
  assert.equal(isCommonPassword("P@ssw0rd123!"), true);
  assert.equal(passwordSchema.safeParse("St0rong&Unique").success, true);
});

test("HIBP sends only a five-character prefix and detects a breached suffix", async () => {
  const password = "St0rong&Unique";
  const hash = digest(password);
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(`${hash.slice(5)}:42\n00000000000000000000000000000000000:0\n`, { status: 200 });
  };

  assert.equal(await checkPasswordBreach(password, fetcher), "compromised");
  assert.equal(calls.length, 1);
  assert.ok(calls[0].url.endsWith(`/range/${hash.slice(0, 5)}`));
  assert.equal(calls[0].url.includes(hash), false, "the complete hash must not leave the process");
  assert.equal(JSON.stringify(calls).includes(password), false, "the password must not leave the process");
  assert.equal(calls[0].init.body, undefined);
  assert.equal(calls[0].init.headers["Add-Padding"], "true");
});

test("HIBP zero-count padding is clear; network, HTTP and malformed responses are unavailable", async () => {
  const password = "St0rong&Unique";
  const hash = digest(password);
  assert.equal(await checkPasswordBreach(password, async () => new Response(`${hash.slice(5)}:0\n`, { status: 200 })), "clear");
  assert.equal(await checkPasswordBreach(password, async () => new Response("no", { status: 503 })), "unavailable");
  assert.equal(await checkPasswordBreach(password, async () => new Response("not-a-range-response", { status: 200 })), "unavailable");
  assert.equal(await checkPasswordBreach(password, async () => new Response("", { status: 200 })), "unavailable");
  assert.equal(await checkPasswordBreach(password, async () => { throw new Error("offline"); }), "unavailable");
});

test("production fails closed on HIBP outage without logging password material", async () => {
  process.env.NODE_ENV = "production";
  delete process.env.PIP_HIBP_REQUIRED;
  delete process.env.PIP_HIBP_CHECK;
  global.fetch = async () => { throw new Error("offline"); };
  const password = "St0rong&Unique";
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(" "));
  try {
    await assert.rejects(
      () => assertPasswordNotCompromised(password),
      (error) => error instanceof CompromisedPasswordError && error.code === "unavailable",
    );
  } finally {
    console.warn = originalWarn;
  }
  assert.equal(warnings.length, 0, "fail-closed outages do not need a warning with request details");
});

test("non-production outage policy is explicit and disablement is opt-in", async () => {
  process.env.NODE_ENV = "development";
  delete process.env.PIP_HIBP_REQUIRED;
  delete process.env.PIP_HIBP_CHECK;
  global.fetch = async () => { throw new Error("offline"); };
  const originalWarn = console.warn;
  const warnings = [];
  console.warn = (...args) => warnings.push(args.join(" "));
  try {
    await assert.doesNotReject(() => assertPasswordNotCompromised("St0rong&Unique"));
  } finally {
    console.warn = originalWarn;
  }
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].includes("St0rong&Unique"), false);

  process.env.PIP_HIBP_CHECK = "0";
  global.fetch = async () => { throw new Error("must not be called"); };
  await assert.doesNotReject(() => assertPasswordNotCompromised("St0rong&Unique"));
});
