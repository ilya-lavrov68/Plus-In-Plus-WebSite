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
  if (name === "next-intl") return require("./next-intl-stub.cjs");
  if (name === "next-intl/server") return require("./next-intl-stub.cjs");
  if (name === "next/link") return React.forwardRef(({ children, ...props }, ref) => React.createElement("a", { ...props, ref }, children));
  if (name === "next/image") return (props) => React.createElement("img", props);
  if (name === "@/lib/prisma") return { prisma: null };
  if (name === "next-auth/react") return { useSession: () => ({ data: null, status: "unauthenticated" }) };
  if (name === "@/app/actions/auth") return {};
  // Заглушка, а не реальный экшен: orders тянет @/auth → NextAuth, который
  // в этом процессе не может разрешить next/server (ESM). Тестам разметки
  // страниц поведение экшена не нужно.
  if (name === "@/app/actions/orders") return { requestQuote: async () => ({ ok: true, orderNumber: "ПИП-000001" }) };
  if (name === "@/auth") return { auth: async () => null, handlers: {} };
  if (name.startsWith("@/")) name = path.resolve(__dirname, "..", name.slice(2));
  return originalLoad.call(this, name, parent, isMain);
};

const { NewsCarousel, AUTOPLAY_INTERVAL } = require("../components/site/news-carousel.tsx");
const { Header } = require("../components/site/header.tsx");
const { AnnouncementBar } = require("../components/site/announcement-bar.tsx");
const { CategoryCard } = require("../components/site/category-card.tsx");
const { CategoriesSection } = require("../components/site/categories-section.tsx");
const { ServiceCard } = require("../components/site/service-card.tsx");
const { SafeImage } = require("../components/site/safe-image.tsx");
const { createPageMetadata, SITE_URL } = require("../lib/seo.ts");
const { NewsSection } = require("../components/site/news-section.tsx");
const { toNewsItem } = require("../lib/data.ts");
const { default: HomePage } = require("../app/page.tsx");
const { default: ContactPage } = require("../app/contact/page.tsx");
const { default: ShopPage } = require("../app/shop/page.tsx");
const { default: BlogPage } = require("../app/blog/page.tsx");
const { default: sitemap } = require("../app/sitemap.ts");
const { default: robots } = require("../app/robots.ts");
const { ArrowRight, ChevronDown, Languages } = require("lucide-react");
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

test("header switches to its glass surface only above 50px and removes its listener", () => {
  const timer = clock();
  let view;
  act(() => { view = create(React.createElement(Header)); });
  const header = () => view.root.findByType("header").props.className;
  assert.match(header(), /bg-transparent/);
  act(() => { window.scrollY = 50; timer.listeners.get("scroll")(); });
  assert.match(header(), /bg-transparent/);
  act(() => { window.scrollY = 51; timer.listeners.get("scroll")(); });
  assert.match(header(), /site-header--glass/);
  assert.doesNotMatch(header(), /bg-white\/95/);
  assert.match(header(), /duration-250 ease-out/);
  act(() => view.unmount());
  assert.equal(timer.listeners.has("scroll"), false);
});

