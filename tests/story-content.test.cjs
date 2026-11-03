const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const { after, before } = require("node:test");
const { createTestDatabase } = require("./helpers/test-db.cjs");

require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);

let database;
const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name.startsWith("@/")) name = path.resolve(__dirname, "..", name.slice(2));
  return originalLoad.call(this, name, parent, isMain);
};

const {
  createEmptyStoryContent,
  normalizeStoryContent,
  parseStoredStoryContent,
  STORY_CONTENT_LIMITS,
} = require("../lib/story-content.ts");
const { getStoryContent } = require("../lib/story.ts");

function validStory() {
  return {
    heading: "  Our real history  ",
    description: "  Written by the studio.  ",
    events: [
      { id: "origin", period: "  2024  ", title: "  The first milestone  ", description: "  An author-controlled account.  " },
      { id: "next", period: "2025", title: "The next milestone", description: "Another real event." },
    ],
  };
}

before(async () => {
  database = createTestDatabase("pip-story-");
  await database.ready;
});

after(async () => {
  await database?.close();
});

test("story content is trimmed and strictly validated, including limits and unique IDs", () => {
  const normalized = normalizeStoryContent(validStory());
  assert.equal(normalized.heading, "Our real history");
  assert.equal(normalized.description, "Written by the studio.");
  assert.equal(normalized.events[0].period, "2024");
  assert.equal(normalized.events[0].title, "The first milestone");
  assert.equal(normalizeStoryContent({ ...validStory(), unexpected: true }), null);
  assert.equal(normalizeStoryContent({
    ...validStory(),
    events: [{ id: "duplicate", period: "2024", title: "One", description: "One" }, { id: "duplicate", period: "2025", title: "Two", description: "Two" }],
  }), null);
  assert.equal(normalizeStoryContent({
    ...validStory(),
    events: Array.from({ length: STORY_CONTENT_LIMITS.events + 1 }, (_, index) => ({ id: `event-${index}`, period: "2026", title: "Title", description: "Description" })),
  }), null);
  assert.equal(normalizeStoryContent({ ...validStory(), events: [{ id: "empty", period: "", title: "", description: "" }] }), null);
});

test("missing or malformed legacy content fails closed without fabricated milestones", () => {
  assert.deepEqual(parseStoredStoryContent(null), createEmptyStoryContent());
  assert.deepEqual(parseStoredStoryContent("not-json"), createEmptyStoryContent());
  assert.deepEqual(parseStoredStoryContent(JSON.stringify({ heading: "Incomplete" })), createEmptyStoryContent());
  const storedStory = validStory();
  storedStory.events[0].description = "<img src=x onerror=alert(1)>";
  const parsed = parseStoredStoryContent(JSON.stringify(storedStory));
  assert.equal(parsed.events[0].description, storedStory.events[0].description, "text stays data, never HTML");
  assert.deepEqual(createEmptyStoryContent().events, []);
});

test("public story reads the story tables and returns author content", async () => {
  await database.exec("delete from story_events");
  await database.exec("delete from story");
  assert.deepEqual(await getStoryContent(), createEmptyStoryContent(), "no rows means an honest empty state");

  const now = new Date().toISOString();
  await database.exec("insert into story (id, heading, description, created_at, updated_at) values ('story-1', ?, ?, ?, ?)", [
    "Our real history",
    "Written by the studio.",
    now,
    now,
  ]);
  const stored = validStory();
  let order = 0;
  for (const event of stored.events) {
    await database.exec(
      "insert into story_events (_order, _parent_id, id, period, title, description) values (?, 'story-1', ?, ?, ?, ?)",
      [order++, `ev-${event.id}`, event.period, event.title, event.description],
    );
  }

  const content = await getStoryContent();
  assert.equal(content.heading, "Our real history");
  assert.equal(content.events.length, 2);
  assert.equal(content.events[0].title, "The first milestone");

  // Испорченные данные не превращаются в выдуманную хронологию.
  await database.exec("update story_events set period = '' where id = 'ev-origin'");
  assert.deepEqual(await getStoryContent(), createEmptyStoryContent());
});

test("the story is read-only for the application and has no CMS editor", () => {
  const root = path.resolve(__dirname, "..");
  const offenders = [];
  const walk = (relative) => {
    for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
      const next = path.join(relative, entry.name);
      if (entry.isDirectory()) walk(next);
      else if (/\.(ts|tsx)$/.test(entry.name) && /(insert into|update|delete from)\s+story/i.test(fs.readFileSync(path.join(root, next), "utf8"))) {
        offenders.push(next);
      }
    }
  };
  for (const directory of ["app", "lib"]) walk(directory);
  assert.deepEqual(offenders, [], "the landing story is authored in the database, not in the app");
  assert.equal(fs.existsSync(path.join(root, "components", "admin", "story-form.tsx")), false);
  assert.equal(fs.existsSync(path.join(root, "payload", "collections", "system.ts")), false);
});
