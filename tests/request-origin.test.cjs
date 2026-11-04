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

let authCalls;
let signInCalls;
let cookieCalls;
let invoiceCalls;
let limiterCalls;
class AuthError extends Error {}
const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === "next-auth") return { AuthError };
  if (name === "@/auth") return {
    auth: async () => { authCalls += 1; return null; },
    signIn: async () => { signInCalls += 1; },
  };
  if (name === "@/lib/payments/invoice") return {
    issueInvoice: async () => { invoiceCalls += 1; return null; },
  };
  if (name === "@/lib/auth-sessions") return {
    clearRefreshCookies: async () => { cookieCalls += 1; },
    readRefreshCookies: async () => { cookieCalls += 1; return { refreshToken: "", deviceId: "" }; },
  };
  if (name === "@/lib/rate-limit") return {
    checkRateLimitAsync: async () => { limiterCalls += 1; return { allowed: true, retryAfterSeconds: 0, attempts: 1 }; },
    getClientAddress: () => "203.0.113.20",
    hashRateLimitIdentifier: (value) => `hashed:${value.length}`,
    retryAfterHeaders: (seconds) => ({ "Retry-After": String(seconds) }),
  };
  if (name === "@/lib/security-log") return { logServerError: () => {} };
  if (name.startsWith("@/")) name = path.resolve(__dirname, "..", name.slice(2));
  return originalLoad.call(this, name, parent, isMain);
};

const { isSameOriginRequest } = require("../lib/request-origin.ts");
const payment = require("../app/api/payment/create/route.ts");
const refresh = require("../app/api/auth/refresh/route.ts");

beforeEach(() => {
  authCalls = 0;
  signInCalls = 0;
  cookieCalls = 0;
  invoiceCalls = 0;
  limiterCalls = 0;
  delete process.env.AUTH_URL;
  delete process.env.NEXTAUTH_URL;
});

function originRequest(headers = {}) {
  return new Request("https://shop.example.test/api/state", { method: "POST", headers });
}

test("same-origin evidence is precise and missing evidence is not globally allowed", () => {
  assert.equal(isSameOriginRequest(originRequest({ Origin: "https://shop.example.test" })), true);
  assert.equal(isSameOriginRequest(originRequest({ Origin: "https://evil.example" })), false);
  assert.equal(isSameOriginRequest(originRequest({ Origin: "not a URL" })), false);
  assert.equal(isSameOriginRequest(originRequest()), false);
  assert.equal(isSameOriginRequest(originRequest({ "Sec-Fetch-Site": "cross-site" })), false);
  assert.equal(isSameOriginRequest(originRequest({ "Sec-Fetch-Site": "same-origin" })), true);
  assert.equal(isSameOriginRequest(originRequest({ Referer: "https://shop.example.test/cart" })), true);
  assert.equal(isSameOriginRequest(originRequest({ Referer: "https://evil.example/cart" })), false);
});

test("trusted forwarded origin and configured auth origin are accepted", () => {
  assert.equal(isSameOriginRequest(originRequest({
    Origin: "https://public.example",
    "X-Forwarded-Host": "public.example",
    "X-Forwarded-Proto": "https",
  })), true);
  process.env.AUTH_URL = "https://accounts.example/base";
  assert.equal(isSameOriginRequest(originRequest({ Origin: "https://accounts.example" })), true);
});

test("cross-origin payment creation stops before auth, limiter or invoice work", async () => {
  const response = await payment.POST(new Request("https://shop.example.test/api/payment/create", {
    method: "POST",
    headers: { Origin: "https://evil.example", "Content-Type": "application/x-www-form-urlencoded" },
    body: "orderId=order-1",
  }));

  assert.equal(response.status, 403);
  assert.equal(authCalls, 0);
  assert.equal(limiterCalls, 0);
  assert.equal(invoiceCalls, 0);
});

test("cross-origin refresh stops before reading or clearing session cookies", async () => {
  const response = await refresh.POST(new Request("https://shop.example.test/api/auth/refresh", {
    method: "POST",
    headers: { Origin: "https://evil.example" },
  }));

  assert.equal(response.status, 403);
  assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
  assert.equal(signInCalls, 0);
  assert.equal(cookieCalls, 0);
});
