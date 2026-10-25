const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => {
  module._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    filename
  );
};

const {
  buildContentSecurityPolicy,
  createNonce,
  cspHeaderName,
  cspMode,
  defaultFrameAncestors,
  staticSecurityHeaders,
} = require("../lib/security-headers.ts");

const directivesOf = (policy) =>
  Object.fromEntries(policy.split("; ").map((part) => [part.split(" ")[0], part.split(" ").slice(1)]));

test("the policy locks the site down to its own origin", () => {
  const policy = directivesOf(buildContentSecurityPolicy({ nonce: "abc123", production: true }));

  assert.deepEqual(policy["default-src"], ["'self'"]);
  assert.deepEqual(policy["object-src"], ["'none'"]);
  assert.deepEqual(policy["base-uri"], ["'self'"]);
  assert.deepEqual(policy["form-action"], ["'self'"]);
  assert.deepEqual(policy["img-src"], ["'self'", "data:", "blob:"]);
  assert.deepEqual(policy["connect-src"], ["'self'"]);
  assert.deepEqual(policy["frame-ancestors"], ["'none'"]);
  assert.deepEqual(policy["frame-src"], ["https://www.canva.com", "https://canva.com"]);
  assert.equal(policy["script-src"].some((source) => source.includes("canva")), false);
  assert.ok(policy["upgrade-insecure-requests"] !== undefined, "production upgrades http subresources");
  assert.deepEqual(policy["report-uri"], ["/api/security/csp-report"]);
  assert.deepEqual(policy["report-to"], ["csp-endpoint"]);
});

test("scripts need the per-request nonce and nothing else in production", () => {
  const nonce = createNonce();
  const policy = directivesOf(buildContentSecurityPolicy({ nonce, production: true }));

  assert.deepEqual(policy["script-src"], ["'self'", `'nonce-${nonce}'`]);
  assert.ok(
    !policy["script-src"].includes("'unsafe-inline'") && !policy["script-src"].includes("'unsafe-eval'"),
    "an inline-script allowance would make the CSP worthless"
  );
  // React and the TipTap editor set style attributes, so styles stay permissive.
  assert.deepEqual(policy["style-src"], ["'self'", "'unsafe-inline'"]);
});

test("development keeps the webpack eval and the preview frame working", () => {
  const policy = directivesOf(buildContentSecurityPolicy({ nonce: "dev-nonce", production: false }));

  assert.ok(policy["script-src"].includes("'unsafe-eval'"), "the dev bundler evaluates modules");
  assert.ok(policy["connect-src"].includes("ws:"), "hot reload uses a websocket");
  assert.deepEqual(policy["frame-ancestors"], ["'self'", "*.e2b.app"]);
  assert.ok(policy["upgrade-insecure-requests"] === undefined);
});

test("each request gets its own nonce", () => {
  const nonces = new Set(Array.from({ length: 200 }, () => createNonce()));

  assert.equal(nonces.size, 200, "nonces must not repeat");
  for (const nonce of nonces) {
    assert.match(nonce, /^[A-Za-z0-9+/=]+$/);
    assert.ok(nonce.length >= 22, `nonce "${nonce}" is too short to be unpredictable`);
  }
});

test("the policy mode is read from PIP_CSP and maps to a header", () => {
  assert.equal(cspMode(undefined), "enforce");
  assert.equal(cspMode(""), "enforce");
  assert.equal(cspMode("report-only"), "report-only");
  assert.equal(cspMode("REPORT"), "report-only");
  assert.equal(cspMode("off"), "off");
  assert.equal(cspMode("0"), "off");
  assert.equal(cspMode("off", true), "enforce", "production cannot disable CSP");
  assert.equal(cspMode("0", true), "enforce");

  assert.equal(cspHeaderName("enforce"), "content-security-policy");
  assert.equal(cspHeaderName("report-only"), "content-security-policy-report-only");
  assert.equal(cspHeaderName("off"), null);

  assert.deepEqual(defaultFrameAncestors(true), ["'none'"]);
  assert.deepEqual(defaultFrameAncestors(false), ["'self'", "*.e2b.app"]);
});

test("the static headers are sent everywhere, framing denial only in production", () => {
  const production = staticSecurityHeaders(true);
  const development = staticSecurityHeaders(false);

  assert.equal(production["X-Content-Type-Options"], "nosniff");
  assert.equal(production["Referrer-Policy"], "strict-origin-when-cross-origin");
  assert.match(production["Permissions-Policy"], /camera=\(\)/);
  assert.equal(production["X-Frame-Options"], "DENY");
  assert.equal(production["X-XSS-Protection"], "0");
  assert.equal(production["Reporting-Endpoints"], "csp-endpoint=\"/api/security/csp-report\"");
  assert.equal(production["Strict-Transport-Security"], "max-age=31536000; includeSubDomains");
  assert.equal(development["Strict-Transport-Security"], undefined);
  assert.equal(development["X-XSS-Protection"], "0");
  // Development must stay embeddable, otherwise the live preview shows a blank frame.
  assert.equal(development["X-Frame-Options"], undefined);
});
