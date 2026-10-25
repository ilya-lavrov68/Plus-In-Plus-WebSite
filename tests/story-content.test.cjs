const assert = require("node:assert/strict");
const { beforeEach, test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
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
    filename,
  );

let admin;
let stored;
let audits;
let revalidated;
let storyQueries;
let failAudit;

const prisma = {
  siteSetting: {
    upsert: async ({ where, update, create }) => {
      stored.set(where.key, stored.has(where.key) ? update.value : create.value);
      return { key: where.key, value: stored.get(where.key) };
    },
    findUnique: async (query) => {
      storyQueries.push(structuredClone(query));
      const value = stored.get(query.where.key);
      return value === undefined ? null : { value };
    },
  },
  activityLog: {
    create: async ({ data }) => {
      if (failAudit) throw new Error("simulated audit failure");
      audits.push(structuredClone(data));
      return data;
    },
  },
  $transaction: async (callback) => {
    const storedSnapshot = new Map(stored);
    const auditSnapshot = [...audits];
    try {
      return await callback(prisma);
    } catch (error) {
      stored = storedSnapshot;
      audits = auditSnapshot;
      throw error;
    }
  },
};

const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === "@/lib/prisma") return { prisma };
  if (name === "@/lib/admin-session") {
    return {
      requireAdmin: async () =>
        admin && (admin.role === "ADMIN" || admin.role === "FOUNDER") ? admin : null,
    };
  }
  if (name === "@/lib/action-i18n") {
    return { getActionTranslator: async () => (key) => key };
  }
  if (name === "next/cache") {
    return { revalidatePath: (path) => revalidated.push(path) };
  }
  if (name.startsWith("@/")) name = path.resolve(__dirname, "..", name.slice(2));
  return originalLoad.call(this, name, parent, isMain);
};

const {
  createEmptyStoryContent,
  normalizeStoryContent,
  parseStoredStoryContent,
  STORY_CONTENT_LIMITS,
  STORY_SETTING_KEY,
} = require("../lib/story-content.ts");
const { updateStoryContent } = require("../app/actions/story.ts");
const { getStoryContent } = require("../lib/story.ts");

function validStory() {
  return {
    heading: "  Our real history  ",
    description: "  Written by the studio.  ",
    events: [
      {
        id: "origin",
        period: "  2024  ",
        title: "  The first milestone  ",
        description: "  An author-controlled account.  ",
      },
      {
        id: "next",
        period: "2025",
        title: "The next milestone",
        description: "Another real event.",
      },
    ],
  };
}

beforeEach(() => {
  admin = { id: "story-admin", role: "ADMIN" };
  stored = new Map();
  audits = [];
  revalidated = [];
  storyQueries = [];
  failAudit = false;
});

test("story content is trimmed and strictly validated, including limits and unique IDs", () => {
  const normalized = normalizeStoryContent(validStory());
  assert.equal(normalized.heading, "Our real history");
  assert.equal(normalized.description, "Written by the studio.");
  assert.equal(normalized.events[0].period, "2024");
  assert.equal(normalized.events[0].title, "The first milestone");

  assert.equal(normalizeStoryContent({ ...validStory(), unexpected: true }), null);
  assert.equal(
    normalizeStoryContent({
      ...validStory(),
      events: [{ id: "duplicate", period: "2024", title: "One", description: "One" }, { id: "duplicate", period: "2025", title: "Two", description: "Two" }],
    }),
    null,
  );
  assert.equal(
    normalizeStoryContent({
      ...validStory(),
      events: Array.from({ length: STORY_CONTENT_LIMITS.events + 1 }, (_, index) => ({
        id: `event-${index}`,
        period: "2026",
        title: "Title",
        description: "Description",
      })),
    }),
    null,
  );
  assert.equal(
    normalizeStoryContent({
      ...validStory(),
      events: [{ id: "empty", period: "", title: "", description: "" }],
    }),
    null,
  );
});

test("missing or malformed CMS content fails closed without fabricated milestones", () => {
  assert.deepEqual(parseStoredStoryContent(null), createEmptyStoryContent());
  assert.deepEqual(parseStoredStoryContent("not-json"), createEmptyStoryContent());
  assert.deepEqual(parseStoredStoryContent(JSON.stringify({ heading: "Incomplete" })), createEmptyStoryContent());

  const storedStory = validStory();
  storedStory.events[0].description = "<img src=x onerror=alert(1)>";
  const parsed = parseStoredStoryContent(JSON.stringify(storedStory));
  assert.equal(parsed.events[0].description, storedStory.events[0].description, "text stays data, never HTML");
  assert.deepEqual(createEmptyStoryContent().events, []);
});

test("story updates reject guests and managers before any write", async () => {
  for (const actor of [null, { id: "manager", role: "MANAGER" }, { id: "user", role: "USER" }]) {
    admin = actor;
    const result = await updateStoryContent(validStory());
    assert.equal(result.ok, false);
    assert.equal(result.error, "unauthorized");
  }
  assert.equal(stored.size, 0);
  assert.equal(audits.length, 0);
  assert.equal(revalidated.length, 0);
});

test("story updates reject invalid content without writing", async () => {
  const result = await updateStoryContent({ heading: "No events field" });
  assert.deepEqual(result, { ok: false, error: "invalidStory" });
  assert.equal(stored.size, 0);
  assert.equal(audits.length, 0);
});

test("story updates preserve author order, use the existing settings table, audit and revalidate", async () => {
  const result = await updateStoryContent(validStory());
  assert.deepEqual(result, { ok: true });
  assert.equal(stored.size, 1);
  const saved = parseStoredStoryContent(stored.get(STORY_SETTING_KEY));
  assert.deepEqual(saved.events.map((event) => event.id), ["origin", "next"]);
  assert.equal(saved.heading, "Our real history");
  assert.equal(audits.length, 1);
  assert.equal(audits[0].actorId, "story-admin");
  assert.equal(audits[0].entityId, STORY_SETTING_KEY);
  assert.deepEqual(revalidated, ["/", "/admin/story"]);
});

test("a failed story audit rolls back the content write", async () => {
  failAudit = true;
  const originalError = console.error;
  console.error = () => {};
  try {
    const result = await updateStoryContent(validStory());
    assert.deepEqual(result, { ok: false, error: "storySaveFailed" });
  } finally {
    console.error = originalError;
  }
  assert.equal(stored.size, 0);
  assert.equal(audits.length, 0);
  assert.equal(revalidated.length, 0);
});

test("public story loading selects only its own setting and returns database content", async () => {
  stored.set(STORY_SETTING_KEY, JSON.stringify(validStory()));
  stored.set("robokassaPassword1", "must-not-leak");

  const content = await getStoryContent();
  assert.equal(content.events.length, 2);
  assert.equal(content.events[0].title, "The first milestone");
  assert.equal(JSON.stringify(content).includes("must-not-leak"), false);
  assert.deepEqual(storyQueries[0], {
    where: { key: STORY_SETTING_KEY },
    select: { value: true },
  });

  stored.set(STORY_SETTING_KEY, "broken-json");
  assert.deepEqual(await getStoryContent(), createEmptyStoryContent());
});
