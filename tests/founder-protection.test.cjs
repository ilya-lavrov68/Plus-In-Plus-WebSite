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

// Только в памяти: пользователи, настройки и журнал действий.
let actor, users, settings, logs, posts;

const db = {
  user: {
    findUnique: async ({ where }) => {
      const row = users.get(where.id);
      return row ? structuredClone(row) : null;
    },
    update: async ({ where, data }) => {
      const row = users.get(where.id);
      if (!row) throw new Error("missing user");
      Object.assign(row, structuredClone(data));
      return structuredClone(row);
    },
  },
  siteSetting: {
    upsert: async ({ where, update, create }) => {
      const value = settings.has(where.key) ? update.value : create.value;
      settings.set(where.key, value);
      return { key: where.key, value };
    },
  },
  post: {
    updateMany: async ({ where = {}, data }) => {
      let count = 0;
      for (const post of posts.values()) {
        if (where.id && post.id !== where.id) continue;
        if (where.isPublished !== undefined && post.isPublished !== where.isPublished) continue;
        if (where.OR && !where.OR.some((condition) =>
          (Object.hasOwn(condition, "publishedAt") && condition.publishedAt === null && post.publishedAt === null) ||
          (condition.publishedAt?.lte && post.publishedAt && post.publishedAt <= condition.publishedAt.lte)
        )) continue;
        Object.assign(post, structuredClone(data));
        count += 1;
      }
      return { count };
    },
  },
  activityLog: {
    create: async ({ data }) => { logs.push(structuredClone(data)); return data; },
  },
  authSession: {
    updateMany: async () => ({ count: 0 }),
  },
  transaction: async (callback) => {
    const snapshot = structuredClone({ settings, posts, logs });
    try { return await callback(db); }
    catch (error) { settings = snapshot.settings; posts = snapshot.posts; logs = snapshot.logs; throw error; }
  },
};

const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === "@/lib/payload-db") return { db };
  // actor описывает вошедшего сотрудника: null, обычный админ или основатель.
  if (name === "@/lib/admin-session") return {
    requireAdmin: async () => (actor ? { ...actor, isFounder: actor.role === "FOUNDER" } : null),
    requireFounder: async () =>
      actor?.role === "FOUNDER" ? { id: actor.id, email: actor.email, role: "FOUNDER", isFounder: true } : null,
    requireStaff: async () => null,
  };
  if (name === "next/cache") return { revalidatePath: () => {} };
  if (name.startsWith("@/")) name = path.resolve(__dirname, "..", name.slice(2));
  return originalLoad.call(this, name, parent, isMain);
};

const { resetUserPassword, setFeaturedPost, toggleUserBlocked, updateSiteSettings, updateUserRole } =
  require("../app/actions/admin.ts");

const FOUNDER_INVULNERABLE = "Action denied. Founder is invulnerable.";

function seed() {
  users = new Map([
    ["u-founder", { id: "u-founder", email: "founder@test", role: "FOUNDER", isBlocked: false, passwordHash: "h" }],
    ["u-admin", { id: "u-admin", email: "admin@test", role: "ADMIN", isBlocked: false, passwordHash: "h" }],
    ["u-user", { id: "u-user", email: "user@test", role: "USER", isBlocked: false, passwordHash: "h" }],
  ]);
  settings = new Map();
  posts = new Map([
    ["post-published", { id: "post-published", isPublished: true, publishedAt: new Date("2026-01-01"), isFeatured: false }],
    ["post-draft", { id: "post-draft", isPublished: false, publishedAt: null, isFeatured: true }],
  ]);
  logs = [];
}

beforeEach(() => {
  seed();
  actor = { id: "u-admin", email: "admin@test", role: "ADMIN" };
});

// ---------------------------------------------------------------------------
// Неуязвимость основателя
// ---------------------------------------------------------------------------

test("роль основателя нельзя изменить из админки — никому", async () => {
  for (const role of ["USER", "MANAGER", "ADMIN"]) {
    const result = await updateUserRole("u-founder", role);
    assert.equal(result.ok, false, `понижение до ${role} должно быть запрещено`);
    assert.equal(result.error, FOUNDER_INVULNERABLE);
  }
  // Даже сам основатель не меняет свою роль через UI.
  actor = { id: "u-founder", email: "founder@test", role: "FOUNDER" };
  const self = await updateUserRole("u-founder", "ADMIN");
  assert.equal(self.ok, false);
  assert.equal(users.get("u-founder").role, "FOUNDER");
});

test("основателя нельзя заблокировать", async () => {
  const result = await toggleUserBlocked("u-founder", true);
  assert.equal(result.ok, false);
  assert.equal(result.error, FOUNDER_INVULNERABLE);
  assert.equal(users.get("u-founder").isBlocked, false);
});

test("block status rejects non-boolean input instead of coercing it", async () => {
  for (const value of ["false", 0, 1, null, undefined, {}, []]) {
    const result = await toggleUserBlocked("u-user", value);
    assert.equal(result.ok, false);
    assert.equal(users.get("u-user").isBlocked, false);
  }
  assert.equal(logs.length, 0);
});

test("основателю нельзя сбросить пароль (это захват аккаунта)", async () => {
  const result = await resetUserPassword("u-founder");
  assert.equal(result.ok, false);
  assert.equal(result.error, FOUNDER_INVULNERABLE);
  assert.equal(result.temporaryPassword, undefined);
  assert.equal(users.get("u-founder").passwordHash, "h", "пароль не тронут");
});