test("header opens one large multi-column menu on hover and supports mobile accordions", async () => {
  clock();
  let view;
  act(() => { view = create(React.createElement(Header)); });

  const mainNav = view.root.findByProps({ "aria-label": "Main navigation" });
  assert.match(mainNav.props.className, /md:flex/);
  const rightSide = view.root.findAll((node) =>
    typeof node.props?.className === "string" && node.props.className.includes("relative z-30 flex"),
  )[0];
  assert.ok(rightSide);
  const languageSwitcher = rightSide.findAllByType("button").find((button) => button.props.title === "Language");
  assert.ok(languageSwitcher);
  assert.equal(languageSwitcher.props["aria-label"], "English — Language");
  assert.ok(languageSwitcher.findByType(Languages));
  const contact = rightSide.findAllByType("a").find((link) => content(link) === "Contact");
  const login = rightSide.findAllByType("button").find((button) => content(button) === "Log in");
  assert.ok(contact);
  assert.ok(login);
  for (const control of [contact, login]) {
    assert.match(control.props.className, /rounded-full/);
    assert.match(control.props.className, /h-9/);
    assert.match(control.props.className, /font-body/);
  }
  assert.match(contact.props.className, /border-navy/);
  assert.match(login.props.className, /bg-navy/);

  const logo = view.root.findByProps({ "aria-label": "Plus In Plus home" });
  const logoImage = logo.findByType("img");
  assert.equal(logoImage.props.src, "/assets/logos/plus-in-plus.svg");
  assert.equal(logoImage.props.alt, "Plus In Plus");
  assert.equal(logoImage.props.className, "h-9 w-auto sm:h-[42px]");

  const triggerFor = (label) => mainNav.findAllByType("button").find((button) =>
    button.props["aria-haspopup"] === "true" && content(button).startsWith(label),
  );
  const panelNodes = () => view.root.findAll((node) =>
    node.type === "div" && typeof node.props?.id === "string" && node.props.id.startsWith("navigation-dropdown-"),
  );
  const panelFor = (label) => panelNodes().find((node) => node.props.id === `navigation-dropdown-${label}`);
  const labels = ["FOR PLAY", "SHOP", "ABOUT PIP", "SOCNET"];
  assert.equal(mainNav.findAllByType("button").filter((button) => button.props["aria-haspopup"] === "true").length, 4);
  assert.equal(panelNodes().length, 0);

  const expectedSections = [
    ["Services"],
    ["Small designs", "Large designs"],
    ["Company", "Resources"],
    ["Social", "Contact"],
  ];

  for (const [index, label] of labels.entries()) {
    const trigger = triggerFor(label);
    assert.ok(trigger, `${label} trigger is missing`);
    assert.equal(trigger.props.onClick, undefined, "desktop dropdowns must not open on click");
    assert.equal(trigger.props["aria-expanded"], false);
    assert.ok(trigger.props["aria-controls"]);

    act(() => trigger.props.onMouseEnter());
    const activeId = ["for-play", "shop", "about-pip", "socnet"][index];
    const panel = panelFor(activeId);
    assert.ok(panel, `${label} mega menu should open on hover`);
    assert.equal(panelNodes().length, 1, "only one mega menu may be mounted at once");
    assert.equal(triggerFor(label).props["aria-expanded"], true);
    assert.match(panel.props.className, /z-30/);
    assert.match(panel.props.className, /min-w-\[700px\]/);
    assert.match(panel.props.className, /animate-dropdown-in/);

    const frame = panel.findAllByType("div").find((node) => node.props.className?.includes("rounded-2xl"));
    assert.ok(frame);
    assert.match(frame.props.className, /rounded-2xl/);
    assert.match(frame.props.className, /border-gray-100/);
    assert.match(frame.props.className, /bg-white/);
    assert.match(frame.props.className, /shadow-xl/);
    assert.deepEqual(panel.findAllByType("h2").map(content), expectedSections[index]);

    const links = panel.findAllByType("a");
    assert.ok(links.length > 0);
    assert.ok(panel.findAllByType("img").some((image) => image.props.src === "/assets/gradients/hero-gradient.svg"));
    assert.ok(panel.findAllByType("a").some((link) => content(link).includes("Inside the Plus In Plus studio")));
  }

  act(() => triggerFor("FOR PLAY").props.onMouseEnter());
  const forPlayPanel = panelFor("for-play");
  const order = forPlayPanel.findAllByType("a").find((link) => content(link).startsWith("Order a design"));
  assert.ok(order);
  assert.match(order.props.className, /rounded-xl/);
  assert.match(order.props.className, /hover:bg-gray-50/);
  assert.match(order.children[0].props.className, /h-8 w-8/);
  assert.match(order.children[0].props.className, /bg-\[#00C56D\]/);
  assert.match(order.children[0].props.className, /text-\[#052B42\]/);
  assert.match(order.children[1].children[1].props.className, /text-xs/);

  act(() => triggerFor("SHOP").props.onMouseEnter());
  const shopPanel = panelFor("shop");
  const shopLabels = ["Sign Design", "Bag Design", "Outdoor glass poster", "Banner Design", "Large Billboard", "Rooftop advertising"];
  for (const label of shopLabels) {
    assert.ok(shopPanel.findAllByType("a").some((link) => content(link).startsWith(label)), `${label} is missing`);
  }
  act(() => triggerFor("SOCNET").props.onMouseEnter());
  const socnetPanel = panelFor("socnet");
  const socials = socnetPanel.findAllByType("a");
  assert.ok(socials.some((link) => link.props.href === "https://vk.com/plusinplus"));
  assert.ok(socials.some((link) => link.props.href === "https://t.me/plusinplus"));
  assert.ok(socials.some((link) => link.props.href === "https://www.youtube.com/@plusinplus"));

  act(() => mainNav.props.onMouseLeave());
  assert.equal(panelNodes().length, 1, "the menu stays open during the 150ms leave grace period");
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 175));
  });
  assert.equal(panelNodes().length, 0);

  const burger = view.root.findByProps({ "aria-label": "Open menu" });
  act(() => burger.props.onClick());
  const mobileNav = view.root.findByProps({ "aria-label": "Mobile main navigation" });
  const shopAccordion = mobileNav.findAllByType("button").find((button) => content(button).startsWith("SHOP"));
  assert.ok(shopAccordion);
  assert.equal(shopAccordion.props["aria-expanded"], false);
  act(() => shopAccordion.props.onClick());
  const mobileCatalog = view.root.findByProps({ id: "mobile-navigation-section-shop" });
  assert.ok(mobileCatalog.findAllByType("a").some((link) => content(link).startsWith("Large Billboard")));
  assert.ok(view.root.findAllByType("a").some((link) => content(link) === "Contact"));
  assert.ok(view.root.findAllByType("button").some((button) => content(button) === "Log in"));
  act(() => view.root.findByProps({ "aria-label": "Close menu" }).props.onClick());
  assert.equal(view.root.findAllByProps({ "aria-label": "Mobile main navigation" }).length, 0);
  act(() => view.unmount());
});

