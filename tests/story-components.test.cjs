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
const scrollProgress = { name: "scroll-progress" };
const router = { refresh: () => undefined };
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
});

test("landing story renders author content without a second JavaScript scroll driver", () => {
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
  assert.equal(scrollCalls.length, 0);

  const progress = view.root.findByProps({ "data-story-progress": "" });
  assert.equal(progress.props.style, undefined);
  assert.match(progress.props.className, /origin-top/);
  assert.match(progress.props.className, /story-timeline-progress/);
  assert.equal(view.root.findAll((node) => node.props.dangerouslySetInnerHTML).length, 0);

  act(() => view.unmount());
});

test("timeline keeps one native spine animation with one-shot connectors and rounded card traces", () => {
  let view;
  act(() => {
    view = create(React.createElement(StoryTimeline, timelineProps({ events: [events[0]] })));
  });

  const progress = view.root.findByProps({ "data-story-progress": "" });
  assert.equal(progress.props.style, undefined);
  assert.equal(scrollCalls.length, 0);
  assert.equal(view.root.findByProps({ "data-story-dot": 0 }).props.style, undefined);
  const momentChildren = view.root.findAllByType("li")[0].children;
  assert.equal(momentChildren[0].type, "article");
  assert.equal(momentChildren[1].type, "svg");
  assert.match(momentChildren[1].props.className, /story-moment-outline/);
  assert.match(momentChildren[1].props.className, /overflow-visible/);
  const outlineRect = momentChildren[1].findByType("rect");
  assert.equal(outlineRect.props.pathLength, 1);
  assert.deepEqual(
    {
      x: outlineRect.props.x,
      y: outlineRect.props.y,
      width: outlineRect.props.width,
      height: outlineRect.props.height,
    },
    { x: "0", y: "0", width: "100%", height: "100%" },
    "the trace follows the card boundary instead of leaving the glass surface outside an inset outline",
  );
  assert.match(momentChildren[2].props.className, /story-moment-connector/);
  assert.match(momentChildren[3].props.className, /story-timeline-marker/);

  const source = fs.readFileSync(
    path.resolve(__dirname, "../components/site/story-timeline.tsx"),
    "utf8",
  );
  assert.doesNotMatch(source, /^"use client"/m);
  assert.doesNotMatch(source, /useScroll|useSpring|useTransform|requestAnimationFrame/);

  const globals = fs.readFileSync(path.resolve(__dirname, "../styles/globals.css"), "utf8");
  assert.match(view.root.findByType("ol").props.className, /story-timeline-track/);
  assert.match(globals, /@supports \(animation-timeline: view\(\)\)/);
  assert.match(globals, /view-timeline-name: --story-track/);
  assert.match(globals, /animation-timeline: --story-track/);
  assert.match(globals, /@keyframes story-line-grow/);
  assert.match(globals, /\.story-timeline-progress \{[^}]*animation: story-line-grow 1s linear both;/);
  assert.match(globals, /animation-range: entry 8% exit 55%/);
  assert.equal((globals.match(/^\s*animation-timeline:/gm) || []).length, 1);
  assert.doesNotMatch(globals, /story-dot-activate/);
  assert.match(globals, /\.story-moment-outline-rect \{[^}]*stroke-dasharray: 1 0;/);
  assert.match(globals, /\[data-reveal="pending"\] ~ \.story-moment-outline \.story-moment-outline-rect \{[^}]*stroke-dasharray: 0 1;/);
  assert.match(globals, /\[data-reveal="pending"\] ~ \.story-moment-connector \{[^}]*transform: scaleX\(0\);/);
  assert.match(globals, /\[data-reveal="pending"\] ~ \.story-timeline-marker \.story-timeline-dot/);
  assert.match(globals, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.story-timeline-progress,[\s\S]*?animation: none !important;[\s\S]*?transition: none !important;/);
  assert.match(globals, /\.story-moment-outline-rect \{[^}]*stroke-dasharray: 1 0 !important;[^}]*transition: none !important;/);
  assert.match(globals, /\.story-card \{[^}]*backdrop-filter: blur\(12px\);[^}]*\}/);
  assert.doesNotMatch(globals, /\.story-card \{[^}]*box-shadow:[^}]*\}/);
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

test("landing order and native protected Story global are explicit", () => {
  const page = fs.readFileSync(path.resolve(__dirname, "../app/(site)/page.tsx"), "utf8");
  // Порядок повторяет главную payloadcms.com.
  const order = ["<PwHero", "<PwMediaContent", "<PwCardGrid", "<PwStatement", "<PlFeatures", "<PlManifesto"];
  let cursor = -1;
  for (const section of order) {
    const index = page.indexOf(section);
    assert.ok(index > cursor, `landing order must keep ${section}`);
    cursor = index;
  }

  const system = fs.readFileSync(path.resolve(__dirname, "../payload/collections/system.ts"), "utf8");
  assert.match(system, /export const Story: GlobalConfig/);
  assert.match(system, /slug: "story"/);
  assert.match(system, /access: \{ read: adminOnly, update: adminOnly \}/);
  assert.match(system, /name: "events",[\s\S]*?type: "array",[\s\S]*?maxRows: 20/);
  assert.equal(fs.existsSync(path.resolve(__dirname, "../components/admin/story-form.tsx")), false);
  assert.equal(fs.existsSync(path.resolve(__dirname, "../lib/admin-data.ts")), false);
});
