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
  if (name === "next-auth/react") return { useSession: () => ({ data: null, status: "unauthenticated" }) };
  if (name === "@/app/actions/auth") return {};
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
const { ArrowRight, ChevronDown } = require("lucide-react");
const content = (node) => {
  const children = Array.isArray(node) ? node : node?.children ?? [];
  return (Array.isArray(children) ? children : [])
    .map((child) => typeof child === "string" ? child : child && typeof child === "object" && child.children ? content(child) : "")
    .join("");
};

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

test("header navigation dropdowns open on hover (group-hover), never on click", () => {
  const timer = clock();
  let view;
  act(() => { view = create(React.createElement(Header)); });
  const groups = view.root.findAll((node) => typeof node.props?.className === "string" && node.props.className.includes("group relative"));
  // FOR PLAY, SHOP, ABOUT PIP, SOCNET.
  assert.equal(groups.length, 4);

  for (const item of ["FOR PLAY", "SHOP", "ABOUT PIP", "SOCNET"]) {
    const group = view.root.findAll((node) => typeof node.props?.className === "string" && node.props.className.includes("group relative"))
      .find((node) => node.findAll((child) => child.type === "button" && content(child).startsWith(item)).length === 1);
    assert.ok(group, `${item} dropdown is missing`);

    // The trigger is a plain button with no click handler (no Radix, no onClick toggle).
    const trigger = group.findAllByType("button")[0];
    assert.equal(trigger.props.onClick, undefined);
    assert.equal(trigger.props["aria-haspopup"], "true");
    // Clicking it must not reveal the menu: only CSS hover/focus does.
    const panel = group.findAll((node) => typeof node.props?.className === "string" && node.props.className.includes("min-w-[200px]"))[0];
    assert.ok(panel);
    assert.match(panel.props.className, /invisible/);
    assert.match(panel.props.className, /opacity-0/);
    assert.match(panel.props.className, /group-hover:visible/);
    assert.match(panel.props.className, /group-hover:opacity-100/);
    assert.match(panel.props.className, /bg-white/);
    assert.match(panel.props.className, /border-gray-200/);
    assert.match(panel.props.className, /shadow-lg/);
    assert.match(panel.props.className, /rounded-xl/);
    // ~200ms grace period before the panel hides, so the cursor can move into it.
    assert.match(panel.props.className, /delay-200/);
    assert.match(panel.props.className, /group-hover:delay-0/);
    // Chevron rotates 180deg while hovering the group.
    assert.match(group.findAllByType(ChevronDown)[0].props.className, /transition-transform/);
    assert.match(group.findAllByType(ChevronDown)[0].props.className, /group-hover:rotate-180/);
  }

  // SHOP links to the real services and SOCNET to the social profiles.
  const shop = view.root.findAll((node) => typeof node.props?.className === "string" && node.props.className.includes("group relative"))[1];
  assert.deepEqual(shop.findAllByType("a").map((node) => content(node)), [
    "Sign Design", "Bag Design", "Outdoor glass poster", "Banner Design",
    "Large Billboard on a building", "Rooftop advertising", "Advertisement on the fence", "Billboard",
  ]);
  const socnet = view.root.findAll((node) => typeof node.props?.className === "string" && node.props.className.includes("group relative"))[3];
  assert.deepEqual(socnet.findAllByType("a").map((node) => node.props.href), [
    "https://vk.com/plusinplus", "https://t.me/plusinplus", "https://www.youtube.com/@plusinplus",
  ]);
  act(() => view.unmount());
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

test("stage 7.1: hero is nowrap and category introduction is centered", () => {
  const { HeroSection } = require("../components/site/hero-section.tsx");
  const { CategoriesSection } = require("../components/site/categories-section.tsx");
  const hero = create(React.createElement(HeroSection));
  const heading = hero.root.findByType("h1");
  assert.match(heading.props.className, /whitespace-nowrap/);
  assert.match(heading.props.className, /text-\[clamp\(/);
  assert.match(heading.props.className, /text-\[#052B42\]/);
  assert.doesNotMatch(heading.props.className, /text-balance/);
  const categories = create(React.createElement(CategoriesSection));
  const intro = categories.root.findByProps({ id: "categories-heading" }).parent;
  assert.match(intro.props.className, /mx-auto max-w-2xl text-center/);
  assert.match(intro.findByType("p").props.className, /text-\[#052B42\]/);
  hero.unmount();
  categories.unmount();
});

test("stage 7.1: category titles have an explicit break, 3:4 ratio, grayscale and 45deg hover", () => {
  const { ArrowUpRight } = require("lucide-react");
  for (const title of ["Website mockup", "Badge design", "Poster design", "Banner design"]) {
    const card = create(React.createElement(CategoryCard, { title, href: "/shop", gradientImageSrc: "/category.png" }));
    const label = card.root.findByType("span");
    assert.equal(label.children[0], title.split(" ")[0]);
    assert.equal(label.children[1].type, "br");
    assert.equal(label.children[2], title.split(" ")[1]);
    assert.match(label.props.className, /font-geist/);
    assert.match(label.props.className, /left-5 top-5/);
    assert.match(label.parent.props.className, /aspect-\[3\/4\].*text-white/);
    const arrow = card.root.findByType(ArrowUpRight);
    assert.match(arrow.props.className, /bottom-5 right-5/);
    assert.match(arrow.props.className, /duration-200 ease-out group-hover:rotate-45 group-focus-visible:rotate-45/);
    assert.match(card.root.findByType("img").props.className, /duration-200 ease-out group-hover:grayscale/);
    card.unmount();
  }
});

test("stage 7.1: filled CTAs are white on navy, outline CTAs are navy", () => {
  const { buttonVariants } = require("../components/ui/button.tsx");
  for (const variant of ["default", "primary"]) {
    assert.match(buttonVariants({ variant }), /bg-\[#052B42\] text-white/);
    assert.doesNotMatch(buttonVariants({ variant }), /text-\[#052B42\]/);
  }
  assert.match(buttonVariants({ variant: "outline" }), /border-\[#052B42\].*text-\[#052B42\]/);
  const { BreadcrumbBack } = require("../components/site/breadcrumb-back.tsx");
  const back = create(React.createElement(BreadcrumbBack, { href: "/shop", label: "Back" }));
  assert.match(back.root.findByType("a").props.className, /bg-\[#052B42\] text-white/);
  const card = create(React.createElement(ServiceCard, { title: "Sign Design", href: "/shop/service" }));
  const more = card.root.findByType("span");
  assert.equal(more.children[0], "More");
  assert.match(more.props.className, /bg-\[#052B42\] text-white/);
  assert.equal(card.root.findAllByType("a").length, 1, "CTA must not create a nested link");
  card.unmount();
  back.unmount();
});

test("stage 7.1: dark sections retain white text, green icons and correct backgrounds", () => {
  const { FeaturesSection } = require("../components/site/features-section.tsx");
  const { Footer } = require("../components/site/footer.tsx");
  const features = create(React.createElement(FeaturesSection));
  assert.match(features.root.findByType("section").props.className, /bg-\[#0A2540\] text-white/);
  for (const node of features.root.findAll((n) => ["h2", "p"].includes(n.type))) {
    assert.match(node.props.className, /text-white/);
    assert.doesNotMatch(node.props.className, /text-(navy|slate|gray)|text-\[#052B42\]/);
  }
  for (const icon of features.root.findAllByType("svg")) assert.match(icon.props.className, /text-green-500/);
  const footer = create(React.createElement(Footer));
  assert.match(footer.root.findByType("footer").props.className, /bg-\[#052B42\] text-white/);
  for (const link of footer.root.findAllByType("a")) assert.match(link.props.className, /text-white\/60/);
  assert.match(footer.root.findByType("p").props.className, /text-white\/10/);
  features.unmount();
  footer.unmount();
});

test("stage 7.1: news uses a light blue section with navy card text", () => {
  clock();
  let news;
  act(() => { news = create(React.createElement(NewsSection, { items: [{ ...items[0], excerpt: "News excerpt", source: "vk" }] })); });
  assert.match(news.root.findByType("section").props.className, /bg-\[#D6E4FF\]/);
  for (const node of news.root.findAll((n) => ["h2", "h3", "p"].includes(n.type))) {
    assert.match(node.props.className, /text-\[#052B42\]/);
  }
  act(() => news.unmount());
});

test("stage 7.1: populated service and article pages inherit navy without recoloring CTAs", async () => {
  // Fixtures exercise the actual page markup without a database or route changes.
  const data = require("../lib/data.ts");
  const original = { getPublishedService: data.getPublishedService, getPublishedPost: data.getPublishedPost };
  const { default: ServicePage } = require("../app/shop/[slug]/page.tsx");
  const { default: BlogPostPage } = require("../app/blog/[slug]/page.tsx");
  data.getPublishedService = async () => ({
    id: "sign", title: "Sign Design", fullDesc: "Service description", coverImage: "",
    includes: ["Technical expertise"], shapes: ["Classic light boxes"], resultText: "A production-ready layout",
  });
  data.getPublishedPost = async () => ({
    id: "launch", slug: "launch", title: "Launch day", content: "<h2>About our work</h2><p>Article body.</p>",
    coverImage: "", readTime: 4, publishedAt: new Date("2026-10-07T00:00:00Z"),
  });
  try {
    const service = create(await ServicePage({ params: Promise.resolve({ slug: "sign" }) }));
    // The page has two headings: the "SHOP" hero (h1) and the service title (h2).
    const heading = service.root.findAllByType("h2").find((node) => node.children.includes("Sign Design"));
    assert.match(heading.parent.parent.parent.props.className, /text-\[#052B42\]/);
    const order = service.root.findAllByType("a").find((link) => link.children.includes("Order"));
    assert.match(order.props.className, /bg-\[#052B42\] text-white/);
    const article = create(await BlogPostPage({ params: Promise.resolve({ slug: "launch" }) }));
    assert.match(article.root.findByType("article").props.className, /text-\[#052B42\]/);
    assert.match(article.root.findByType("header").findByType("p").props.className, /text-\[#052B42\]/);
    const body = article.root.findAllByType("div").find((node) => node.props.dangerouslySetInnerHTML);
    assert.match(body.props.dangerouslySetInnerHTML.__html, /<h2>About our work<\/h2>/);
    service.unmount();
    article.unmount();
  } finally {
    Object.assign(data, original);
  }
});

test("category cards use all four bundled gradients in reference order", () => {
  const { CategoriesSection } = require("../components/site/categories-section.tsx");
  const view = create(React.createElement(CategoriesSection));
  try {
    const expected = [
      ["Website mockup", "/assets/gradients/category-bg.png"],
      ["Badge design", "/assets/gradients/category-bg2.png"],
      ["Poster design", "/assets/gradients/category-bg3.png"],
      ["Banner design", "/assets/gradients/category-bg4.png"],
    ];
    const cards = view.root.findAllByType(CategoryCard);
    assert.deepEqual(cards.map(({ props }) => [props.title, props.gradientImageSrc]), expected);
    for (const card of cards) {
      assert.equal(card.findByType("img").props.src, card.props.gradientImageSrc);
      assert.ok(fs.existsSync(path.join(__dirname, "..", "public", card.props.gradientImageSrc)));
    }
  } finally {
    view.unmount();
  }
});
