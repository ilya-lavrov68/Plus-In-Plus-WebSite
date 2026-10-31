const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const Module = require("node:module");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) =>
  module._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        esModuleInterop: true,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    filename
  );

let staff = null;
const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === "@/lib/admin-session") {
    return { requireAdmin: async () => staff };
  }
  return originalLoad.call(this, name, parent, isMain);
};

const {
  authenticateAuthJsStaff,
} = require("../payload/auth/authjs-strategy.ts");
const { PayloadUsers } = require("../payload/collections/payload-users.ts");
const { Posts } = require("../payload/collections/posts.ts");

const timestamps = { updatedAt: "2026-10-31T00:00:00.000Z", createdAt: "2026-10-31T00:00:00.000Z" };

function payloadStub(existing = null) {
  const calls = [];
  return {
    calls,
    find: async (args) => {
      calls.push(["find", args]);
      return { docs: existing ? [existing] : [] };
    },
    create: async (args) => {
      calls.push(["create", args]);
      return { id: 1, ...args.data, ...timestamps };
    },
    update: async (args) => {
      calls.push(["update", args]);
      return { ...existing, ...args.data, ...timestamps };
    },
  };
}

test("Payload Auth.js strategy returns no user and performs no CMS query for a guest", async () => {
  staff = null;
  const result = await authenticateAuthJsStaff({
    payload: {
      find: async () => {
        throw new Error("guest must not query CMS");
      },
    },
  });
  assert.equal(result.user, null);
});

test("Payload strategy provisions a passwordless shadow identity for an administrator", async () => {
  staff = { id: "authjs-admin", email: "admin@example.test", role: "ADMIN", isFounder: false };
  const payload = payloadStub();
  const result = await authenticateAuthJsStaff({ payload });

  assert.equal(result.user.collection, "payload-users");
  assert.equal(result.user.id, 1);
  assert.equal(result.user.email, "admin@example.test");
  assert.equal(result.user._strategy, "authjs-staff");
  const create = payload.calls.find(([name]) => name === "create")[1];
  assert.deepEqual(create.data, {
    authJsId: "authjs-admin",
    email: "admin@example.test",
    role: "ADMIN",
  });
  assert.equal("password" in create.data, false);
  assert.equal(create.overrideAccess, true);
});

test("Payload strategy refreshes email and effective founder role on every request", async () => {
  staff = { id: "authjs-founder", email: "founder@example.test", role: "FOUNDER", isFounder: true };
  const payload = payloadStub({
    id: 7,
    authJsId: "authjs-founder",
    email: "old@example.test",
    role: "ADMIN",
    ...timestamps,
  });
  const result = await authenticateAuthJsStaff({ payload });

  const update = payload.calls.find(([name]) => name === "update")[1];
  assert.equal(update.id, 7);
  assert.deepEqual(update.data, { email: "founder@example.test", role: "FOUNDER" });
  assert.equal(result.user.role, "FOUNDER");
});

test("Payload collections deny public access and local password/user administration", () => {
  assert.equal(PayloadUsers.auth.disableLocalStrategy, true);
  assert.equal(PayloadUsers.access.create(), false);
  assert.equal(PayloadUsers.access.update(), false);
  assert.equal(PayloadUsers.access.delete(), false);
  assert.equal(PayloadUsers.access.read({ req: { user: null } }), false);
  assert.equal(
    PayloadUsers.access.read({ req: { user: { collection: "payload-users" } } }),
    true
  );

  for (const operation of ["read", "create", "update", "delete"]) {
    assert.equal(Posts.access[operation]({ req: { user: null } }), false);
    assert.equal(
      Posts.access[operation]({ req: { user: { collection: "payload-users" } } }),
      true
    );
  }
});
