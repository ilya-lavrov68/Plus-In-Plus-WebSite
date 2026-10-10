const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const React = require("react");
const { act, create } = require("react-test-renderer");

// Transpile local TSX and mock only Next's browser integration, not component logic.
require.extensions[".tsx"] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, filename);
};
require.extensions[".ts"] = require.extensions[".tsx"];
const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === "next/link") return ({ children, ...props }) => React.createElement("a", props, children);
  if (name === "next/image") return (props) => React.createElement("img", props);
  if (name === "@/lib/prisma") return { prisma: null };
  if (name.startsWith("@/")) name = path.resolve(__dirname, "..", name.slice(2));
  return originalLoad.call(this, name, parent, isMain);
};

const { NewsCarousel, AUTOPLAY_INTERVAL } = require("../components/site/news-carousel.tsx");
const { Header } = require("../components/site/header.tsx");
const { CategoryCard } = require("../components/site/category-card.tsx");
const { ServiceCard } = require("../components/site/service-card.tsx");
const { SafeImage } = require("../components/site/safe-image.tsx");
const { createPageMetadata, SITE_URL } = require("../lib/seo.ts");
const { NewsSection } = require("../components/site/news-section.tsx");
const { toNewsItem } = require("../lib/data.ts");
const { default: HomePage } = require("../app/page.tsx");
const { default: ShopPage } = require("../app/shop/page.tsx");
const { default: BlogPage } = require("../app/blog/page.tsx");
const { default: sitemap } = require("../app/sitemap.ts");
const { default: robots } = require("../app/robots.ts");
const { ArrowRight } = require("lucide-react");

function clock() {
  let now = 0;
  let id = 0;
  const frames = new Map();
  const listeners = new Map();
  global.performance = { now: () => now };
  global.requestAnimationFrame = (callback) => { frames.set(++id, callback); return id; };
  global.cancelAnimationFrame = (key) => frames.delete(key);
  global.document = { hidden: false, addEventListener: (name, cb) => listeners.set(name, cb), removeEventListener: (name) => listeners.delete(name) };
  global.window = {
    scrollY: 0,
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    addEventListener: (name, cb) => listeners.set(name, cb),
    removeEventListener: (name) => listeners.delete(name),
  };
  return {
    advance(ms) { now += ms; const callbacks = [...frames.values()]; frames.clear(); act(() => callbacks.forEach((cb) => cb(now))); },
    listeners, frames,
  };
}
const items = [
  { id: "a", title: "First", href: "/news/a" },
  { id: "b", title: "Second", href: "/news/b" },
];
function mountCarousel(data = items) {
  const progress = { style: {} };
  let view;
  act(() => { view = create(React.createElement(NewsCarousel, { items: data, label: "News" }), { createNodeMock: () => progress }); });
  const button = (label) => view.root.findByProps({ "aria-label": label });
  const active = () => view.root.findAllByType("article").findIndex((node) => !node.props["aria-hidden"]);
  return { view, progress, button, active };
}

test("autoplay advances at 7000ms; pause freezes and play resumes the clock", () => {
  const timer = clock();
  const c = mountCarousel();
  timer.advance(3500);
  assert.equal(c.progress.style.transform, "scaleX(0.5)");
  act(() => c.button("Pause autoplay").props.onClick());
  timer.advance(9000);
  assert.equal(c.active(), 0);
  assert.equal(c.progress.style.transform, "scaleX(0.5)");
  act(() => c.button("Start autoplay").props.onClick());
  timer.advance(3500);
  assert.equal(c.active(), 1);
  assert.equal(c.progress.style.transform, "scaleX(0)");
  timer.advance(AUTOPLAY_INTERVAL);
  assert.equal(c.active(), 0);
  act(() => c.view.unmount());
  assert.equal(timer.frames.size, 0);
});

