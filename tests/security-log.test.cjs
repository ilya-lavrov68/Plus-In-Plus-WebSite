const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);

const { logSecurityEvent, logServerError } = require("../lib/security-log.ts");

test("security events serialize only fixed fields, even with hostile extra properties", () => {
  const output = [];
  const originalWarn = console.warn;
  console.warn = (line) => output.push(line);
  try {
    logSecurityEvent("auth.login.failed", {
      staffMode: true,
      email: "person@example.com",
      password: "do-not-log",
      ip: "203.0.113.10",
    });
  } finally {
    console.warn = originalWarn;
  }
  const event = JSON.parse(output[0]);
  assert.equal(event.event, "auth.login.failed");
  assert.equal(event.staffMode, true);
  assert.equal(output[0].includes("person@example.com"), false);
  assert.equal(output[0].includes("do-not-log"), false);
  assert.equal(output[0].includes("203.0.113.10"), false);
});

test("server errors keep safe provider codes but never messages or stacks", () => {
  const output = [];
  const originalError = console.error;
  console.error = (line) => output.push(line);
  try {
    const error = Object.assign(new Error("query included person@example.com and do-not-log"), { code: "SQLITE_CONSTRAINT_UNIQUE" });
    logServerError("auth.registration.failed", error);
  } finally {
    console.error = originalError;
  }
  const event = JSON.parse(output[0]);
  assert.equal(event.event, "auth.registration.failed");
  assert.equal(event.code, "SQLITE_CONSTRAINT_UNIQUE");
  assert.equal(output[0].includes("person@example.com"), false);
  assert.equal(output[0].includes("do-not-log"), false);
  assert.equal(output[0].includes("query included"), false);
});
