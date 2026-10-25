const assert = require("node:assert/strict");
const { test, beforeEach } = require("node:test");
const fs = require("node:fs");
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

const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === "next/headers") return { headers: async () => new Headers() };
  return originalLoad.call(this, name, parent, isMain);
};

const { resolveWebAuthnConfig } = require("../lib/webauthn-config.ts");

beforeEach(() => {
  process.env.NODE_ENV = "production";
  delete process.env.WEBAUTHN_ORIGIN;
  delete process.env.WEBAUTHN_RP_ID;
});

test("production passkeys require explicit origin and RP ID", () => {
  assert.throws(() => resolveWebAuthnConfig("https://shop.example.test"), /WEBAUTHN_ORIGIN/);
  process.env.WEBAUTHN_ORIGIN = "https://shop.example.test";
  assert.throws(() => resolveWebAuthnConfig("https://shop.example.test"), /WEBAUTHN_RP_ID/);
});

test("production passkeys reject insecure origins and unrelated RP IDs", () => {
  process.env.WEBAUTHN_ORIGIN = "http://shop.example.test";
  process.env.WEBAUTHN_RP_ID = "shop.example.test";
  assert.throws(() => resolveWebAuthnConfig("https://shop.example.test"), /HTTPS/);

  process.env.WEBAUTHN_ORIGIN = "https://shop.example.test";
  process.env.WEBAUTHN_RP_ID = "unrelated.example";
  assert.throws(() => resolveWebAuthnConfig("https://shop.example.test"), /parent domain/);
});

test("a valid parent-domain RP ID is normalized without trusting request origin", () => {
  process.env.WEBAUTHN_ORIGIN = "https://shop.example.test/some/path?ignored=true";
  process.env.WEBAUTHN_RP_ID = "EXAMPLE.TEST";
  assert.deepEqual(resolveWebAuthnConfig("https://attacker.invalid"), {
    origin: "https://shop.example.test",
    rpID: "example.test",
  });
});

test("development may derive loopback HTTP config but rejects malformed RP IDs", () => {
  process.env.NODE_ENV = "development";
  assert.deepEqual(resolveWebAuthnConfig("http://localhost:3000/login"), {
    origin: "http://localhost:3000",
    rpID: "localhost",
  });

  process.env.WEBAUTHN_ORIGIN = "https://shop.example.test";
  process.env.WEBAUTHN_RP_ID = "bad..example";
  assert.throws(() => resolveWebAuthnConfig("http://localhost:3000"), /Invalid WEBAUTHN_RP_ID/);
});
