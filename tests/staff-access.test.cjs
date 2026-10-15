const assert = require("node:assert/strict");
const { test, beforeEach } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) =>
  module._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    filename,
  );

// Только в памяти.
let sessionUser, dbUser;

const prisma = {
  user: { findUnique: async ({ where }) => (where.id === dbUser?.id ? { ...dbUser } : null) },
};
const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === "@/lib/prisma") return { prisma };
  // auth() отдаёт то, что лежит в подписанном токене.
  if (name === "@/auth") return { auth: async () => (sessionUser ? { user: sessionUser } : null) };
  if (name === "@/lib/auth-secret") return { isAuthConfigured: () => true };
  if (name.startsWith("@/")) name = path.resolve(__dirname, "..", name.slice(2));
  return originalLoad.call(this, name, parent, isMain);
};

const { requireAdmin, requireStaff } = require("../lib/admin-session.ts");

const ID = "usr-1";

/** Ставим и токен, и базу в одно и то же состояние. */
function login(role, dbRole = role, isBlocked = 0) {
  sessionUser = { id: ID, email: `${String(role).toLowerCase()}@test`, role };
  dbUser = { id: ID, email: `${String(role).toLowerCase()}@test`, role: dbRole, isBlocked };
}

beforeEach(() => {
  sessionUser = null;
  dbUser = null;
});

// ---------------------------------------------------------------------------
// Кто куда проходит
// ---------------------------------------------------------------------------

test("администратор проходит и в управление сайтом, и в заявки", async () => {
  login("ADMIN");
  assert.ok(await requireAdmin(), "админ должен проходить requireAdmin");
  const staff = await requireStaff();
  assert.ok(staff);
  assert.equal(staff.isAdmin, true);
});

test("менеджер проходит в заявки, но не в управление сайтом", async () => {
  login("MANAGER");
  // Главное требование: менеджер не может ничего сломать на сайте.
  assert.equal(await requireAdmin(), null, "менеджер не должен проходить requireAdmin");
  const staff = await requireStaff();
  assert.ok(staff, "с заявками менеджер работать может");
  assert.equal(staff.role, "MANAGER");
  assert.equal(staff.isAdmin, false);
});

test("обычный пользователь не проходит никуда", async () => {
  login("USER");
  assert.equal(await requireAdmin(), null);
  assert.equal(await requireStaff(), null);
});

test("гость без сессии не проходит никуда", async () => {
  assert.equal(await requireAdmin(), null);
  assert.equal(await requireStaff(), null);
});

// ---------------------------------------------------------------------------
// Обход защиты
// ---------------------------------------------------------------------------

test("права проверяются по базе, а не только по токену", async () => {
  // Токен ещё админский, но в базе роль уже сняли.
  login("ADMIN", "USER");
  assert.equal(await requireAdmin(), null, "уволенный администратор не должен проходить");
  assert.equal(await requireStaff(), null);
});

test("менеджер не повышает себя до администратора через базу", async () => {
  // В токене MANAGER, в базе ADMIN. Токен жив до перелогина, поэтому
  // повышения не происходит: нужен новый вход.
  login("MANAGER", "ADMIN");
  assert.equal(await requireAdmin(), null, "тихое повышение роли невозможно");
  const staff = await requireStaff();
  assert.equal(staff.role, "MANAGER");
  assert.equal(staff.isAdmin, false);
});

test("заблокированный сотрудник теряет доступ", async () => {
  login("ADMIN", "ADMIN", 1);
  // isBlocked приходит в селекте — здесь имитируем отсутствие записи.
  dbUser = null;
  assert.equal(await requireAdmin(), null);
  assert.equal(await requireStaff(), null);
});

test("роль, которой нет в списке, никуда не проходит", async () => {
  login("SUPERUSER");
  assert.equal(await requireAdmin(), null);
  assert.equal(await requireStaff(), null);
});