test("роль FOUNDER нельзя выдать через админку", async () => {
  const result = await updateUserRole("u-user", "FOUNDER");
  assert.equal(result.ok, false, "основателя назначает только скрипт с доступом к БД");
  assert.equal(users.get("u-user").role, "USER");
});

// ---------------------------------------------------------------------------
// Назначение менеджеров и админов
// ---------------------------------------------------------------------------

test("админ назначает менеджера и снимает роль обратно", async () => {
  const promoted = await updateUserRole("u-user", "MANAGER");
  assert.equal(promoted.ok, true);
  assert.equal(users.get("u-user").role, "MANAGER");
  assert.ok(logs.some((entry) => entry.action === "role changed to MANAGER"), "действие в журнале");

  const demoted = await updateUserRole("u-user", "USER");
  assert.equal(demoted.ok, true);
  assert.equal(users.get("u-user").role, "USER");
});

test("основатель тоже управляет ролями сотрудников", async () => {
  actor = { id: "u-founder", email: "founder@test", role: "FOUNDER" };
  const result = await updateUserRole("u-user", "ADMIN");
  assert.equal(result.ok, true);
  assert.equal(users.get("u-user").role, "ADMIN");
});

test("обычных пользователей блокировка и сброс пароля по-прежнему работают", async () => {
  const blocked = await toggleUserBlocked("u-user", true);
  assert.equal(blocked.ok, true);
  assert.equal(users.get("u-user").isBlocked, true);

  const reset = await resetUserPassword("u-user");
  assert.equal(reset.ok, true);
  assert.ok(reset.temporaryPassword, "временный пароль выдан");
  assert.notEqual(users.get("u-user").passwordHash, "h");
});

// ---------------------------------------------------------------------------
// Settings — только основатель
// ---------------------------------------------------------------------------

test("настройки сайта (включая ключи Робокассы) сохраняет только основатель", async () => {
  const byAdmin = await updateSiteSettings({ robokassaLogin: "evil-shop" });
  assert.equal(byAdmin.ok, false, "обычный админ не должен менять ключи оплаты");
  assert.equal(settings.has("robokassaLogin"), false);

  actor = { id: "u-founder", email: "founder@test", role: "FOUNDER" };
  const byFounder = await updateSiteSettings({
    robokassaLogin: "my-shop",
    robokassaPassword1: "p1",
    robokassaPassword2: "p2",
    telegramBotToken: "token",
  });
  assert.equal(byFounder.ok, true);
  assert.equal(settings.get("robokassaLogin"), "my-shop");
  assert.equal(settings.get("telegramBotToken"), "token");
});

test("без служебной сессии экшены админки недоступны", async () => {
  actor = null;
  assert.equal((await updateUserRole("u-user", "MANAGER")).ok, false);
  assert.equal((await toggleUserBlocked("u-user", true)).ok, false);
  assert.equal((await updateSiteSettings({ studioName: "X" })).ok, false);
});

test("blank secret fields preserve existing values and unknown settings are rejected", async () => {
  actor = { id: "u-founder", email: "founder@test", role: "FOUNDER" };
  settings.set("robokassaPassword1", "existing-password");
  settings.set("telegramBotToken", "existing-token");
  settings.set("studioName", "Before");
  const preserved = await updateSiteSettings({
    studioName: "After",
    robokassaPassword1: "",
    telegramBotToken: "",
  });
  assert.equal(preserved.ok, true);
  assert.equal(settings.get("studioName"), "After");
  assert.equal(settings.get("robokassaPassword1"), "existing-password");
  assert.equal(settings.get("telegramBotToken"), "existing-token");
  const rejected = await updateSiteSettings({ studioName: "Changed again", unexpectedSecret: "value" });
  assert.equal(rejected.ok, false);
  assert.equal(settings.get("studioName"), "After");
  assert.equal(settings.has("unexpectedSecret"), false);
});

test("dedicated Featured action selects one post and can clear the selection", async () => {
  assert.equal((await setFeaturedPost("post-published")).ok, true);
  assert.equal(posts.get("post-published").isFeatured, true);
  assert.equal(posts.get("post-draft").isFeatured, false);
  assert.equal([...posts.values()].filter((post) => post.isFeatured).length, 1);

  assert.equal((await setFeaturedPost(null)).ok, true);
  assert.equal([...posts.values()].filter((post) => post.isFeatured).length, 0);
});

test("settings and featured selection commit together or roll back together", async () => {
  actor = { id: "u-founder", email: "founder@test", role: "FOUNDER" };
  settings.set("studioName", "Before");
  const failed = await updateSiteSettings({ studioName: "After" }, "post-draft");
  assert.equal(failed.ok, false);
  assert.equal(settings.get("studioName"), "Before");
  assert.equal(posts.get("post-draft").isFeatured, true);
  assert.equal(logs.length, 0);

  const saved = await updateSiteSettings({ studioName: "After" }, "post-published");
  assert.equal(saved.ok, true);
  assert.equal(settings.get("studioName"), "After");
  assert.equal(posts.get("post-published").isFeatured, true);
  assert.equal(posts.get("post-draft").isFeatured, false);
  assert.equal(logs.length, 2);
});
