const assert = require("node:assert/strict");
const { beforeEach, test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const React = require("react");
const { act, create } = require("react-test-renderer");

for (const extension of [".ts", ".tsx"]) {
  require.extensions[extension] = (module, filename) =>
    module._compile(
      ts.transpileModule(fs.readFileSync(filename, "utf8"), {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          jsx: ts.JsxEmit.ReactJSX,
          esModuleInterop: true,
          target: ts.ScriptTarget.ES2022,
        },
      }).outputText,
      filename,
    );
}

let reducedMotion;
let scrollCalls;
let savedPayloads;
let refreshed;
const scrollProgress = { name: "scroll-progress" };
const router = { refresh: () => { refreshed += 1; } };
const tag = (name) => ({ children, ...props }) => React.createElement(name, props, children);

const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === "next-intl") return require("./next-intl-stub.cjs");
  if (name === "next/link") return tag("a");
  if (name === "next/navigation") return { useRouter: () => router };
  if (name === "@/app/actions/story") {
    return {
      updateStoryContent: async (payload) => {
        savedPayloads.push(structuredClone(payload));
        return { ok: true };
      },
    };
  }
  if (name === "@/components/ui/textarea") {
    return { Textarea: React.forwardRef((props, ref) => React.createElement("textarea", { ...props, ref })) };
  }
  if (name === "motion/react") {
    return {
      motion: new Proxy({}, { get: (_target, property) => tag(String(property)) }),
      useReducedMotion: () => reducedMotion,
      useScroll: (options) => {
        scrollCalls.push(options);
        return { scrollYProgress: scrollProgress };
      },
      useSpring: (value) => value,
      useTransform: (_value, input, output) => ({ input, output }),
    };
  }
  if (name.startsWith("@/")) name = path.resolve(__dirname, "..", name.slice(2));
  return originalLoad.call(this, name, parent, isMain);
};

const { StoryTimeline } = require("../components/site/story-timeline.tsx");
const { StoryForm } = require("../components/admin/story-form.tsx");

const labels = {
  eyebrow: "Our story",
  timelineLabel: "Company timeline",
  emptyTitle: "Story coming soon",
  emptyDescription: "Real milestones will appear here.",
};

const events = [
  { id: "origin", period: "2024", title: "A real beginning", description: "Written by the studio." },
  { id: "creation", period: "2025", title: "A real launch", description: "Another author-controlled milestone." },
];

function timelineProps(overrides = {}) {
  return {
    heading: "Our actual story",
    description: "No generated company facts.",
    events,
    labels,
    ...overrides,
  };
}

function textOf(node) {
  return node.children
    .map((child) => ["string", "number"].includes(typeof child) ? String(child) : textOf(child))
    .join("");
}

beforeEach(() => {
  reducedMotion = true;
  scrollCalls = [];
  savedPayloads = [];
  refreshed = 0;
});

test("landing story renders author content with a scroll-driven line and reduced-motion fallback", () => {
  let view;
  act(() => {
    view = create(React.createElement(StoryTimeline, timelineProps()));
  });

  const text = textOf(view.root);
  assert.ok(text.includes("Our actual story"));
  assert.ok(text.includes("A real beginning"));
  assert.ok(text.includes("A real launch"));
  assert.equal(view.root.findAllByType("article").length, 2);
  assert.equal(view.root.findAllByType("span").filter((node) => node.props["data-story-dot"] === 0).length, 1);
  assert.equal(scrollCalls[0].offset[0], "start 80%");
  assert.equal(scrollCalls[0].offset[1], "end 45%");

  const progress = view.root.findByProps({ "data-story-progress": "" });
  assert.equal(progress.props.style.scaleY, 1, "reduced motion shows the complete line immediately");
  assert.match(progress.props.className, /origin-top/);
  assert.match(progress.props.className, /story-timeline-progress/);
  assert.equal(view.root.findAll((node) => node.props.dangerouslySetInnerHTML).length, 0);

  act(() => view.unmount());
});

test("timeline motion uses the actual scroll progress when motion is allowed", () => {
  reducedMotion = false;
  let view;
  act(() => {
    view = create(React.createElement(StoryTimeline, timelineProps({ events: [events[0]] })));
  });

  const progress = view.root.findByProps({ "data-story-progress": "" });
  assert.equal(progress.props.style.scaleY, scrollProgress);
  const dot = view.root.findByProps({ "data-story-dot": 0 });
  assert.deepEqual(dot.props.style.opacity.output, [0.35, 1]);
  assert.deepEqual(dot.props.style.scale.output, [0.7, 1]);

  const globals = fs.readFileSync(path.resolve(__dirname, "../styles/globals.css"), "utf8");
  assert.match(globals, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.story-timeline-progress/);
  assert.match(globals, /\.story-timeline-dot/);
  act(() => view.unmount());
});