test("announcement bar can be dismissed and remembers its choice in localStorage", () => {
  const previousWindow = global.window;
  const previousCustomEvent = global.CustomEvent;
  const values = new Map();
  const events = [];
  global.window = {
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    },
    dispatchEvent: (event) => { events.push(event); return true; },
  };
  global.CustomEvent = class CustomEvent {
    constructor(type, init) { this.type = type; this.detail = init?.detail; }
  };

  let view;
  try {
    act(() => { view = create(React.createElement(AnnouncementBar)); });
    assert.match(content(view.toJSON()), /Plus In Plus — A next-generation design studio/);
    assert.equal(view.root.findByProps({ "aria-label": "Dismiss announcement" }).type, "button");

    act(() => view.root.findByProps({ "aria-label": "Dismiss announcement" }).props.onClick());
    assert.equal(view.toJSON(), null);
    assert.equal(values.get("pip-announcement-dismissed"), "true");
    assert.equal(events.at(-1).detail.visible, false);

    let restored;
    act(() => { restored = create(React.createElement(AnnouncementBar)); });
    assert.equal(restored.toJSON(), null, "a dismissed announcement remains hidden on the next visit");
    act(() => restored.unmount());
  } finally {
    if (view) act(() => view.unmount());
    global.window = previousWindow;
    global.CustomEvent = previousCustomEvent;
  }
});

