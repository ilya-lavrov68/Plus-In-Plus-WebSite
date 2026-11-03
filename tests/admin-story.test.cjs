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

let admin;
let database;
let redirects;

const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === "@/lib/admin-session") {
    return { requireAdmin: async () => admin, requireStaff: async () => admin };
  }
  if (name === "next/cache") return { revalidatePath: () => {} };
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

const { saveStoryAction } = require("../app/(admin)/admin/story/actions.ts");
const { saveStory, prepareStory } = require("../lib/story-editor.ts");
const { getStoryContent } = require("../lib/story.ts");

function form(fields) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, String(value));
  return data;
}

before(async () => {
  database = createTestDatabase("pip-story-");
  await database.ready;
});

beforeEach(async () => {
  await database.exec(`delete from story_events`);
  await database.exec(`delete from story`);
  await database.exec(`delete from activity_logs`);
  await database.exec(`delete from accounts`);
  await database.exec(
    `insert into accounts (id, email, role, is_blocked, created_at, updated_at) values ('usr-admin', 'a@example.com', 'ADMIN', 0, datetime('now'), datetime('now'))`,
  );
  admin = { id: "usr-admin", role: "ADMIN", isFounder: false };
  redirects = [];
});

after(async () => {
  await database.close();
});

test("saveStory creates the story row and its milestones in order", async () => {
  await saveStory({
    heading: "С 2014 года",
    description: "Печатаем",
    events: [
      { period: "2014", title: "Открытие", description: "Первая машина" },
      { period: "2020", title: "Рост", description: "Второй цех" },
    ],
  });

  const [story] = await database.rows(`select id, heading from story`);
  assert.equal(story.heading, "С 2014 года");
  const events = await database.rows(`select period, title, "_order" as position from story_events order by "_order"`);
  assert.deepEqual(events.map((event) => event.period), ["2014", "2020"]);
  assert.deepEqual(events.map((event) => Number(event.position)), [1, 2]);

  const publicContent = await getStoryContent();
  assert.equal(publicContent.events.length, 2, "the public page reads the same rows");
});

test("saving again replaces the milestone list instead of appending", async () => {
  await saveStory({ heading: "A", description: "B", events: [{ period: "2014", title: "One", description: "x" }] });
  await saveStory({ heading: "A", description: "B", events: [{ period: "2019", title: "Two", description: "y" }] });

  const events = await database.rows(`select period from story_events order by "_order"`);
  assert.deepEqual(events.map((event) => event.period), ["2019"]);
  const [count] = await database.rows(`select count(*) as total from story`);
  assert.equal(Number(count.total), 1, "a single story document is reused");
});

test("blank form rows are dropped, incomplete ones are rejected", async () => {
  const prepared = prepareStory({
    heading: "A",
    description: "",
    events: [
      { period: "2014", title: "One", description: "x" },
      { period: "", title: "", description: "" },
    ],
  });
  assert.equal(prepared.events.length, 1);

  await assert.rejects(
    () => saveStory({ heading: "A", description: "", events: [{ period: "2014", title: "", description: "" }] }),
    /Проверьте поля/,
  );
  await assert.rejects(
    () => saveStory({ heading: "x".repeat(121), description: "", events: [] }),
    /Проверьте поля/,
  );
});

test("saveStoryAction refuses to run without an admin", async () => {
  admin = null;
  await saveStoryAction(form({ heading: "Скрыто" }));
  const [count] = await database.rows(`select count(*) as total from story`);
  assert.equal(Number(count.total), 0);
  assert.deepEqual(redirects, []);
});

test("saveStoryAction saves, logs and redirects back to the editor", async () => {
  await assert.rejects(
    () =>
      saveStoryAction(
        form({
          heading: "С 2014 года",
          description: "Печатаем",
          "event-0-period": "2014",
          "event-0-title": "Открытие",
          "event-0-description": "Первая машина",
          "event-1-period": "",
          "event-1-title": "",
          "event-1-description": "",
        }),
      ),
    /redirect:\/admin\/story\?saved=1/,
  );

  const [story] = await database.rows(`select heading from story`);
  assert.equal(story.heading, "С 2014 года");
  const [log] = await database.rows(`select action, entity_type, actor_id_id from activity_logs`);
  assert.equal(log.action, "story.updated");
  assert.equal(log.entity_type, "story");
  assert.equal(log.actor_id_id, "usr-admin");
});

test("saveStoryAction rejects an incomplete milestone with a message", async () => {
  await assert.rejects(
    () => saveStoryAction(form({ heading: "A", description: "B", "event-0-period": "2014", "event-0-title": "" })),
    /\/admin\/story\?error=/,
  );
  const [count] = await database.rows(`select count(*) as total from story`);
  assert.equal(Number(count.total), 0, "nothing is written when validation fails");
});
