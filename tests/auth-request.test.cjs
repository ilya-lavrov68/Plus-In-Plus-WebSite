const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const ts = require("typescript");
const { NextRequest } = require("next/server");
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText, filename);
const { authRequest } = require("../lib/auth-request.ts");

test("Auth.js gets the public HTTPS preview origin instead of the server bind address", async () => {
  const request = new NextRequest("http://0.0.0.0:3000/api/auth/callback/credentials?test=1", {
    method: "POST", headers: { host: "internal:3000", "x-forwarded-host": "3000-preview.e2b.app", "x-forwarded-proto": "https", "content-type": "application/x-www-form-urlencoded" },
    body: "email=example%40example.com",
  });
  const normalized = authRequest(request);
  assert.equal(normalized.url, "https://3000-preview.e2b.app/api/auth/callback/credentials?test=1");
  assert.equal(normalized.method, "POST");
  assert.equal(await normalized.text(), "email=example%40example.com");
});

test("direct local requests preserve the host, path and scheme", () => {
  const normalized = authRequest(new NextRequest("http://0.0.0.0:3000/api/auth/session", { headers: { host: "localhost:3000" } }));
  assert.equal(normalized.url, "http://localhost:3000/api/auth/session");
});

test("invalid forwarding origins are refused instead of generating unsafe redirects", () => {
  for (const host of ["evil.test/path", "user@evil.test", "evil.test#fragment"]) {
    assert.throws(() => authRequest(new NextRequest("http://0.0.0.0:3000/api/auth/session", { headers: { "x-forwarded-host": host } })), /Invalid authentication origin/);
  }
  assert.throws(() => authRequest(new NextRequest("http://0.0.0.0:3000/api/auth/session", { headers: { host: "public.test", "x-forwarded-proto": "javascript" } })), /Invalid authentication origin/);
});
