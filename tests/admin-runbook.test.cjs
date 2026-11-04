const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const { createTestDatabase } = require("./helpers/test-db.cjs");

require.extensions[".ts"] = (module, filename) =>
  module._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    filename,
  );

const root = path.resolve(__dirname, "..");
const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name.startsWith("@/")) name = path.resolve(root, name.slice(2));
  return originalLoad.call(this, name, parent, isMain);
};

const { revokeAllAuthSessions, revokeWhere } = require("../lib/auth-session-revoke.ts");

let database;
let directory;

before(async () => {
  database = createTestDatabase("pip-runbook-");
  await database.ready;
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "pip-runbook-cli-"));
});

after(async () => {
  await database.close();
  fs.rmSync(directory, { recursive: true, force: true });
});

async function seedAccountWithSessions(id = "usr-1", email = "person@example.com") {
  const now = new Date().toISOString();
  await database.exec(
    `insert or replace into accounts (id, email, role, is_blocked, created_at, updated_at) values (?, ?, 'USER', 0, ?, ?)`,
    [id, email, now, now],
  );
  for (const sessionId of ["session-a", "session-b"]) {
    await database.exec(
      `insert into auth_sessions (id, user_id_id, role, refresh_hash, device_hash, last_used_at, expires_at, created_at, updated_at)
       values (?, ?, 'USER', ?, 'device', ?, ?, ?, ?)`,
      [sessionId, id, `refresh-${sessionId}`, now, new Date(Date.now() + 86_400_000).toISOString(), now, now],
    );
  }
}

test("revoking sessions needs no request context", async () => {
  await seedAccountWithSessions();
  // Именно это ломалось: модуль отзыва тянул next/headers, и CLI падал на
  // ERR_MODULE_NOT_FOUND ещё до первого SQL-запроса.
  const source = fs.readFileSync(path.join(root, "lib", "auth-session-revoke.ts"), "utf8");
  assert.doesNotMatch(
    source,
    /(?:from|import|require\()\s*["']next\//,
    "the revoke module must stay Next-free",
  );
  const runbook = fs.readFileSync(path.join(root, "scripts", "promote-admin.ts"), "utf8");
  assert.match(runbook, /from "@\/lib\/auth-session-revoke"/, "the runbook imports the Next-free module");

  await revokeAllAuthSessions("usr-1", "role_changed");
  const revoked = await database.rows(
    `select id, revoke_reason from auth_sessions where user_id_id = 'usr-1' order by id`,
  );
  assert.deepEqual(
    revoked.map((row) => row.revoke_reason),
    ["role_changed", "role_changed"],
  );

  // Отзыв остальных сессий сохраняет текущую.
  await database.exec(`update auth_sessions set revoked_at = null, revoke_reason = null`);
  await revokeWhere("usr-1", new Date().toISOString(), "logout", "session-a");
  const [kept] = await database.rows(`select revoked_at from auth_sessions where id = 'session-a'`);
  const [dropped] = await database.rows(`select revoked_at from auth_sessions where id = 'session-b'`);
  assert.equal(kept.revoked_at, null);
  assert.ok(dropped.revoked_at);
});

test("npm run db:promote-admin lists accounts on a fresh database", () => {
  const databaseUrl = `file:${path.join(directory, "runbook.db")}`;
  const env = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    DATABASE_AUTH_TOKEN: "",
    AUTH_SECRET: "runbook-test-secret-at-least-32-characters",
  };

  // Схема накатывается тем же путём, что в CI и в README.
  const migrate = spawnSync(process.execPath, ["scripts/db-migrate.cjs"], { cwd: root, encoding: "utf8", env, timeout: 60_000 });
  assert.equal(migrate.status, 0, migrate.stderr || migrate.stdout);

  const result = spawnSync(process.execPath, ["scripts/run-ts.cjs", "scripts/promote-admin.ts"], {
    cwd: root,
    encoding: "utf8",
    env,
    timeout: 60_000,
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /\[admin\] No accounts yet/, "an empty database is reported, not crashed");
  assert.doesNotMatch(result.stderr, /ERR_MODULE_NOT_FOUND/, "the TypeScript entry point must resolve");
});