test("empty CMS content shows an honest empty state rather than a preset timeline", () => {
  let view;
  act(() => {
    view = create(React.createElement(StoryTimeline, timelineProps({ events: [] })));
  });
  assert.match(textOf(view.root), /Story coming soon/);
  assert.equal(view.root.findAllByType("article").length, 0);
  assert.equal(view.root.findAllByProps({ "data-story-progress": "" }).length, 0);
  act(() => view.unmount());
});

test("admin editor adds, edits, reorders and removes real timeline moments", async () => {
  let view;
  act(() => {
    view = create(React.createElement(StoryForm, {
      initial: { heading: "Studio history", description: "Introduction", events: [] },
    }));
  });

  const addButton = () => view.root.findAllByType("button").find((button) => textOf(button).includes("Add moment"));
  act(() => addButton().props.onClick());
  act(() => addButton().props.onClick());
  assert.equal(view.root.findAllByType("article").length, 2);

  const inputs = view.root.findAllByType("input");
  const textareas = view.root.findAllByType("textarea");
  // First two inputs are the section heading and its two moment period/title fields follow.
  const momentInputs = inputs.filter((input) => input.props.required);
  act(() => {
    momentInputs[0].props.onChange({ target: { value: "2024" } });
    momentInputs[1].props.onChange({ target: { value: "First" } });
    momentInputs[2].props.onChange({ target: { value: "2025" } });
    momentInputs[3].props.onChange({ target: { value: "Second" } });
    textareas[1].props.onChange({ target: { value: "First description" } });
    textareas[2].props.onChange({ target: { value: "Second description" } });
  });

  const moveDown = view.root.findAllByType("button").filter((button) => button.props["aria-label"] === "Move moment down")[0];
  act(() => moveDown.props.onClick());
  assert.deepEqual(
    view.root.findAllByType("input").filter((input) => input.props.required).map((input) => input.props.value),
    ["2025", "Second", "2024", "First"],
    "the second moment moved above the first",
  );

  const removeButtons = view.root.findAllByType("button").filter((button) => button.props["aria-label"] === "Remove moment");
  act(() => removeButtons[1].props.onClick());
  assert.equal(view.root.findAllByType("article").length, 1);

  // Add a second moment again so the saved payload also verifies ordering.
  act(() => addButton().props.onClick());
  const updatedRequired = view.root.findAllByType("input").filter((input) => input.props.required);
  const updatedAreas = view.root.findAllByType("textarea");
  act(() => {
    updatedRequired[2].props.onChange({ target: { value: "2026" } });
    updatedRequired[3].props.onChange({ target: { value: "Third" } });
    updatedAreas[2].props.onChange({ target: { value: "Third description" } });
  });

  await act(async () => {
    await view.root.findByType("form").props.onSubmit({ preventDefault() {} });
  });
  assert.equal(savedPayloads.length, 1);
  assert.equal(savedPayloads[0].heading, "Studio history");
  assert.deepEqual(savedPayloads[0].events.map((event) => [event.period, event.title]), [["2025", "Second"], ["2026", "Third"]]);
  assert.ok(savedPayloads[0].events.every((event) => event.id && event.description));
  assert.equal(refreshed, 1);
  assert.match(textOf(view.root), /Story saved/);

  act(() => view.unmount());
});

test("landing order and protected admin data access are explicit", () => {
  const page = fs.readFileSync(path.resolve(__dirname, "../app/page.tsx"), "utf8");
  const hero = page.indexOf("<Hero />");
  const story = page.indexOf("<Story />");
  const features = page.indexOf("<Features />");
  assert.ok(hero >= 0 && hero < story && story < features, "Hero → Story → Features");

  const adminData = fs.readFileSync(path.resolve(__dirname, "../lib/admin-data.ts"), "utf8");
  assert.match(adminData, /export async function getAdminStoryContent\(\) \{\s*const db = await adminDatabase\(\)/);
  const navigation = fs.readFileSync(path.resolve(__dirname, "../components/admin/admin-nav.tsx"), "utf8");
  assert.match(navigation, /key: "story", href: "\/admin\/story"/);
});