test("arrows and horizontal swipes reset the timer; vertical gestures do not", () => {
  const timer = clock();
  const c = mountCarousel();
  timer.advance(6000);
  act(() => c.button("Next slide").props.onClick());
  assert.equal(c.active(), 1);
  assert.equal(c.progress.style.transform, "scaleX(0)");
  timer.advance(1000);
  assert.equal(c.active(), 1);
  const viewport = c.view.root.findAllByType("div").find((n) => n.props.onTouchStart);
  act(() => {
    viewport.props.onTouchStart({ touches: [{ clientX: 100, clientY: 0 }] });
    viewport.props.onTouchEnd({ changedTouches: [{ clientX: 0, clientY: 5 }] });
  });
  assert.equal(c.active(), 0);
  assert.equal(c.progress.style.transform, "scaleX(0)");
  act(() => {
    viewport.props.onTouchStart({ touches: [{ clientX: 100, clientY: 0 }] });
    viewport.props.onTouchEnd({ changedTouches: [{ clientX: 20, clientY: 150 }] });
  });
  assert.equal(c.active(), 0);
  act(() => c.view.unmount());
});

test("empty and single-item carousels have no autoplay controls", () => {
  const timer = clock();
  const empty = mountCarousel([]);
  assert.equal(empty.view.toJSON(), null);
  act(() => empty.view.unmount());
  const single = mountCarousel(items.slice(0, 1));
  assert.equal(single.view.root.findAllByType("button").length, 0);
  assert.equal(timer.frames.size, 0);
  act(() => single.view.unmount());
});

test("header switches background only above 50px and removes its listener", () => {
  const timer = clock();
  let view;
  act(() => { view = create(React.createElement(Header)); });
  const header = () => view.root.findByType("header").props.className;
  assert.match(header(), /bg-transparent/);
  act(() => { window.scrollY = 50; timer.listeners.get("scroll")(); });
  assert.match(header(), /bg-transparent/);
  act(() => { window.scrollY = 51; timer.listeners.get("scroll")(); });
  assert.match(header(), /bg-white\/95/);
  assert.match(header(), /duration-250 ease-out/);
  act(() => view.unmount());
  assert.equal(timer.listeners.has("scroll"), false);
});

test("category stays static; service image and arrow use 200ms hover motion", () => {
  const category = create(React.createElement(CategoryCard, { title: "Category", icon: ArrowRight }));
  for (const node of category.root.findAll((n) => typeof n.type === "string")) {
    assert.doesNotMatch(node.props.className || "", /hover:|transition|animate-/);
  }
  const service = create(React.createElement(ServiceCard, { title: "Service", href: "/shop/service", imageSrc: "/from-props.png" }));
  const image = service.root.findByType("img");
  assert.equal(image.props.src, "/from-props.png");
  assert.match(image.props.className, /duration-200 ease-out/);
  assert.match(image.props.className, /group-hover:grayscale group-hover:opacity-70/);
  const arrow = service.root.findByType(ArrowRight);
  assert.match(arrow.props.className, /duration-200 ease-out group-hover:rotate-90/);
  category.unmount();
  service.unmount();
});

test("missing upload images are omitted and failed image requests are hidden", () => {
  const empty = create(React.createElement(SafeImage, { src: "", alt: "" }));
  assert.equal(empty.toJSON(), null);
  act(() => empty.unmount());

  let view;
  act(() => {
    view = create(React.createElement(SafeImage, { src: "/uploads/blog/missing.png", alt: "" }));
  });
  const image = view.root.findByType("img");
  act(() => image.props.onError());
  assert.equal(view.toJSON(), null);
  act(() => view.unmount());
});

test("page metadata includes Open Graph and article data", () => {
  const metadata = createPageMetadata({
    title: "Post — Plus In Plus",
    description: "A post summary",
    path: "/blog/post",
    image: "/uploads/blog/cover.png",
    type: "article",
    publishedTime: new Date("2026-10-09T00:00:00.000Z"),
  });

  assert.equal(metadata.title, "Post — Plus In Plus");
  assert.equal(metadata.description, "A post summary");
  assert.equal(metadata.openGraph.type, "article");
  assert.equal(metadata.openGraph.url, new URL("/blog/post", SITE_URL).toString());
  assert.equal(metadata.openGraph.images[0].url, new URL("/uploads/blog/cover.png", SITE_URL).toString());
  assert.equal(metadata.openGraph.publishedTime, "2026-10-09T00:00:00.000Z");
});