test("category and service cards use the supplied artwork with responsive brand hover motion", () => {
  const category = create(React.createElement(CategoryCard, {
    title: "Category",
    gradientImageSrc: "/assets/gradients/category-bg.svg",
    href: "/shop",
  }));
  const categoryImage = category.root.findByType("img");
  assert.equal(categoryImage.props.src, "/assets/gradients/category-bg.svg");
  assert.match(categoryImage.props.className, /transition-\[filter,opacity\]/);
  assert.match(categoryImage.props.className, /group-hover:grayscale/);
  assert.match(categoryImage.props.className, /group-hover:opacity-70/);
  assert.match(categoryImage.props.className, /group-focus-visible:grayscale/);
  const categoryArrow = category.root.findByType(require("lucide-react").ArrowUpRight);
  assert.match(categoryArrow.props.className, /transition-\[rotate\] duration-200 ease-out/);
  assert.match(categoryArrow.props.className, /group-hover:rotate-90/);
  assert.match(categoryArrow.props.className, /group-focus-visible:rotate-90/);

  const service = create(React.createElement(ServiceCard, { title: "Service", href: "/shop/service", imageSrc: "/from-props.png" }));
  const image = service.root.findByType("img");
  assert.equal(image.props.src, "/from-props.png");
  assert.match(image.props.className, /object-contain/);
  assert.match(image.props.className, /transition-opacity duration-200 ease-out/);
  const title = service.root.findByType("h3");
  assert.match(title.props.className, /font-geist/);
  assert.match(service.root.findByType("a").props.className, /text-\[#052B42\]/);
  const arrow = service.root.findByType(ArrowRight);
  assert.match(arrow.props.className, /transition-transform duration-200 ease-out group-hover:translate-x-1/);

  const { ShopServiceCard } = require("../components/site/shop-service-card.tsx");
  const shopService = create(React.createElement(ShopServiceCard, { title: "Catalog service", href: "/shop/catalog", imageSrc: "/cover.webp" }));
  assert.match(shopService.root.findByType("img").props.className, /object-contain/);
  assert.match(shopService.root.findAllByType("div").find((node) => /aspect-\[3\/2\]/.test(node.props.className)).props.className, /bg-\[#F0F0F0\]/);

  const { NewsCard } = require("../components/site/news-card.tsx");
  const news = create(React.createElement(NewsCard, { title: "News", excerpt: "Excerpt", imageSrc: "/news.webp" }));
  assert.match(news.root.findByType("img").props.className, /object-contain/);
  assert.match(news.root.findAllByType("div").find((node) => /aspect-\[350\/273\]/.test(node.props.className)).props.className, /bg-\[#F0F0F0\]/);

  category.unmount();
  service.unmount();
  shopService.unmount();
  news.unmount();
});

test("cover upload help shows target pixel dimensions and explains that uploaded art will not be cropped", () => {
  const { CoverImageHelp } = require("../components/admin/cover-image-help.tsx");
  const blog = create(React.createElement(CoverImageHelp, { kind: "blog", file: null, mode: "create" }));
  const blogCopy = content(blog.toJSON());
  assert.match(blogCopy, /1,400 × 1,092 px \(350:273\)/);
  assert.match(blogCopy, /700 × 546 px/);
  assert.match(blogCopy, /2,400 × 1,872 px/);
  assert.match(blogCopy, /Full HD \(1,920 × 1,080 px\) is accepted and displayed in full/);
  assert.match(blogCopy, /never cropped/);

  const service = create(React.createElement(CoverImageHelp, { kind: "services", file: null, mode: "create" }));
  const serviceCopy = content(service.toJSON());
  assert.match(serviceCopy, /1,600 × 1,067 px \(3:2\)/);
  assert.match(serviceCopy, /800 × 533 px/);
  assert.match(serviceCopy, /2,400 × 1,600 px/);
  blog.unmount();
  service.unmount();
});

test("category introduction is centered, responsive and uses the supplied copy", () => {
  const section = create(React.createElement(CategoriesSection));
  const heading = section.root.findByProps({ id: "categories-heading" });
  assert.match(heading.props.className, /sm:whitespace-nowrap/);
  assert.match(heading.props.className, /text-\[clamp\(/);

  const subtitle = section.root.findByType("p");
  assert.match(content(subtitle), /^Have an idea but don.t know how to showcase it\?/);
  assert.match(content(subtitle), /clear design—from website mockups to posters and event collateral\./);
  assert.match(subtitle.props.className, /mx-auto mt-5 max-w-\[760px\] font-body/);
  assert.match(subtitle.props.className, /lg:mt-14/);
  assert.match(subtitle.props.className, /text-\[#052B42\]/);
  section.unmount();
});

test("contact form is centered and Send retains its rounded-xl style", async () => {
  const page = create(await ContactPage());
  const heading = page.root.findByProps({ id: "contact-heading" });
  assert.match(heading.props.className, /text-center/);
  assert.match(heading.props.className, /font-geist/);

  const form = page.root.findAllByType("form").find((candidate) => /max-w-xl/.test(candidate.props.className));
  assert.match(form.props.className, /mx-auto/);
  assert.match(form.props.className, /max-w-xl/);
  for (const input of form.findAllByType("input")) {
    assert.match(input.props.className, /w-full/);
  }
  assert.match(form.findByType("textarea").props.className, /w-full/);

  const send = form.findByType("button");
  assert.match(send.props.className, /mx-auto/);
  assert.match(send.props.className, /rounded-xl/);
  assert.doesNotMatch(send.props.className, /rounded-full/);
  page.unmount();
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
  window.matchMedia = (query) => ({ matches: query.includes("prefers-reduced-motion"), addEventListener() {}, removeEventListener() {} });
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

test("stage 7.1: hero is oversized and category introduction is centered", () => {
  const { HeroSection } = require("../components/site/hero-section.tsx");
  const { CategoriesSection } = require("../components/site/categories-section.tsx");
  const hero = create(React.createElement(HeroSection));
  const heading = hero.root.findByType("h1");
  assert.match(heading.props.className, /text-\[clamp\(3rem,6\.2vw,6rem\)\]/);
  assert.match(heading.props.className, /lg:whitespace-nowrap/);
  assert.match(heading.props.className, /text-\[#052B42\]/);
  assert.doesNotMatch(heading.props.className, /text-balance/);
  const heroButtons = hero.root.findAllByType("a").filter((link) => ["Order", "Contact us"].includes(content(link)));
  assert.equal(heroButtons.length, 2);
  for (const button of heroButtons) {
    assert.match(button.props.className, /rounded-xl/);
    // Геометрия та же, но задана брендовым размером кнопки: раньше высота
    // получалась из py-3 + line-height text-base (24 + 12 + 12 = 48px),
    // теперь это явный h-12. Проверяем итоговые отступы, а не способ их записи.
    assert.match(button.props.className, /px-8/);
    assert.match(button.props.className, /h-12/);
    assert.match(button.props.className, /font-medium/);
    assert.match(button.props.className, /text-base/);
    assert.doesNotMatch(button.props.className, /scale|zoom/);
  }
  const categories = create(React.createElement(CategoriesSection));
  const intro = categories.root.findByProps({ id: "categories-heading" }).parent;
  assert.match(intro.props.className, /mx-auto max-w-\[820px\] text-center/);
  assert.match(intro.findByType("p").props.className, /text-\[#052B42\]/);
  hero.unmount();
  categories.unmount();
});

test("category titles use the supplied artwork, 7:10 ratio and animated arrow hover", () => {
  const { ArrowUpRight } = require("lucide-react");
  for (const title of ["Website mockup", "Badge design", "Poster design", "Banner design"]) {
    const card = create(React.createElement(CategoryCard, { title, href: "/shop", gradientImageSrc: "/category.png" }));
    const label = card.root.findByType("span");
    assert.equal(label.children[0], title.split(" ")[0]);
    assert.equal(label.children[1].type, "br");
    assert.equal(label.children[2], title.split(" ")[1]);
    assert.match(label.props.className, /font-geist/);
    assert.match(label.props.className, /text-\[3\.125rem\].*sm:text-\[3\.75rem\].*lg:text-\[4\.75rem\]/);
    assert.match(label.props.className, /left-4 top-4/);
    assert.match(label.parent.props.className, /aspect-\[7\/10\].*text-white/);
    assert.doesNotMatch(label.parent.props.className, /rounded/);
    const arrow = card.root.findByType(ArrowUpRight);
    assert.match(arrow.props.className, /bottom-4 right-4/);
    assert.match(arrow.props.className, /transition-\[rotate\] duration-200 ease-out group-hover:rotate-90 group-focus-visible:rotate-90/);
    assert.match(card.root.findByType("img").props.className, /transition-\[filter,opacity\].*group-hover:grayscale/);
    card.unmount();
  }
});

test("stage 7.1: filled CTAs are white on navy, outline CTAs are navy", () => {
  const { buttonVariants } = require("../components/ui/button.tsx");
  for (const variant of ["default", "primary"]) {
    assert.match(buttonVariants({ variant }), /bg-\[#052B42\] text-white/);
    assert.match(buttonVariants({ variant }), /rounded-xl/);
    assert.doesNotMatch(buttonVariants({ variant }), /text-\[#052B42\]/);
  }
  assert.match(buttonVariants({ variant: "outline" }), /border-\[#052B42\].*text-\[#052B42\]/);
  assert.match(buttonVariants({ variant: "outline" }), /rounded-xl/);
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
  const features = create(React.createElement(FeaturesSection));
  assert.match(features.root.findByType("section").props.className, /bg-\[#052B42\] text-white/);
  const cards = features.root.findAllByType("li");
  assert.equal(cards.length, 3);
  for (const card of cards) {
    assert.match(card.props.className, /bg-\[#0A3B57\]/);
    assert.doesNotMatch(card.props.className, /min-h-\[/, "feature cards should size to their copy rather than reserve unused height");
    const heading = card.findByType("h2");
    const description = card.findByType("p");
    assert.match(heading.props.className, /text-xl.*sm:text-\[1\.375rem\]/);
    assert.match(description.props.className, /text-\[0\.9375rem\].*sm:text-\[1\.0625rem\]/);
  }
  for (const node of features.root.findAll((n) => ["h2", "p"].includes(n.type))) {
    assert.match(node.props.className, /text-white/);
    assert.doesNotMatch(node.props.className, /text-(navy|slate|gray)|text-\[#052B42\]/);
  }
  for (const icon of features.root.findAllByType("svg")) assert.match(icon.props.className, /text-\[#05F07E\]/);
  features.unmount();
});

test("partners section keeps its right-column placement with centered TS Connect copy", () => {
  const { PartnersSection } = require("../components/site/partners-section.tsx");
  const partners = create(React.createElement(PartnersSection));
  const copy = partners.root.findByType("p");
  assert.match(copy.props.className, /text-center/);
  assert.match(copy.props.className, /lg:ml-auto/);
  assert.match(copy.props.className, /lg:text-center/);
  assert.doesNotMatch(copy.props.className, /text-right/);
  partners.unmount();
});

test("footer: light-blue Nebius-style layout with CTA, five columns, legal row and watermark", () => {
  const { Footer } = require("../components/site/footer.tsx");
  let footer;
  act(() => { footer = create(React.createElement(Footer)); });
  const root = footer.root;

  // Step 1: the footer is light blue (#D6E4FF) with navy text, never navy-on-white.
  const shell = root.findByType("footer");
  assert.match(shell.props.className, /bg-\[#D6E4FF\]/);
  assert.match(shell.props.className, /\btext-navy\b/);
  assert.doesNotMatch(shell.props.className, /bg-\[#052B42\]/);

  // Step 2: CTA block on top with the heading and the two centred buttons.
  const heading = root.findByProps({ id: "footer-cta-heading" });
  assert.equal(content(heading), "Start your journey with Plus In Plus");
  assert.match(heading.props.className, /font-geist/);
  assert.match(heading.props.className, /font-semibold/);
  assert.match(heading.props.className, /text-3xl/);
  assert.match(heading.props.className, /sm:text-4xl/);
  assert.match(heading.parent.props.className, /py-16/);
  assert.match(heading.parent.props.className, /sm:py-20/);

  const ctaLinks = root.findAllByType("a").filter((node) => ["Order a design", "Talk to us"].includes(content(node)));
  assert.equal(ctaLinks.length, 2);
  const [order, talk] = ctaLinks;
  assert.equal(order.props.href, "/shop");
  assert.match(order.props.className, /bg-navy text-white/);
  assert.match(order.props.className, /rounded-xl/);
  assert.equal(talk.props.href, "/contact");
  assert.match(talk.props.className, /border border-navy/);
  assert.match(talk.props.className, /rounded-xl/);
  assert.doesNotMatch(talk.props.className, /\btext-white\b/);
  // Stacked through tablet, inline from 1024px up.
  for (const button of ctaLinks) {
    assert.match(button.props.className, /w-full max-w-sm/);
    assert.match(button.props.className, /lg:w-auto/);
  }
  const ctaRow = heading.parent.findAllByType("div")[0];
  assert.match(ctaRow.props.className, /flex-col items-center/);
  assert.match(ctaRow.props.className, /lg:flex-row/);

  // Step 3: five link columns with the requested labels.
  const nav = root.findByProps({ "aria-label": "Footer" });
  assert.match(nav.props.className, /grid-cols-2/);
  assert.match(nav.props.className, /sm:grid-cols-3/);
  assert.match(nav.props.className, /lg:grid-cols-5/);
  const columns = nav.findAllByType("h3").map((columnHeading) => ({
    title: content(columnHeading),
    heading: columnHeading.props.className,
    links: columnHeading.parent.findAllByType("a").map((link) => ({
      label: content(link),
      href: link.props.href,
      className: link.props.className,
    })),
  }));
  const expectedColumns = {
    Services: ["Website design", "Badge design", "Poster design", "Banner mockup design", "Sign Design", "Bag Design", "Large Billboard", "Rooftop advertising"],
    About: ["How we work", "Our partners", "TS Connect", "Studio news", "Blog"],
    Resources: ["Design systems", "Ozone project", "Plus For Play"],
    Legal: ["Privacy Policy", "User Agreement", "Offer", "Terms of use"],
    Company: ["Account", "Collaboration", "Partners", "Contact us"],
  };
  assert.deepEqual(columns.map((column) => column.title), Object.keys(expectedColumns));
  assert.deepEqual(
    Object.fromEntries(columns.map((column) => [column.title, column.links.map((link) => link.label)])),
    expectedColumns,
  );
  for (const column of columns) {
    assert.match(column.heading, /text-sm/);
    assert.match(column.heading, /font-semibold/);
    assert.match(column.heading, /text-navy/);
    assert.match(column.heading, /mb-4/);
    for (const link of column.links) {
      assert.match(link.className, /text-sm text-navy\/70/);
      assert.match(link.className, /hover:text-navy/);
      assert.match(link.className, /transition-colors duration-200/);
      assert.ok(link.href.length > 0, `${link.label} needs a target`);
    }
  }

  // Step 4: newsletter form on the left, all fields opt-in by default.
  const form = root.findByType("form");
  assert.equal(content(form.findByType("h3")), "Subscribe to updates");
  const fields = Object.fromEntries(form.findAllByType("input").map((input) => [input.props.name, input.props]));
  assert.deepEqual(Object.keys(fields).sort(), ["designInsights", "email", "firstName", "lastName", "plusInPlusNews"]);
  assert.equal(fields.email.type, "email");
  assert.equal(fields.email.required, true);
  assert.match(fields.email.className, /border border-navy\/30/);
  assert.match(fields.email.className, /rounded-lg/);
  assert.match(fields.email.className, /bg-white\/50/);
  for (const name of ["plusInPlusNews", "designInsights"]) {
    assert.equal(fields[name].type, "checkbox");
    assert.equal(fields[name].defaultChecked, true);
  }
  assert.match(content(form), /I agree to receive marketing communications from Plus In Plus, subject to the Privacy Policy\./);
  const subscribe = form.findByType("button");
  assert.equal(content(subscribe), "Subscribe");
  assert.equal(subscribe.props.type, "submit");
  // navy — это #052B42 в tailwind.config, так что bg-navy и bg-[#052B42]
  // дают один и тот же цвет. Брендовая кнопка пишет цвет литералом.
  assert.match(subscribe.props.className, /bg-(?:navy|\[#052B42\])/);
  assert.match(subscribe.props.className, /text-white/);
  assert.match(subscribe.props.className, /rounded-lg/);
  assert.match(subscribe.props.className, /text-sm/);

  // Step 5: legal links on one line plus the copyright.
  const copyright = root.findAllByType("p").find((node) => content(node) === "© 2026 Plus In Plus. All rights reserved.");
  assert.ok(copyright, "the copyright line must stay in the footer");
  assert.match(copyright.props.className, /text-xs text-navy\/60/);
  const bottomRow = copyright.parent;
  assert.match(bottomRow.props.className, /flex/);
  assert.match(bottomRow.props.className, /border-t border-navy\/20/);
  const bottomLinks = bottomRow.findAllByType("a");
  assert.deepEqual(
    bottomLinks.map((node) => content(node)),
    ["TSConnect Group", "Legal documents", "Terms of use", "Privacy policy", "Cookie policy"],
  );
  for (const link of bottomLinks) {
    assert.match(link.props.className, /text-xs text-navy\/60/);
    assert.match(link.props.className, /hover:text-navy/);
  }

  // Step 6: the oversized wordmark is a decorative watermark, not a link.
  const wordmark = root.findAllByType("p").find((node) => content(node) === "Plus in Plus");
  assert.ok(wordmark, "the oversized Plus in Plus wordmark must stay in the footer");
  assert.match(wordmark.props.className, /text-navy\/10/);
  assert.match(wordmark.props.className, /font-geist/);
  assert.match(wordmark.props.className, /font-bold/);
  assert.match(wordmark.props.className, /tracking-tighter/);
  assert.match(wordmark.props.className, /leading-none/);
  assert.match(wordmark.props.className, /whitespace-nowrap/);
  assert.match(wordmark.props.className, /text-\[clamp\(3rem,16.5vw,16rem\)\]/);
  assert.equal(wordmark.parent.props["aria-hidden"], "true");
  assert.equal(wordmark.parent.findAllByType("a").length, 0, "the wordmark must not be clickable");

  // Step 7: dividers, and no white footer links anywhere outside the filled CTA.
  const dividers = root.findAll((node) => typeof node.props?.className === "string" && /border-t border-navy\/20/.test(node.props.className));
  assert.equal(dividers.length, 3);
  for (const link of root.findAllByType("a")) {
    if (content(link) === "Order a design") continue;
    assert.doesNotMatch(link.props.className, /text-white/);
  }

  act(() => footer.unmount());
});

test("stage 7.1: news uses a light blue section with navy card text", () => {
  clock();
  let news;
  act(() => { news = create(React.createElement(NewsSection, { items: [{ ...items[0], excerpt: "News excerpt", source: "vk" }] })); });
  assert.match(news.root.findByType("section").props.className, /bg-\[#CFE0FF\]/);
  for (const card of news.root.findAllByType("article")) {
    assert.match(card.props.className, /text-\[#052B42\]/);
  }
  assert.match(news.root.findByProps({ id: "news-heading" }).props.className, /text-\[#052B42\]/);
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
    assert.match(article.root.findByType("header").findByType("time").props.className, /text-\[#052B42\]/);
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
      ["Website mockup", "/assets/gradients/category-bg.svg"],
      ["Badge design", "/assets/gradients/category-bg2.svg"],
      ["Poster design", "/assets/gradients/category-bg3.svg"],
      ["Banner design", "/assets/gradients/category-bg4.svg"],
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

// ── Конфигуратор услуги ─────────────────────────────────────────────────────
const { ServiceConfigurator } = require("../components/site/service-configurator.tsx");

/** Услуга с множителем (тираж) и надбавкой (ламинация). */
const pricing = {
  serviceId: "svc-cards",
  title: "Business cards",
  basePrice: 89000,
  priceType: "fixed",
  currency: "RUB",
  isOrderable: true,
  groups: [
    {
      id: "g-qty", name: "Тираж", required: true, sortOrder: 0,
      options: [
        { id: "o-50", label: "50 шт", priceDelta: 0, priceFactor: 1, isDefault: true, sortOrder: 0 },
        { id: "o-100", label: "100 шт", priceDelta: 0, priceFactor: 1.6, isDefault: false, sortOrder: 1 },
      ],
    },
    {
      id: "g-lam", name: "Ламинация", required: false, sortOrder: 1,
      options: [
        { id: "o-none", label: "Без ламинации", priceDelta: 0, priceFactor: 1, isDefault: true, sortOrder: 0 },
        { id: "o-matte", label: "Матовая", priceDelta: 25000, priceFactor: 1, isDefault: false, sortOrder: 1 },
      ],
    },
  ],
};

/** Собирает видимый текст узла: children — это смесь строк и элементов. */
function flatText(node) {
  return node.children
    .map((child) => (typeof child === "string" ? child : flatText(child)))
    .join("");
}

test("configurator: renders every option group with its options", () => {
  let tree;
  act(() => { tree = create(React.createElement(ServiceConfigurator, { pricing, onSubmit: async () => ({ ok: true }) })); });
  const legends = tree.root.findAllByType("legend");
  assert.equal(legends.length, 2);
  // Необязательная группа помечена, чтобы клиент видел, что можно не выбирать.
  const lam = legends.find((node) => flatText(node).includes("Ламинация"));
  assert.ok(lam, "optional group is rendered");
  assert.match(flatText(lam), /optional/);
  assert.equal(tree.root.findAllByType("input").filter((n) => n.props.type === "radio").length, 4);
  tree.unmount();
});

test("configurator: starts from the default option of every group", () => {
  let tree;
  act(() => { tree = create(React.createElement(ServiceConfigurator, { pricing, onSubmit: async () => ({ ok: true }) })); });
  const checked = tree.root.findAllByType("input")
    .filter((n) => n.props.type === "radio" && n.props.checked)
    .map((n) => n.props.value);
  // Обязательная группа и необязательная: у каждой выбран свой isDefault.
  // Иначе флаг isDefault для необязательных групп был бы мёртвым.
  assert.deepEqual(checked.sort(), ["o-50", "o-none"]);
  tree.unmount();
});

test("configurator: choosing an option recalculates the estimate", () => {
  let tree;
  act(() => { tree = create(React.createElement(ServiceConfigurator, { pricing, onSubmit: async () => ({ ok: true }) })); });

  const priceText = () => {
    const spans = tree.root.findAllByType("span");
    const node = spans.find((s) => /font-geist/.test(s.props.className ?? ""));
    return node ? node.children.join("") : "";
  };

  // База: 89 000 коп. = 890 ₽
  assert.match(priceText(), /890/);

  const radioFor = (value) =>
    tree.root.findAllByType("input").find((n) => n.props.type === "radio" && n.props.value === value);

  // Тираж ×1.6 → 142 400 коп. = 1 424 ₽
  act(() => { radioFor("o-100").props.onChange(); });
  assert.match(priceText(), /1\s?424/);

  // Плюс ламинация +25 000 коп.: (89 000 + 25 000) × 1.6 = 182 400 коп. = 1 824 ₽
  act(() => { radioFor("o-matte").props.onChange(); });
  assert.match(priceText(), /1\s?824/);

  tree.unmount();
});

test("configurator: submit passes exactly the selected option ids", async () => {
  let received = null;
  let tree;
  act(() => {
    tree = create(React.createElement(ServiceConfigurator, {
      pricing,
      onSubmit: async (ids) => { received = ids; return { ok: true, orderNumber: "ПИП-000042" }; },
    }));
  });

  const radioFor = (value) =>
    tree.root.findAllByType("input").find((n) => n.props.type === "radio" && n.props.value === value);
  act(() => { radioFor("o-100").props.onChange(); });

  const form = tree.root.findByType("form");
  await act(async () => { await form.props.onSubmit({ preventDefault() {} }); });

  assert.deepEqual(received, ["o-100", "o-none"]);
  // Заявка принята — вместо формы показывается подтверждение с номером.
  assert.match(tree.root.findAllByType("p").map(flatText).join(" "), /ПИП-000042/);
  tree.unmount();
});

test("configurator: unauthenticated visitors cannot submit", () => {
  let tree;
  act(() => { tree = create(React.createElement(ServiceConfigurator, { pricing, onSubmit: async () => ({ ok: true }) })); });
  // next-auth/react здесь заглушён как unauthenticated, поэтому вместо кнопки
  // отправки показывается приглашение войти.
  const buttons = tree.root.findAllByType("button");
  const submit = buttons.find((b) => b.props.type === "submit");
  assert.equal(submit, undefined, "no submit button without a session");
  assert.ok(tree.root.findAllByType("button").some((b) => b.props.disabled));
  tree.unmount();
});
