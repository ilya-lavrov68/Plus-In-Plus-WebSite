const assert = require("node:assert/strict");
const { beforeEach, test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const { createNativeModuleMock } = require("./helpers/native-payload-mock.cjs");

require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);

let stored;
let storyQueries;
let audits;
const db = {
  story: {
    findFirst: async (options) => {
      storyQueries.push(structuredClone(options));
      return stored ? structuredClone(stored) : { heading: null, description: null, events: [] };
    },
  },
  activityLog: { create: async ({ data }) => { audits.push(structuredClone(data)); return data; } },
};
const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === "@/lib/payload-native") return createNativeModuleMock(db);
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
const { Story } = require("../payload/collections/system.ts");
const { activityAfterStoryChange } = require("../payload/hooks.ts");

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

beforeEach(() => { stored = null; storyQueries = []; audits = []; });

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

test("public story reads only the native global projection and returns author content", async () => {
  stored = validStory();
  const content = await getStoryContent();
  assert.equal(content.events.length, 2);
  assert.equal(content.events[0].title, "The first milestone");
  assert.deepEqual(storyQueries[0], { select: { heading: true, description: true, events: true } });
  stored = { heading: "Broken", description: null, events: [{ id: "bad", period: "", title: "", description: "" }] };
  assert.deepEqual(await getStoryContent(), createEmptyStoryContent());
  stored = null;
  assert.deepEqual(await getStoryContent(), createEmptyStoryContent());
});

test("Story global excludes guests and managers, while admin updates are audited", async () => {
  const guest = { req: { user: null } };
  const manager = { req: { user: { collection: "accounts", role: "MANAGER" } } };
  const admin = { req: { user: { collection: "accounts", role: "ADMIN" } } };
  for (const actor of [guest, manager]) {
    assert.equal(Story.access.read(actor), false);
    assert.equal(Story.access.update(actor), false);
  }
  assert.equal(Story.access.read(admin), true);
  assert.equal(Story.access.update(admin), true);

  const req = { user: { id: "story-admin" }, payload: db.activityLog ? { create: async (options) => db.activityLog.create(options) } : null };
  await activityAfterStoryChange({ doc: validStory(), req });
  assert.equal(audits.length, 1);
  assert.equal(audits[0].entityId, "story");
  assert.equal(audits[0].actorId, "story-admin");
  await activityAfterStoryChange({ doc: validStory(), req: { ...req, user: null } });
  assert.equal(audits.length, 1);
});
