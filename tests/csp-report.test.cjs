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

let events;
let limited;
const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === "@/lib/security-log") {
    return { logSecurityEvent: (event, details) => events.push({ event, ...details }) };
  }
  if (name === "@/lib/rate-limit") {
    return {
      checkRateLimitAsync: async () => limited
        ? { allowed: false, retryAfterSeconds: 12, attempts: 31 }
        : { allowed: true, retryAfterSeconds: 0, attempts: 1 },
      getClientAddress: () => "203.0.113.10",
      hashRateLimitIdentifier: (value) => `hashed:${value.length}`,
      retryAfterHeaders: (seconds) => ({ "Retry-After": String(seconds) }),
    };
  }
  if (name.startsWith("@/")) name = path.resolve(__dirname, "..", name.slice(2));
  return originalLoad.call(this, name, parent, isMain);
};

const route = require("../app/api/security/csp-report/route.ts");

beforeEach(() => {
  events = [];
  limited = false;
});

function reportRequest(body, contentType = "application/csp-report") {
  return new Request("https://example.test/api/security/csp-report", {
    method: "POST",
    headers: { "Content-Type": contentType, "x-real-ip": "203.0.113.10" },
    body: JSON.stringify(body),
  });
}

test("legacy CSP reports retain only an allowlisted directive", async () => {
  const response = await route.POST(reportRequest({
    "csp-report": {
      "document-uri": "https://example.test/private?token=do-not-log",
      "effective-directive": "script-src 'self'",
      "blocked-uri": "https://collector.invalid/steal?cookie=do-not-log",
      "violated-directive": "default-src",
    },
  }));

  assert.equal(response.status, 204);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(events, [{ event: "security.csp.violation", directive: "script-src" }]);
  assert.equal(JSON.stringify(events).includes("do-not-log"), false);
});

test("Reporting API camelCase directives and multiple bodies are supported", async () => {
  const response = await route.POST(reportRequest([
    {
      type: "csp-violation",
      url: "https://example.test/private?token=do-not-log",
      body: { effectiveDirective: "style-src-elem 'self'", blockedURL: "https://evil.invalid/x" },
    },
    {
      type: "content-security-policy",
      body: { violatedDirective: "img-src 'self'", sample: "private sample" },
    },
    { type: "deprecation", body: { effectiveDirective: "connect-src" } },
  ], "application/reports+json"));

  assert.equal(response.status, 204);
  assert.deepEqual(events, [
    { event: "security.csp.violation", directive: "style-src-elem" },
    { event: "security.csp.violation", directive: "img-src" },
  ]);
  assert.equal(JSON.stringify(events).includes("private"), false);
});

test("invalid reports and rate limiting do not create telemetry", async () => {
  const invalid = await route.POST(reportRequest({ hello: "world" }, "application/json"));
  assert.equal(invalid.status, 400);
  assert.equal(events.length, 0);

  limited = true;
  const throttled = await route.POST(reportRequest({
    "csp-report": { "effective-directive": "img-src" },
  }));
  assert.equal(throttled.status, 429);
  assert.equal(throttled.headers.get("retry-after"), "12");
  assert.equal(events.length, 0);
});
