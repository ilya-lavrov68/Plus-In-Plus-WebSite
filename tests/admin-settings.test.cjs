const assert = require("node:assert/strict");
const { after, before, beforeEach, test } = require("node:test");
const fs = require("node:fs");
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

let founder;
let database;
let redirects;
let invalidated;

const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === "@/lib/admin-session") {
    return { requireFounder: async () => founder };
  }
  if (name === "next/cache") return { revalidatePath: (url) => invalidated.push(url) };
  if (name === "next/navigation") {
    return {
      redirect: (url) => {
        redirects.push(url);
        const error = new Error(`redirect:${url}`);
        error.digest = `NEXT_REDIRECT;replace;${url};307;`;
        throw error;
      },
    };
  }
  if (name.startsWith("@/")) name = path.resolve(__dirname, "..", name.slice(2));
  return originalLoad.call(this, name, parent, isMain);
};

const { saveSettings } = require("../app/(admin)/admin/settings/actions.ts");
const { saveSiteSettings } = require("../lib/site-settings-write.ts");

const now = () => new Date().toISOString();

function form(fields) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, String(value));
  return data;
}

async function value(key) {
  const [row] = await database.rows(`select value from site_settings where "key" = ?`, [key]);
  return row?.value;
}

before(async () => {
  database = createTestDatabase("pip-settings-");
  await database.ready;
});

beforeEach(async () => {
  await database.exec(`delete from site_settings`);
  await database.exec(`delete from activity_logs`);
  await database.exec(`delete from accounts`);
  await database.exec(
    `insert into accounts (id, email, role, is_blocked, created_at, updated_at) values ('usr-founder', 'f@example.com', 'FOUNDER', 0, ?, ?)`,
    [now(), now()],
  );
  redirects = [];
  invalidated = [];
  founder = { id: "usr-founder", email: "f@example.com", role: "FOUNDER", isFounder: true };
});

after(async () => {
  await database.close();
});

test("only the allowlisted keys are written", async () => {
  const keys = await saveSiteSettings({ studioName: "Plus In Plus", somethingElse: "nope" });
  assert.deepEqual(keys, ["studioName"]);
  assert.equal(await value("studioName"), "Plus In Plus");
  assert.equal(await value("somethingElse"), undefined);
});

test("an empty secret keeps the stored value", async () => {
  await saveSiteSettings({ robokassaPassword1: "secret-1" });
  await saveSiteSettings({ robokassaPassword1: "", robokassaLogin: "pip-shop" });
  assert.equal(await value("robokassaPassword1"), "secret-1", "blank secret input must not erase the key");
  assert.equal(await value("robokassaLogin"), "pip-shop");
});

test("saveSettings refuses to run without a founder", async () => {
  founder = null;
  await saveSettings(form({ studioName: "Hacked" }));
  assert.equal(await value("studioName"), undefined);
  assert.deepEqual(redirects, []);
});

test("saveSettings logs only key names, never values", async () => {
  await assert.rejects(
    () => saveSettings(form({ studioName: "Plus In Plus", robokassaPassword1: "top-secret" })),
    /redirect:\/admin\/settings\?saved=2/,
  );

  const [log] = await database.rows(`select title, action, actor_id_id from activity_logs`);
  assert.equal(log.action, "settings.updated");
  assert.equal(log.actor_id_id, "usr-founder");
  assert.match(log.title, /robokassaPassword1/);
  assert.equal(log.title.includes("top-secret"), false, "secret values never reach the journal");
  assert.ok(invalidated.includes("/admin/settings"));
});

test("too long values are rejected with a message", async () => {
  await assert.rejects(() => saveSiteSettings({ studioDescription: "x".repeat(2001) }), /Слишком длинное/);
  assert.equal(await value("studioDescription"), undefined);
});

test("invalid values are rejected before they reach the database", async () => {
  await assert.rejects(
    () => saveSiteSettings({ contactEmail: "not-an-email" }),
    (error) => error.code === "invalidEmail",
  );
  await assert.rejects(
    () => saveSiteSettings({ vkUrl: "vk.com/plusinplus" }),
    (error) => error.code === "invalidUrl",
  );
  await assert.rejects(
    () => saveSiteSettings({ contactPhone: "позвоните мне" }),
    (error) => error.code === "invalidPhone",
  );
  await assert.rejects(
    () => saveSiteSettings({ robokassaHashAlgo: "sha1" }),
    (error) => error.code === "invalidValue",
  );
  await assert.rejects(
    () => saveSiteSettings({ telegramBotToken: "123:short" }),
    (error) => error.code === "invalidValue",
  );
  assert.equal(await value("contactEmail"), undefined);
});

test("valid values are normalised and stored", async () => {
  const changed = await saveSiteSettings({
    contactEmail: "  hello@plusinplus.ru ",
    vkUrl: "https://vk.com/plusinplus",
    robokassaHashAlgo: "SHA256",
    telegramChatId: "-1001234567890",
  });
  assert.deepEqual(changed.sort(), ["contactEmail", "robokassaHashAlgo", "telegramChatId", "vkUrl"]);
  assert.equal(await value("contactEmail"), "hello@plusinplus.ru");
  assert.equal(await value("robokassaHashAlgo"), "sha256");
  assert.equal(await value("telegramChatId"), "-1001234567890");
});

test("unchanged values are reported as unchanged and not rewritten", async () => {
  await saveSiteSettings({ studioName: "Plus In Plus" });
  const [before] = await database.rows(`select updated_at from site_settings where "key" = 'studioName'`);
  await new Promise((resolve) => setTimeout(resolve, 5));
  const changed = await saveSiteSettings({ studioName: "Plus In Plus" });
  const [after] = await database.rows(`select updated_at from site_settings where "key" = 'studioName'`);
  assert.deepEqual(changed, []);
  assert.equal(after.updated_at, before.updated_at, "the row must stay untouched when nothing changed");
});

test("a secret can be cleared explicitly", async () => {
  await saveSiteSettings({ telegramBotToken: "123456789:AAHfakefakefakefakefakefakefakefake" });
  const changed = await saveSiteSettings({}, { clear: new Set(["telegramBotToken"]) });
  assert.deepEqual(changed, ["telegramBotToken"]);
  assert.equal(await value("telegramBotToken"), undefined);
});

test("saveSettings reports the real number of changed settings", async () => {
  await assert.rejects(
    () => saveSettings(form({ studioName: "Plus In Plus", contactEmail: "hi@plusinplus.ru" })),
    /redirect:\/admin\/settings\?saved=2/,
  );
  await assert.rejects(
    () => saveSettings(form({ studioName: "Plus In Plus", contactEmail: "hi@plusinplus.ru" })),
    /redirect:\/admin\/settings\?saved=0/,
    "a second identical submit must say that nothing changed",
  );
});

test("saveSettings redirects an invalid field back with its code and key", async () => {
  await assert.rejects(
    () => saveSettings(form({ contactEmail: "broken" })),
    /redirect:\/admin\/settings\?error=invalidEmail&field=contactEmail/,
  );
});
