const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);

const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name.startsWith("@/")) name = path.resolve(__dirname, "..", name.slice(2));
  return originalLoad.call(this, name, parent, isMain);
};

const { Accounts } = require("../payload/collections/accounts.ts");
const { Posts } = require("../payload/collections/posts.ts");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("Payload has no authentication authority: no local strategy and no custom strategies", () => {
  assert.equal(Accounts.auth.disableLocalStrategy, true);
  assert.equal(Accounts.auth.strategies, undefined, "staff sessions come from Auth.js, never from a Payload strategy");
  assert.equal(fs.existsSync(path.join(root, "payload/auth")), false, "the Auth.js→Payload bridge is deleted with the CMS layer");
  assert.equal(fs.existsSync(path.join(root, "payload/components")), false, "the Payload admin UI is deleted too");
  assert.equal(fs.existsSync(path.join(root, "app/(payload)")), false, "the native Payload REST/admin routes are deleted");
});

test("the staff gate resolves roles from our own accounts table on every request", () => {
  const source = read("lib/admin-session.ts");
  assert.match(source, /from accounts where id = \?/);
  assert.match(source, /is_blocked === 1/);
  assert.equal(source.includes("payload"), false, "guards never consult the CMS layer");
});

test("credentials never look up accounts through Payload", () => {
  for (const file of ["lib/credentials.ts", "lib/pending-login.ts", "app/actions/auth.ts", "app/actions/mfa.ts", "app/actions/user.ts", "app/actions/account.ts", "auth.ts"]) {
    assert.equal(read(file).includes("payload-native"), false, `${file} must use the SQL layer`);
    assert.equal(read(file).includes("payload/payload-types"), false, `${file} must not depend on generated CMS types`);
  }
});

test("Payload collections deny public and password access and keep managers out of content and accounts", () => {
  assert.equal(Accounts.access.create(), false);
  const guest = { req: { user: null } };
  const manager = { req: { user: { collection: "accounts", role: "MANAGER" } } };
  const admin = { req: { user: { collection: "accounts", role: "ADMIN" } } };
  assert.equal(Accounts.access.read(guest), false);
  assert.equal(Accounts.access.read(manager), false);
  assert.equal(Accounts.access.read(admin), true);
  for (const operation of ["read", "create", "update", "delete"]) {
    assert.equal(Posts.access[operation](guest), false);
    assert.equal(Posts.access[operation](manager), false);
    assert.equal(Posts.access[operation](admin), true);
  }
});