test("home, shop, and blog render their empty states without a configured database", async () => {
  const pages = [
    [HomePage, ["No news yet"]],
    [ShopPage, ["No small designs yet", "No large designs yet", "No news yet"]],
    [BlogPage, ["The blog is empty"]],
  ];

  for (const [Page, expectedTitles] of pages) {
    const element = await Page();
    let view;
    act(() => { view = create(element); });
    const titles = view.root.findAllByType("h3").map((node) => node.children.join(""));
    for (const title of expectedTitles) assert.ok(titles.includes(title), `${title} should be visible`);
    act(() => view.unmount());
  }
});

test("sitemap includes the base public pages and robots blocks admin routes", async () => {
  const entries = await sitemap();
  assert.deepEqual(
    entries.map((entry) => new URL(entry.url).pathname),
    ["/", "/shop", "/blog"],
  );

  const rules = robots();
  assert.equal(rules.rules.disallow.includes("/admin/"), true);
  assert.equal(rules.sitemap, new URL("/sitemap.xml", SITE_URL).toString());
});

test("manual navigation while paused resets the indicator without resuming autoplay", () => {
  const timer = clock();
  const c = mountCarousel();
  timer.advance(3000);
  act(() => c.button("Pause autoplay").props.onClick());
  act(() => c.button("Previous slide").props.onClick());
  assert.equal(c.active(), 1);
  assert.equal(c.progress.style.transform, "scaleX(0)");
  timer.advance(9000);
  assert.equal(c.active(), 1);
  act(() => c.button("Start autoplay").props.onClick());
  timer.advance(7000);
  assert.equal(c.active(), 0);
  act(() => c.view.unmount());
});

test("background tabs freeze the clock and visibility restores the remaining time", () => {
  const timer = clock();
  const c = mountCarousel();
  timer.advance(2000);
  act(() => { document.hidden = true; timer.listeners.get("visibilitychange")(); });
  timer.advance(15000);
  assert.equal(c.active(), 0);
  act(() => { document.hidden = false; timer.listeners.get("visibilitychange")(); });
  timer.advance(5000);
  assert.equal(c.active(), 1);
  act(() => c.view.unmount());
  assert.equal(timer.listeners.has("visibilitychange"), false);
});

test("reduced-motion preference disables autoplay but permits explicit play", () => {
  const timer = clock();
  window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
  const c = mountCarousel();
  assert.equal(timer.frames.size, 0);
  act(() => c.button("Start autoplay").props.onClick());
  timer.advance(7000);
  assert.equal(c.active(), 1);
  act(() => c.view.unmount());
});

test("a published post maps to a landing news item and renders its blog link", () => {
  clock();
  const post = {
    id: "post-1",
    title: "Launch day",
    slug: "launch-day",
    excerpt: "We launched the new site.",
    content: "<p>Body</p>",
    coverImage: "/uploads/blog/cover.png",
    readTime: 3,
    source: "Telegram",
    publishedAt: new Date("2026-10-09T00:00:00.000Z"),
  };
  const item = toNewsItem(post);
  assert.equal(item.href, "/blog/launch-day");
  assert.equal(item.source, "telegram");
  assert.equal(item.imageSrc, "/uploads/blog/cover.png");

  let view;
  act(() => { view = create(React.createElement(NewsSection, { items: [item] })); });
  const links = view.root.findAll((node) => node.type === "a" && node.props.href === "/blog/launch-day");
  assert.ok(links.length >= 1, "news card should link to the post");
  const headings = view.root.findAllByType("h3").map((node) => node.findAllByType("a").map((a) => a.children.join("")));
  assert.ok(headings.some((texts) => texts.includes("Launch day")), "post title should be shown");
  act(() => view.unmount());
});
