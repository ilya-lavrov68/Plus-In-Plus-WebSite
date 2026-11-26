const assert = require("node:assert/strict");
const { test, beforeEach } = require("node:test");
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
      filename
    );
}

let sessionStatus = "unauthenticated";
let currentPathname = "/";
let cancelCalls = [];
let cancelResult = { ok: true };
let refreshed = 0;
let customerOrders = [];

const routerStub = {
  push() {},
  replace() {},
  refresh() {
    refreshed += 1;
  },
};

const lenisInstances = [];
class LenisStub {
  constructor(options) {
    this.options = options;
    this.destroyed = false;
    lenisInstances.push(this);
  }

  destroy() {
    this.destroyed = true;
  }
}

const tag =
  (name) =>
  ({ children, ...props }) =>
    React.createElement(name, props, children);

const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === "lenis") return { __esModule: true, default: LenisStub };
  if (name === "next-intl") return require("./next-intl-stub.cjs");
  if (name === "next-intl/server") return require("./next-intl-stub.cjs");
  if (name === "next/link") return tag("a");
  if (name === "next/image") return (props) => React.createElement("img", props);
  if (name === "next/navigation") {
    return {
      // One stable router, as in Next.js: components list it in effect
      // dependencies, and a fresh object per render would loop those effects.
      useRouter: () => routerStub,
      usePathname: () => currentPathname,
      // Server-component redirects throw in Next; the marker keeps them assertable.
      redirect: (destination) => {
        throw new Error(`REDIRECT:${destination}`);
      },
    };
  }
  if (name === "@/auth") {
    return {
      auth: async () =>
        sessionStatus === "authenticated" ? { user: { id: "u1" } } : null,
    };
  }
  if (name === "@/lib/customer-orders") {
    return { getCustomerOrders: async () => structuredClone(customerOrders) };
  }
  if (name === "@/lib/server-i18n") {
    const intl = require("./next-intl-stub.cjs");
    return {
      getRequestTranslations: async (namespace) => intl.useTranslations(namespace),
    };
  }
  if (name === "next-auth/react") {
    return {
      useSession: () => ({
        data:
          sessionStatus === "authenticated"
            ? { user: { id: "u1", email: "user@test.com", firstName: "Studio", lastName: "User", avatar: null, role: "USER" } }
            : null,
        status: sessionStatus,
        update: async () => null,
      }),
      signOut: async () => {},
    };
  }
  if (name === "motion/react") {
    return {
      motion: new Proxy(
        {},
        {
          get: (_target, prop) => tag(String(prop)),
        }
      ),
      AnimatePresence: ({ children }) => children,
      MotionConfig: ({ children }) => children,
      useReducedMotion: () => false,
    };
  }
  if (name === "@/app/actions/auth") {
    return {
      loginUser: async () => ({ ok: true }),
      registerUser: async () => ({ ok: true }),
    };
  }
  if (name === "@/app/actions/mfa") {
    return {
      getMfaPasskeyOptions: async () => ({ ok: false, error: "MFA is not configured in this component test." }),
    };
  }
  if (name === "@/app/actions/orders") {
    return {
      createOrder: async () => ({ orderNumber: "ПИП-000001" }),
      cancelMyOrder: async (input) => {
        cancelCalls.push(input);
        return cancelResult;
      },
    };
  }
  if (name === "hazeglow") {
    // Пакет поставляется только как ESM, а тестовый harness грузит CJS.
    return {
      Hazeglow: (props) =>
        React.createElement("div", { "data-hazeglow-field": "stub", ...props }),
    };
  }
  if (name === "@/components/site/lazy-account-modal") {
    return {
      preloadAccountModal() {},
      LazyAccountModal: ({ open, returnFocusId }) =>
        open
          ? React.createElement(
              "div",
              { "data-testid": "account-modal", "data-return-focus-id": returnFocusId },
              "Account dialog"
            )
          : null,
    };
  }
  if (name === "@/components/ui/sheet") {
    return {
      Sheet: ({ open, children }) => (open ? React.createElement(React.Fragment, null, children) : null),
      SheetContent: tag("div"),
      SheetTitle: tag("h2"),
    };
  }
  if (name === "@/components/ui/accordion") {
    return {
      Accordion: tag("div"),
      AccordionItem: tag("div"),
      AccordionTrigger: tag("button"),
      AccordionContent: tag("div"),
    };
  }
  if (name === "@/components/ui/carousel") {
    return {
      Carousel: tag("div"),
      CarouselContent: tag("div"),
      CarouselItem: tag("div"),
      CarouselPrevious: tag("button"),
      CarouselNext: tag("button"),
    };
  }
  if (name.startsWith("@/")) {
    name = path.resolve(__dirname, "..", name.slice(2));
  }
  return originalLoad.call(this, name, parent, isMain);
};

const { Hero138 } = require("../components/blocks/hero138.tsx");
const { Navbar10, buildNavigation } = require("../components/blocks/navbar10.tsx");
const { Footer7 } = require("../components/blocks/footer7.tsx");
const { Feature314 } = require("../components/blocks/feature314.tsx");
const { Community3 } = require("../components/blocks/community3.tsx");
const { Blog11 } = require("../components/blocks/blog11.tsx");
const { Blogpost11 } = require("../components/blocks/blogpost11.tsx");
const { Contact29 } = require("../components/blocks/contact29.tsx");
const { Cta13 } = require("../components/blocks/cta13.tsx");
const { Services11Catalog } = require("../components/blocks/services11.tsx");
const { ProductDetail1 } = require("../components/blocks/product-detail1.tsx");
const { Signup10 } = require("../components/blocks/signup10.tsx");
const { CandlestickChart } = require("../components/spectrumui/candlestick-chart.tsx");
const { ServiceConfigurator } = require("../components/site/service-configurator.tsx");
const { OrderCard } = require("../components/site/order-card.tsx");
const CartPage = require("../app/(site)/cart/page.tsx").default;
const OrdersPage = require("../app/(site)/orders/page.tsx").default;
const { CookieBanner } = require("../components/site/cookie-banner.tsx");
const {
  MobileBottomNav,
  isMobileNavigationActive,
} = require("../components/site/mobile-bottom-nav.tsx");
const { STUDIO_SERVICES, STUDIO_BLOG_POSTS } = require("../lib/studio-catalog.ts");
const { toBlogCardData } = require("../lib/blog-card.ts");
const { COVER_IMAGE_GUIDES } = require("../lib/upload-policy.ts");
const { DecryptText } = require("../components/site/motion/decrypt-text.tsx");
const { ScrollExperience } = require("../components/site/motion/scroll-experience.tsx");
const { BrandDirections } = require("../components/site/brand-directions.tsx");

beforeEach(() => {
  sessionStatus = "unauthenticated";
  currentPathname = "/";
  cancelCalls = [];
  cancelResult = { ok: true };
  refreshed = 0;
  customerOrders = [];
  lenisInstances.length = 0;
  global.HTMLFormElement = class HTMLFormElement {};
  global.window = {
    scrollY: 0,
    innerWidth: 1440,
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {},
    setTimeout,
    clearTimeout,
  };
  global.document = {
    hidden: false,
    body: { style: {} },
    addEventListener() {},
    removeEventListener() {},
  };
  global.fetch = async () => ({ ok: true, json: async () => ({ count: 0 }) });
});

const textOf = (node) =>
  node.children
    .map((child) => (typeof child === "string" ? child : textOf(child)))
    .join("");

test("Hero138 renders the restored studio statement, its two CTAs and the media stage", () => {
  let view;
  act(() => {
    view = create(React.createElement(Hero138));
  });
  const text = textOf(view.root);
  // DecryptText рисует скрэмбл-слой, поэтому заголовок проверяем по структуре.
  assert.equal(view.root.findAllByType("h1").length, 1);
  assert.match(text, /Have an idea but don't know how to showcase it\?/);
  assert.match(text, /Plus In Plus Design Studio/);
  const links = view.root.findAllByType("a").map((a) => ({
    href: a.props.href,
    text: textOf(a),
  }));
  assert.ok(links.some((link) => link.href === "/services" && link.text.includes("Order")));
  assert.ok(links.some((link) => link.href === "/contact" && link.text.includes("Contact us")));

  const primary = view.root.findAllByType("a").find((link) => link.props.href === "/services");
  // Главный CTA — оранжевая кнопка с тёмным текстом, при наведении она темнеет.
  assert.match(primary.props.className, /bg-primary text-primary-foreground/);
  assert.match(primary.props.className, /hover:bg-brand-signal-strong/);
  assert.equal(primary.props.className.includes("text-signal"), false);
  assert.ok(
    view.root.findAll((node) => node.props?.["data-reveal"] !== undefined).length >= 2,
    "the hero reveals its blocks progressively",
  );
  act(() => view.unmount());
});

test("Interface depth uses borders and outlines, never shadows or focus rings", () => {
  const files = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(filename);
      else if (/\.(?:css|ts|tsx)$/.test(entry.name)) files.push(filename);
    }
  };
  for (const root of ["app", "components", "styles"]) {
    visit(path.resolve(__dirname, "..", root));
  }

  for (const filename of files) {
    const source = fs.readFileSync(filename, "utf8");
    assert.doesNotMatch(
      source,
      /shadow|ring-offset|focus-visible:ring|focus:ring/,
      `${path.relative(path.resolve(__dirname, ".."), filename)} must stay shadow-free and use outlines for focus`,
    );
  }

  for (const filename of ["components/ui/button-variants.ts", "components/ui/input.tsx"]) {
    const source = fs.readFileSync(path.resolve(__dirname, "..", filename), "utf8");
    assert.match(source, /outline-ring/);
    assert.match(source, /focus-visible:outline-2/);
  }
});

test("BrandDirections presents the design practice and the Line Launcher product", async () => {
  const element = await BrandDirections();
  let view;
  act(() => {
    view = create(element);
  });
  const links = view.root.findAllByType("a").map((link) => link.props.href).sort();
  assert.deepEqual(links, ["/line-launcher", "/services"], "две карточки: услуги и продукт");

  const text = textOf(view.root);
  assert.match(text, /Line Launcher/);
  assert.match(text, /0\.15\.4/, "статус продукта берётся из репозитория");
  assert.doesNotMatch(text, /ИИ|\bAI\b/, "закрытое направление ИИ не возвращается");
  act(() => view.unmount());
});

test("Navbar10 and Footer7 render all required navigation items and footer columns", () => {
  let navView, footerView;
  act(() => {
    navView = create(React.createElement(Navbar10));
    footerView = create(React.createElement(Footer7));
  });
  const navText = textOf(navView.root);
  // Раздел SHOP временно скрыт из навигации до появления мерча: в меню
  // остаются FOR PLAY, ABOUT PIP и SOCNET, прямой путь /shop показывает
  // заглушку, а FOR PLAY хранит «Order a design» и «Design services».
  for (const item of ["FOR PLAY", "ABOUT PIP", "SOCNET", "Contact", "Log in"]) {
    assert.ok(navText.includes(item), `Missing navbar item: ${item}`);
  }
  assert.ok(!navText.includes("SHOP"), "SHOP must be hidden from the navbar while the shop is disabled");
  const navImgs = navView.root.findAllByType("img").map((img) => img.props.src);
  assert.ok(
    navImgs.includes("/assets/logos/npip.svg"),
    "Navbar10 must use full drawn wordmark /assets/logos/npip.svg"
  );

  const featuredNavigation = buildNavigation({
    title: "Newest featured story",
    slug: "newest-featured-story",
    coverImage: "/uploads/blog/newest-cover.webp",
  });
  const featuredCard = featuredNavigation.find((item) => item.id === 3)?.imageLink;
  assert.deepEqual(featuredCard, {
    url: "/blog/newest-featured-story",
    image: "/uploads/blog/newest-cover.webp",
    label: "Newest featured story",
  });
  const navigationWithoutPosts = buildNavigation();
  assert.deepEqual(
    navigationWithoutPosts.find((item) => item.id === 4),
    { title: "LINE LAUNCHER", id: 4, url: "/line-launcher" },
    "Line Launcher is a direct desktop and mobile navigation item"
  );
  const aboutWithoutPosts = navigationWithoutPosts.find((item) => item.id === 3);
  assert.equal(aboutWithoutPosts?.imageLink?.url, "/blog");
  assert.equal(aboutWithoutPosts?.imageLink?.label, "Blog");
  assert.ok(
    aboutWithoutPosts?.groupLinks?.every((group) =>
      group.links.every((link) => link.url !== "/blog/we-re-up-and-running")
    ),
    "navigation must not restore an unpublished static article"
  );
  const navbarSource = fs.readFileSync(
    path.resolve(__dirname, "../components/blocks/navbar10.tsx"),
    "utf8"
  );
  assert.match(navbarSource, /className="size-full object-contain"/);
  assert.doesNotMatch(
    navbarSource,
    /shadow-(?:sm|md|lg|xl|2xl|\[)/,
    "The header must not add decorative shadows",
  );
  assert.equal(
    (navbarSource.match(/glass-surface/g) || []).length,
    3,
    "The header must retain its three intentional glass surfaces without shadow overrides",
  );
  assert.match(
    navbarSource,
    /inset-0 z-\[70\][^"]*bg-background/,
    "The full-screen mobile sheet must stay above the bottom bar and use an opaque background",
  );
  for (const file of [
    "components/ui/navigation-menu.tsx",
    "components/site/language-switcher.tsx",
  ]) {
    const source = fs.readFileSync(path.resolve(__dirname, "..", file), "utf8");
    assert.doesNotMatch(source, /shadow-/, `${file} must stay shadow-free`);
  }

  const footerImgs = footerView.root.findAllByType("img").map((img) => img.props.src);
  assert.ok(
    footerImgs.includes("/assets/logos/npip.svg"),
    "Footer7 must use full drawn wordmark /assets/logos/npip.svg"
  );
  assert.ok(
    !footerImgs.includes("/assets/logos/lnpip.svg"),
    "Footer7 must not use standalone mark /assets/logos/lnpip.svg with text caption"
  );

  const termsLink = footerView.root.findAllByType("a").find((link) => textOf(link) === "Terms of use");
  assert.equal(termsLink?.props.href, "/terms");
  const productLink = footerView.root
    .findAllByType("a")
    .find((link) => link.props.href === "/line-launcher");
  assert.ok(productLink, "Footer must link to the Line Launcher product page");
  const studioNewsLinks = footerView.root.findAllByType("a").filter((link) => textOf(link) === "Studio news");
  assert.ok(studioNewsLinks.some((link) => link.props.href === "/blog"));
  assert.ok(studioNewsLinks.every((link) => link.props.href !== "/blog/we-re-up-and-running"));
  const footerText = textOf(footerView.root);
  for (const col of ["Services", "About", "Resources", "Legal", "Company", "© 2026 Plus In Plus"]) {
    assert.ok(footerText.includes(col), `Missing footer item: ${col}`);
  }
  act(() => {
    navView.unmount();
    footerView.unmount();
  });
});

test("Footer7 renders public contact and social settings with icon controls", () => {
  let view;
  act(() => {
    view = create(React.createElement(Footer7, {
      services: [],
      labels: { description: "Description stored in the database" },
      contactEmail: "hello@example.test",
      contactPhone: "+7 (900) 123-45-67",
      socialLinks: {
        vk: "https://vk.com/custom-studio",
        telegram: "https://t.me/custom_studio",
        youtube: "https://www.youtube.com/@custom-studio",
      },
    }));
  });
  assert.match(textOf(view.root), /Description stored in the database/);
  assert.match(textOf(view.root), /hello@example\.test/);
  const links = view.root.findAllByType("a");
  assert.ok(links.some((link) => link.props.href === "mailto:hello@example.test"));
  assert.ok(links.some((link) => link.props.href === "tel:+79001234567"));
  assert.ok(links.some((link) => link.props.href === "https://vk.com/custom-studio" && link.props["aria-label"] === "VK"));
  assert.ok(links.some((link) => link.props.href === "https://t.me/custom_studio" && link.props["aria-label"] === "Telegram"));
  act(() => view.unmount());
});

test("every footer link shows a keyboard focus outline", () => {
  let view;
  act(() => {
    view = create(
      React.createElement(Footer7, {
        contactEmail: "hello@example.test",
        contactPhone: "+7 (900) 123-45-67",
        socialLinks: { vk: "https://vk.com/a", telegram: "https://t.me/a", youtube: "https://youtube.com/@a" },
      }),
    );
  });

  // Ховер в футере — только цвет текста, поэтому фокус обязан быть явным:
  // иначе с клавиатуры виден дефолтный UA-обвод, который легко принять за
  // «серую плашку» и который выбивается из остального интерфейса.
  const links = view.root.findAllByType("a");
  assert.ok(links.length >= 10, "the footer must render its link columns");
  for (const link of links) {
    const className = String(link.props.className ?? "");
    assert.match(className, /focus-visible:outline-2/, `missing focus outline on ${link.props.href}`);
    assert.match(className, /focus-visible:outline-ring/, `focus must use the brand ring on ${link.props.href}`);
    assert.doesNotMatch(className, /focus-visible:ring|shadow/, `focus must be an outline, not a ring or shadow`);
  }

  const source = fs.readFileSync(path.resolve(__dirname, "../components/blocks/footer7.tsx"), "utf8");
  assert.doesNotMatch(source, /hover:bg-/, "footer links keep the flat colour-only hover");
  act(() => view.unmount());
});

test("Navbar10 opens the account dialog from desktop and mobile navigation", async () => {
  sessionStatus = "authenticated";
  let view;
  await act(async () => {
    view = create(React.createElement(Navbar10));
  });

  const desktopTrigger = view.root.findByProps({ id: "account-trigger" });
  assert.equal(desktopTrigger.props["aria-haspopup"], "dialog");
  act(() => desktopTrigger.props.onClick());
  let dialog = view.root.findByProps({ "data-testid": "account-modal" });
  assert.equal(dialog.props["data-return-focus-id"], "account-trigger");
  act(() => view.unmount());

  await act(async () => {
    view = create(React.createElement(Navbar10));
  });
  act(() => view.root.findByProps({ id: "mobile-menu-trigger" }).props.onClick());
  assert.ok(
    view.root
      .findAllByType("button")
      .some((node) => node.props["aria-label"] === "Close menu"),
    "The full-screen mobile menu must have its own visible close control",
  );

  const mobileSheet = view.root.findByProps({ id: "mobile-navigation-dialog" });
  let preventedDefault = false;
  let focusedId = null;
  let focusOptions = null;
  const originalGetElementById = global.document.getElementById;
  global.document.getElementById = (id) => ({
    focus(options) {
      focusedId = id;
      focusOptions = options;
    },
  });
  try {
    mobileSheet.props.onCloseAutoFocus({
      preventDefault() {
        preventedDefault = true;
      },
    });
  } finally {
    global.document.getElementById = originalGetElementById;
  }
  assert.equal(preventedDefault, true);
  assert.equal(focusedId, "mobile-menu-trigger");
  assert.deepEqual(focusOptions, { preventScroll: true });

  const mobileAccount = view.root
    .findAllByType("button")
    .find((node) => textOf(node) === "Account");
  assert.ok(mobileAccount, "Signed-in mobile navigation must expose Account");
  assert.equal(mobileAccount.props["aria-haspopup"], "dialog");
  act(() => mobileAccount.props.onClick());

  dialog = view.root.findByProps({ "data-testid": "account-modal" });
  assert.equal(dialog.props["data-return-focus-id"], "mobile-menu-trigger");
  assert.equal(
    view.root.findAllByType("a").filter((link) => link.props.href === "/profile").length,
    0,
    "Opening Account must close the mobile navigation sheet"
  );
  act(() => view.unmount());
});

test("mobile bottom navigation resolves localized and nested active routes", () => {
  const cases = [
    ["/", "/", true],
    ["/en", "/", true],
    ["/ru", "/", true],
    ["/ru/services", "/services", true],
    ["/en/services/sign-design", "/services", true],
    ["/services/sign-design", "/services", true],
    ["/ru/services/sign-design", "/services", true],
    ["/ru/cart", "/cart", true],
    ["/cart/checkout", "/cart", true],
    ["/blog", "/services", false],
    ["/en/cartful", "/cart", false],
  ];

  for (const [pathname, href, expected] of cases) {
    assert.equal(
      isMobileNavigationActive(pathname, href),
      expected,
      `${pathname} vs ${href}`,
    );
  }
});

test("MobileBottomNav renders four touch targets and animates individual SVG icon parts", () => {
  currentPathname = "/ru/services/sign-design";
  let menuToggles = 0;
  let navigations = 0;
  let view;

  act(() => {
    view = create(
      React.createElement(MobileBottomNav, {
        cartCount: 104,
        menuOpen: false,
        onMenuToggle: () => {
          menuToggles += 1;
        },
        onNavigate: () => {
          navigations += 1;
        },
      }),
    );
  });

  const nav = view.root.findByProps({ "data-testid": "mobile-bottom-nav" });
  assert.equal(nav.props["aria-label"], "Mobile navigation");
  assert.match(nav.props.className, /fixed inset-x-0 bottom-0/);
  assert.match(nav.props.className, /backdrop-blur-2xl/);
  assert.match(nav.props.className, /pb-\[env\(safe-area-inset-bottom\)\]/);
  assert.match(nav.props.className, /lg:hidden/);
  assert.doesNotMatch(nav.props.className, /shadow-|border-|animate-mobile-nav-enter/);

  const links = nav.findAllByType("a");
  assert.deepEqual(
    links.map((link) => link.props.href),
    ["/", "/services", "/cart"],
  );
  for (const link of links) {
    assert.match(link.props.className, /min-h-14/);
    assert.match(link.props.className, /focus-visible:outline-2/);
  }
  for (const label of ["Home", "Services", "Request", "Menu"]) {
    assert.ok(textOf(nav).includes(label), "Missing mobile tab: " + label);
  }
  // Заказы объединены с корзиной: отдельной вкладки «Orders» больше нет.
  assert.ok(!textOf(nav).includes("Orders"), "Orders tab must be merged into Request");

  const home = links.find((link) => link.props.href === "/");
  const homeIcon = home.findByProps({ "data-icon": "home" });
  assert.doesNotMatch(homeIcon.props.className, /is-active/);
  assert.equal(home.props["aria-current"], undefined);

  const services = links.find((link) => link.props.href === "/services");
  assert.equal(services.props["aria-current"], "page");
  const activeIcon = services
    .findAllByType("span")
    .find((span) => String(span.props.className).includes("text-signal"));
  assert.ok(activeIcon, "The active tab must highlight its icon with the signal accent");
  assert.doesNotMatch(
    String(activeIcon.props.className),
    /bg-primary/,
    "The active tab must not paint the icon plaque in the brand yellow",
  );
  assert.doesNotMatch(String(activeIcon.props.className), /animate-mobile-nav-plaque/);

  const serviceIcon = services.findByProps({ "data-icon": "services" });
  assert.match(serviceIcon.props.className, /is-active/);
  const serviceTiles = serviceIcon.findAllByType("rect");
  assert.equal(serviceTiles.length, 4);
  for (const tile of serviceTiles) {
    assert.match(tile.props.className, /mobile-nav-animate-bottom/);
  }
  assert.ok(
    serviceTiles.some((tile) => String(tile.props.className).includes("mobile-nav-delay-3")),
    "The services tiles must have a staggered sequence",
  );

  const cart = links.find((link) => link.props.href === "/cart");
  assert.ok(textOf(cart).includes("99+"));
  const badge = cart
    .findAllByType("span")
    .find((span) => String(span.props.className).includes("bg-destructive"));
  assert.ok(badge, "The cart badge must be rendered");
  assert.doesNotMatch(badge.props.className, /animate-mobile-nav-badge/);
  assert.equal(cart.props["aria-label"], "Open the request — 104 items");
  // Заявка — документ, а не корзина: у иконки нет кружков-колёсиков.
  const requestIcon = cart.findByProps({ "data-icon": "request" });
  assert.equal(requestIcon.findAllByType("circle").length, 0);
  assert.ok(
    requestIcon
      .findAllByType("path")
      .some((path) => path.props.pathLength === 1 && String(path.props.className).includes("mobile-nav-animate-stroke")),
    "The request contour must support stroke drawing",
  );

  const menu = view.root.findByProps({ id: "mobile-menu-trigger" });
  assert.equal(menu.props["aria-expanded"], false);
  assert.equal(menu.props["aria-controls"], "mobile-navigation-dialog");
  assert.equal(menu.props["aria-haspopup"], "dialog");
  const menuIcon = menu.findByProps({ "data-icon": "menu" });
  assert.doesNotMatch(menuIcon.props.className, /is-open/);
  const menuLines = menuIcon.findAllByType("path");
  assert.equal(menuLines.length, 3);
  for (const line of menuLines) {
    assert.match(line.props.className, /mobile-nav-menu-line/);
  }
  for (const part of ["top", "middle", "bottom"]) {
    assert.ok(menuLines.some((line) => String(line.props.className).includes("mobile-nav-menu-" + part)));
  }

  act(() => menu.props.onClick());
  act(() => services.props.onClick());
  assert.equal(menuToggles, 1);
  assert.equal(navigations, 1);

  act(() => {
    view.update(
      React.createElement(MobileBottomNav, {
        cartCount: 104,
        menuOpen: true,
        onMenuToggle: () => {},
        onNavigate: () => {},
      }),
    );
  });
  const openMenu = view.root.findByProps({ id: "mobile-menu-trigger" });
  assert.equal(openMenu.props["aria-expanded"], true);
  const openIcon = openMenu.findByProps({ "data-icon": "menu" });
  assert.match(openIcon.props.className, /is-open/);
  assert.equal(openIcon.findAllByType("path").length, 3, "The same three lines must morph into X");

  act(() => view.unmount());
});

test("mobile navigation animates SVG parts with reduced-motion safeguards", () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, "../components/site/mobile-bottom-nav.tsx"),
    "utf8",
  );
  const globals = fs.readFileSync(
    path.resolve(__dirname, "../styles/globals.css"),
    "utf8",
  );

  for (const className of [
    "mobile-nav-animate-stroke",
    "mobile-nav-animate-bottom",
    "mobile-nav-menu-line",
    "is-active",
    "is-open",
  ]) {
    assert.ok(source.includes(className), "Missing SVG motion part: " + className);
  }
  assert.ok(source.includes("pathLength={1}"), "Drawable paths must use normalized lengths");
  assert.doesNotMatch(
    source,
    /requestAnimationFrame|setInterval|layoutId|animate-mobile-nav-(?:enter|plaque|badge)/,
    "Icon motion must not use JavaScript loops or the retired panel animations",
  );

  for (const name of ["mobile-nav-stroke-in", "mobile-nav-part-from-bottom"]) {
    assert.match(globals, new RegExp(`@keyframes ${name} \\{`));
  }
  const keyframes = globals.match(
    /@keyframes mobile-nav-stroke-in[\s\S]*?(?=@keyframes accordion-down)/,
  )?.[0];
  assert.ok(keyframes, "Mobile icon keyframes must stay grouped");
  assert.match(keyframes, /opacity:/);
  assert.match(keyframes, /translate3d/);
  assert.match(keyframes, /stroke-dashoffset/);
  assert.doesNotMatch(keyframes, /scale\(|zoom/);
  assert.match(globals, /\.mobile-nav-icon\.is-active > \.mobile-nav-animate-stroke/);
  assert.match(globals, /@media \(prefers-reduced-motion: no-preference\)/);
  assert.match(globals, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(globals, /rotate\(45deg\)/);
  assert.match(globals, /rotate\(-45deg\)/);
});

test("Navbar10 shares one cart request between desktop and mobile navigation", async () => {
  sessionStatus = "authenticated";
  let cartRequests = 0;
  global.fetch = async (url) => {
    if (url === "/api/cart") cartRequests += 1;
    return { ok: true, json: async () => ({ count: 7 }) };
  };

  let view;
  await act(async () => {
    view = create(React.createElement(Navbar10));
  });

  assert.equal(cartRequests, 1);
  const desktopCart = view.root.findByProps({ "data-testid": "cart-icon" });
  assert.equal(desktopCart.props["aria-label"], "Open the request — 7 items");
  const mobileNav = view.root.findByProps({ "data-testid": "mobile-bottom-nav" });
  const mobileCart = mobileNav
    .findAllByType("a")
    .find((link) => link.props.href === "/cart");
  assert.equal(mobileCart.props["aria-label"], "Open the request — 7 items");

  act(() => view.unmount());
});

test("mobile navigation coordinates safe-area and fixed UI clearance", () => {
  const read = (file) => fs.readFileSync(path.resolve(__dirname, "..", file), "utf8");
  const layout = read("app/(site)/layout.tsx");
  assert.match(layout, /viewportFit:\s*"cover"/);
  assert.match(layout, /pb-\[var\(--mobile-bottom-nav-clearance\)\]/);

  const globals = read("styles/globals.css");
  assert.match(globals, /--mobile-bottom-nav-height:\s*4\.5rem/);
  assert.match(globals, /env\(safe-area-inset-bottom\)/);

  for (const file of [
    "components/site/cookie-banner.tsx",
    "components/site/services-catalog-view.tsx",
    "components/ui/toast.tsx",
  ]) {
    assert.match(
      read(file),
      /bottom-\[var\(--mobile-bottom-nav-clearance\)\]/,
      `${file} must clear the mobile bottom navigation`,
    );
  }
});

test("Feature314, Community3, and Cta13 render exact studio advantages, SVG logos without visible plain text, and partner copy", () => {
  let fView, cView, ctaView;
  act(() => {
    fView = create(React.createElement(Feature314));
    cView = create(React.createElement(Community3));
    ctaView = create(React.createElement(Cta13));
  });
  const fText = textOf(fView.root);
  assert.ok(fText.includes("Everything is confidential"));
  assert.ok(fText.includes("Individual selection"));
  assert.ok(fText.includes("Ongoing tech support"));

  const rotatingPlusIcons = fView.root
    .findAllByType("svg")
    .filter((icon) => String(icon.props.className).includes("group-hover:rotate-90"));
  assert.equal(
    rotatingPlusIcons.length,
    3,
    "All three Feature314 plus controls must rotate 90 degrees on card hover",
  );
  for (const icon of rotatingPlusIcons) {
    assert.match(icon.props.className, /bg-secondary/);
    // Кружок плюса светлеет при наведении, жёлтый остаётся акцентом текста.
    assert.match(icon.props.className, /group-hover:bg-foreground/);
    assert.doesNotMatch(icon.props.className, /group-hover:bg-primary/);
    assert.match(icon.props.className, /transition-\[transform,background-color,color\]/);
  }
  const featureSource = fs.readFileSync(
    path.resolve(__dirname, "../components/blocks/feature314.tsx"),
    "utf8",
  );
  assert.doesNotMatch(
    featureSource,
    /bg-slate-950\/30|backdrop-blur-xl/,
    "Feature logos and plus controls must not acquire decorative glass backgrounds",
  );

  const cImgs = cView.root.findAllByType("img").map((img) => img.props.src);
  assert.ok(
    cImgs.includes("/assets/logos/lnpip.svg"),
    "Community3 must render standalone symbol mark /assets/logos/lnpip.svg"
  );
  assert.ok(
    cImgs.includes("/assets/logos/ts-connect.svg"),
    "Community3 must render SVG logo /assets/logos/ts-connect.svg"
  );

  const visibleTextOf = (node) => {
    if (node.props && typeof node.props.className === "string" && node.props.className.includes("sr-only")) {
      return "";
    }
    return node.children
      .map((child) => (typeof child === "string" ? child : visibleTextOf(child)))
      .join("");
  };
  const partnerCards = cView.root.findAllByType("a");
  assert.equal(partnerCards.length, 2);
  assert.ok(
    !visibleTextOf(partnerCards[0]).includes("Plus In Plus"),
    "Plus In Plus partner card must not have a visible plain-text caption next to lnpip.svg"
  );
  assert.ok(
    !visibleTextOf(partnerCards[1]).includes("TS Connect"),
    "TS Connect partner card must not have a visible plain-text caption next to ts-connect.svg"
  );

  const cText = textOf(cView.root);
  assert.ok(cText.includes("Our partners and neighbors"));
  assert.ok(cText.includes("TS Connect, an IT firm in Tambov"));
  assert.ok(cText.includes("Plus In Plus"));
  assert.ok(cText.includes("TS Connect"));

  assert.ok(textOf(ctaView.root).includes("Order a design"));
  act(() => {
    fView.unmount();
    cView.unmount();
    ctaView.unmount();
  });
});

test("public UI uses neutral media slots instead of retired stock mockups", () => {
  const artworkFreeFiles = [
    "components/site/hero.tsx",
    "components/site/features.tsx",
    "components/site/media-placeholder.tsx",
    "components/blocks/hero138.tsx",
    "components/blocks/feature314.tsx",
    "components/blocks/navbar10.tsx",
    "components/blocks/signup10.tsx",
    "lib/studio-catalog.ts",
    "lib/data.ts",
    "lib/cart.ts",
    "lib/commerce-data.ts",
    "scripts/seed-services.ts",
  ];
  for (const file of artworkFreeFiles) {
    const source = fs.readFileSync(path.resolve(__dirname, "..", file), "utf8");
    assert.doesNotMatch(source, /\/assets\/shop\//, `${file} must not use retired stock mockups`);
  }

  for (const file of [
    "components/site/features.tsx",
    "components/blocks/hero138.tsx",
    "components/blocks/feature314.tsx",
    "components/blocks/navbar10.tsx",
    "components/blocks/signup10.tsx",
  ]) {
    const source = fs.readFileSync(path.resolve(__dirname, "..", file), "utf8");
    assert.doesNotMatch(
      source,
      /InterfaceMockup|interface-mockups|mockup:\s*"(?:dashboard|mobile|player)"/,
      `${file} must wait for uploaded studio artwork instead of generating interface mockups`,
    );
  }
  assert.equal(
    fs.existsSync(path.resolve(__dirname, "../components/site/interface-mockups.tsx")),
    false,
  );

  // Hero показывает нейтральную медиа-сцену: подпись и плейсхолдер, без стоковых макетов.
  const heroSource = fs.readFileSync(
    path.resolve(__dirname, "../components/blocks/hero138.tsx"),
    "utf8",
  );
  assert.match(heroSource, /MediaPlaceholder|DecryptText/);
  assert.doesNotMatch(heroSource, /\/assets\/shop\//);

  // Тени запрещены во всём интерфейсе.
  const styles = fs.readFileSync(path.resolve(__dirname, "../styles/globals.css"), "utf8");
  assert.doesNotMatch(styles, /box-shadow:|text-shadow:/);

  for (const file of [
    "public/assets/placeholders/service-cover.svg",
    "public/assets/placeholders/post-cover.svg",
  ]) {
    const source = fs.readFileSync(path.resolve(__dirname, "..", file), "utf8");
    assert.doesNotMatch(source, /filter|feGaussianBlur|<circle/);
  }

  const placeholders = require("../lib/content-placeholders.ts");
  assert.equal(
    placeholders.serviceCover("/assets/shop/retired-stock.jpg"),
    placeholders.SERVICE_COVER_PLACEHOLDER,
  );
  assert.equal(
    placeholders.postCover(null),
    placeholders.POST_COVER_PLACEHOLDER,
  );
  assert.equal(
    placeholders.serviceCover("/uploads/services/customer-cover.webp"),
    "/uploads/services/customer-cover.webp",
  );
});

test("Blog11 and Blogpost11 render We're Up and Running with all 4 verbatim sections and post navigation", () => {
  let listView, postView;
  act(() => {
    listView = create(React.createElement(Blog11, {
      heading: "News from Plus In Plus",
      posts: STUDIO_BLOG_POSTS.map(toBlogCardData),
    }));
    postView = create(
      React.createElement(Blogpost11, {
        post: STUDIO_BLOG_POSTS[0],
        previousPost: STUDIO_BLOG_POSTS[1],
        nextPost: STUDIO_BLOG_POSTS[2],
      })
    );
  });
  assert.ok(textOf(listView.root).includes("News from Plus In Plus"));
  assert.equal(COVER_IMAGE_GUIDES.blog.aspectRatio, "4:3");
  assert.equal(COVER_IMAGE_GUIDES.blog.recommended, "1,600 × 1,200 px");
  assert.equal(COVER_IMAGE_GUIDES.services.aspectRatio, "4:3");
  assert.equal(COVER_IMAGE_GUIDES.services.recommended, "1,600 × 1,200 px");
  assert.ok(
    listView.root.findAllByType("img").every((image) => /object-cover/.test(image.props.className)),
    "обложки кадрируются по 4:3, а не вписываются с полями",
  );
  assert.ok(
    listView.root.findAllByProps({ className: "relative aspect-[4/3] overflow-hidden bg-muted" }).length > 0,
    "контейнер обложки держит соотношение 4:3",
  );
  assert.ok(postView.root.findAllByType("img").every((image) => /object-contain/.test(image.props.className)));
  const postText = textOf(postView.root);
  for (const snippet of [
    "We're Up and Running",
    "October 7, 2026 · 4-minute read",
    "It's Not Just About Design",
    "Why We Needed a New Website",
    "Experience That Grows Alongside Our Products",
    "What's Next",
    "Previous",
    "Next",
  ]) {
    assert.ok(postText.includes(snippet), `Missing blog post text: ${snippet}`);
  }
  act(() => {
    listView.unmount();
    postView.unmount();
  });
});

test("Blogpost11 gives explicit CMS HTML precedence over preset sections", () => {
  const post = {
    ...STUDIO_BLOG_POSTS[0],
    title: "Database title",
    htmlContent: "<h2>Database body</h2><p>Managed in Admin</p>",
  };
  let view;
  act(() => {
    view = create(React.createElement(Blogpost11, { post }));
  });
  const html = view.root.findAllByType("div").find((node) => node.props.dangerouslySetInnerHTML);
  assert.equal(html.props.dangerouslySetInnerHTML.__html, post.htmlContent);
  assert.doesNotMatch(textOf(view.root), /It's Not Just About Design/);
  act(() => view.unmount());
});

test("Blogpost11 omits the quote figure when the CMS author supplied no quote", () => {
  const post = {
    ...STUDIO_BLOG_POSTS[0],
    quote: undefined,
    quoteAttribution: undefined,
    author: undefined,
    htmlContent: "<p>Only the author-managed body</p>",
  };
  let view;
  act(() => {
    view = create(React.createElement(Blogpost11, { post }));
  });
  assert.equal(view.root.findAllByType("figure").length, 0);
  assert.doesNotMatch(textOf(view.root), /Plus In Plus Studio|Plus In Plus Editorial|We care not only about how a single screen looks/);
  act(() => view.unmount());
});

test("Blog11 renders its localized empty state and translated category labels", () => {
  let emptyView, categoryView;
  act(() => {
    emptyView = create(React.createElement(Blog11, {
      posts: [],
      emptyTitle: "Пока нет статей",
      emptyDescription: "Скоро опубликуем первую статью.",
    }));
    categoryView = create(React.createElement(Blog11, {
      posts: [{ ...STUDIO_BLOG_POSTS[0], title: "Database article", category: "Design" }],
      categoryLabels: { Design: "Дизайн" },
    }));
  });
  const emptyText = textOf(emptyView.root);
  assert.match(emptyText, /Пока нет статей/);
  assert.match(emptyText, /Скоро опубликуем первую статью/);
  const categoryText = textOf(categoryView.root);
  assert.equal(categoryText.split("Дизайн").length - 1, 2);
  act(() => {
    emptyView.unmount();
    categoryView.unmount();
  });
});

test("a pending invoice without a stored URL still offers the authenticated regeneration route", () => {
  const order = {
    id: "ord-7",
    orderNumber: "ПИП-000007",
    number: "ПИП-000007",
    status: "awaiting_payment",
    estimatedAmount: 100_000,
    total: 100_000,
    finalPrice: null,
    currency: "RUB",
    deadline: null,
    description: null,
    customerNote: null,
    managerNote: null,
    isLocked: false,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    items: [],
    services: [],
    invoices: [{
      id: "pay-7",
      status: "pending",
      amount: 100_000,
      currency: "RUB",
      paymentUrl: null,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      paidAt: null,
    }],
  };
  let view;
  act(() => {
    view = create(React.createElement(OrderCard, { order }));
  });
  const paymentForms = view.root.findAllByType("form").filter((form) =>
    form.props.action === "/api/payment/create");
  assert.equal(paymentForms.length, 1);
  assert.equal(paymentForms[0].props.method, "POST");
  const orderInput = paymentForms[0].findByProps({ name: "orderId" });
  assert.equal(orderInput.props.value, "ord-7");
  assert.match(textOf(paymentForms[0]), /Pay/);
  assert.equal(view.root.findAllByType("a").filter((link) =>
    String(link.props.href).startsWith("/api/payment/create")).length, 0);
  act(() => view.unmount());
});

/** Заказ таким, каким его видит клиент в объединённом списке. */
const customerOrder = (overrides = {}) => ({
  id: "ord-7",
  orderNumber: "ПИП-000007",
  number: "ПИП-000007",
  status: "awaiting_payment",
  estimatedAmount: 100_000,
  total: 100_000,
  finalPrice: null,
  currency: "RUB",
  deadline: null,
  description: null,
  customerNote: null,
  managerNote: null,
  isLocked: false,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  paidAt: null,
  items: [],
  services: [],
  invoices: [],
  ...overrides,
});

const succeededInvoice = {
  id: "pay-9",
  status: "succeeded",
  amount: 100_000,
  currency: "RUB",
  paymentUrl: null,
  createdAt: new Date("2026-01-02T00:00:00Z"),
  paidAt: new Date("2026-01-02T00:00:00Z"),
};

const buttonByText = (root, text) =>
  root.findAllByType("button").find((node) => textOf(node).includes(text));

test("the merged /cart page shows the cart and the submitted orders together", async () => {
  sessionStatus = "authenticated";
  customerOrders = [customerOrder()];
  global.fetch = async () => ({ ok: true, json: async () => ({ items: [], count: 0 }) });

  const page = await CartPage();
  let view;
  await act(async () => {
    view = create(page);
  });

  const text = textOf(view.root);
  assert.match(text, /Request and orders/, "the page owns both flows");
  assert.match(text, /RequestYour request is empty/, "the request section is rendered");
  assert.match(text, /Your request is empty/, "an empty request no longer hides the orders");
  assert.match(text, /My orders/, "the orders section is rendered");
  assert.match(text, /ПИП-000007/, "the submitted order is listed under the cart");
  assert.ok(buttonByText(view.root, "Cancel order"), "the order can be cancelled in place");
  act(() => view.unmount());
});

test("the merged /cart page sends an anonymous visitor to the login page", async () => {
  sessionStatus = "unauthenticated";
  await assert.rejects(async () => CartPage(), /REDIRECT:\/login/);
});

test("/orders is a redirect to the merged cart page", () => {
  assert.throws(() => OrdersPage(), /REDIRECT:\/cart/);
});

test("an unpaid request can be cancelled by its owner after a confirmation", async () => {
  let view;
  act(() => {
    view = create(React.createElement(OrderCard, { order: customerOrder() }));
  });
  assert.match(
    textOf(view.root),
    /You can cancel while the order is unpaid and work has not started/,
  );

  await act(async () => {
    buttonByText(view.root, "Cancel order").props.onClick();
  });
  const confirming = textOf(view.root);
  assert.match(confirming, /Cancel order ПИП-000007\?/);
  assert.match(confirming, /Keep the order/);
  assert.equal(cancelCalls.length, 0, "the action must not run before the confirmation");

  await act(async () => {
    buttonByText(view.root, "Cancel order").props.onClick();
  });
  assert.deepEqual(cancelCalls, [{ orderId: "ord-7" }]);
  assert.equal(refreshed, 1, "the server-rendered order list must be reloaded");
  act(() => view.unmount());
});

test("paid, in-work and closed orders cannot be cancelled by the customer", () => {
  const cases = [
    ["paid", [succeededInvoice]],
    ["in_progress", [succeededInvoice]],
    ["completed", [succeededInvoice]],
    ["cancelled", []],
    ["refunded", []],
  ];

  for (const [status, invoices] of cases) {
    let view;
    act(() => {
      view = create(
        React.createElement(OrderCard, { order: customerOrder({ status, invoices }) }),
      );
    });
    assert.equal(
      buttonByText(view.root, "Cancel order"),
      undefined,
      `${status} must not offer self-service cancellation`,
    );
    const text = textOf(view.root);
    if (status === "paid" || status === "in_progress" || status === "completed") {
      assert.match(
        text,
        /can no longer be cancelled online/,
        `${status} must explain why cancellation is unavailable`,
      );
    }
    act(() => view.unmount());
  }
});

test("a rejected cancellation keeps the order open and reports the server message", async () => {
  cancelResult = {
    ok: false,
    error: "A paid order cannot be cancelled online. Please contact us.",
  };

  let view;
  act(() => {
    view = create(React.createElement(OrderCard, { order: customerOrder() }));
  });
  await act(async () => {
    buttonByText(view.root, "Cancel order").props.onClick();
  });
  await act(async () => {
    buttonByText(view.root, "Cancel order").props.onClick();
  });

  assert.deepEqual(cancelCalls, [{ orderId: "ord-7" }]);
  assert.equal(refreshed, 0, "a failed cancellation must not reload the list");
  assert.match(textOf(view.root), /Cancel order ПИП-000007\?/, "the confirmation stays open");
  act(() => view.unmount());
});

test("the header no longer offers a separate Orders control", async () => {
  sessionStatus = "authenticated";
  global.fetch = async () => ({ ok: true, json: async () => ({ count: 2 }) });

  let view;
  await act(async () => {
    view = create(React.createElement(Navbar10));
  });

  const assertNoOrdersControl = () => {
    assert.equal(
      view.root.findAllByType("a").filter((link) => link.props.href === "/orders").length,
      0,
      "no header link may point at /orders",
    );
    assert.equal(
      view.root
        .findAllByType("button")
        .filter((button) => textOf(button).trim() === "Orders").length,
      0,
      "no header button may be labelled Orders",
    );
  };

  assertNoOrdersControl();

  // То же самое с раскрытым мобильным меню — кнопка «Заказы» убрана и оттуда.
  await act(async () => {
    view.root.findByProps({ id: "mobile-menu-trigger" }).props.onClick();
  });
  assertNoOrdersControl();
  assert.ok(
    view.root.findAllByType("a").some((link) => link.props.href === "/cart"),
    "the cart stays reachable from the header",
  );
  act(() => view.unmount());
});

test("Services11Catalog, ProductDetail1, and Contact29 render all required fields and Sign Design details", () => {
  const smallServices = STUDIO_SERVICES.filter((s) => s.category === "small");
  const largeServices = STUDIO_SERVICES.filter((s) => s.category === "large");
  assert.equal(smallServices.length, 4);
  assert.equal(largeServices.length, 4);

  let shopSmall, shopLarge, detailView, contactView;
  act(() => {
    shopSmall = create(
      React.createElement(Services11Catalog, {
        heading: "Small designs",
        services: smallServices,
      })
    );
    shopLarge = create(
      React.createElement(Services11Catalog, {
        heading: "Large designs",
        subtitle: "Above It All. Rough Roads, Louder Message.",
        services: largeServices,
      })
    );
    detailView = create(
      React.createElement(ProductDetail1, { service: STUDIO_SERVICES[0] })
    );
    contactView = create(React.createElement(Contact29));
  });

  assert.ok(textOf(shopSmall.root).includes("Sign Design"));
  assert.ok(textOf(shopSmall.root).includes("Bag Design"));
  assert.ok(textOf(shopSmall.root).includes("Outdoor glass poster"));
  assert.ok(textOf(shopSmall.root).includes("Banner Design"));
  assert.ok(textOf(shopLarge.root).includes("Above It All. Rough Roads, Louder Message."));
  assert.ok(textOf(shopLarge.root).includes("Large Billboard on a building"));
  assert.ok(textOf(shopLarge.root).includes("Rooftop advertising"));
  assert.ok(textOf(shopLarge.root).includes("Advertisement on the fence"));
  assert.ok(textOf(shopLarge.root).includes("Billboard"));
  assert.ok(shopSmall.root.findAllByType("img").every((image) => /object-contain/.test(image.props.className)));
  assert.ok(shopLarge.root.findAllByType("img").every((image) => /object-contain/.test(image.props.className)));
  assert.ok(detailView.root.findAllByType("img").every((image) => /object-contain/.test(image.props.className)));

  const detailText = textOf(detailView.root);
  assert.ok(detailText.includes("Sign Design"));
  assert.ok(detailText.includes("Order"));
  assert.ok(detailText.includes("Our service includes"));
  assert.ok(detailText.includes("Any shape, any idea"));
  assert.ok(detailText.includes("The result"));
  const definitionList = detailView.root.findByType("dl");
  assert.equal(definitionList.children.length, 3);
  assert.ok(definitionList.children.every((child) => child.type === "div"));

  const step1Text = textOf(contactView.root);
  assert.ok(step1Text.includes("Contact us"));
  assert.ok(step1Text.includes("Continue"));

  act(() => {
    const firstCard = contactView.root
      .findAllByType("button")
      .find((b) => textOf(b).includes("Sign Design"));
    firstCard.props.onClick();
  });
  act(() => {
    const continueBtn = contactView.root
      .findAllByType("button")
      .find((b) => textOf(b).includes("Continue"));
    continueBtn.props.onClick();
  });

  const contactText = textOf(contactView.root);
  for (const label of ["Contact us", "First name", "Last name", "Email", "Message", "Send"]) {
    assert.ok(contactText.includes(label), `Missing Contact29 label: ${label}`);
  }

  act(() => {
    shopSmall.unmount();
    shopLarge.unmount();
    detailView.unmount();
    contactView.unmount();
  });
});

test("ServiceConfigurator calculates live estimate and zero legacy brand colors exist in codebase", async () => {
  sessionStatus = "authenticated";
  let submitted = null;
  let view;
  act(() => {
    view = create(
      React.createElement(ServiceConfigurator, {
        pricing: {
          serviceId: "svc-sign-design",
          title: "Sign Design",
          basePrice: 1_500_000,
          priceType: "from",
          currency: "RUB",
          isOrderable: true,
          groups: [
            {
              id: "g1",
              name: "Material",
              required: true,
              sortOrder: 1,
              options: [
                { id: "o1", label: "PVC 5 mm", priceDelta: 0, priceFactor: 1, isDefault: true, sortOrder: 1 },
                { id: "o2", label: "Acrylic 5 mm", priceDelta: 400_000, priceFactor: 1, isDefault: false, sortOrder: 2 },
              ],
            },
          ],
        },
        onSubmit: async (ids) => {
          submitted = ids;
          return { ok: true, orderNumber: "PIP-000101" };
        },
      })
    );
  });

  await act(async () => {
    await view.root.findByType("form").props.onSubmit({ preventDefault() {} });
  });
  assert.deepEqual(submitted, ["o1"]);
  assert.match(textOf(view.root), /PIP-000101/);
  act(() => view.unmount());

  // Architectural invariant: zero legacy colors or zoom/scale animations anywhere in app/, components/, lib/, styles/
  const forbiddenColors = /#052B42|#00C56D|#CFE0FF|#397248|#B4232A|#F0F0F0/i;
  const forbiddenZoom = /zoom-in-|zoom-out-|hover:scale-|group-hover:scale-|active:scale-/;
  const dirs = ["app", "components", "lib", "styles"];
  function scan(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "generated") continue;
        scan(full);
      } else if (/\.(ts|tsx|css|md)$/.test(entry.name)) {
        const src = fs.readFileSync(full, "utf8");
        assert.doesNotMatch(src, forbiddenColors, `Forbidden legacy color found in ${full}`);
        assert.doesNotMatch(src, forbiddenZoom, `Forbidden zoom/scale animation found in ${full}`);
      }
    }
  }
  for (const d of dirs) scan(path.join(__dirname, "..", d));
});


test("CookieBanner asks once, remembers the choice, and reveals detailed preferences", async () => {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const storage = new Map();
  global.window.localStorage = {
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
  };
  const buttons = (view) => view.root.findAllByType("button");
  const buttonText = (node) => textOf(node).trim();

  // 1. До истечения задержки баннера нет — страница открывается без прыжков.
  let view;
  act(() => {
    view = create(React.createElement(CookieBanner));
  });
  assert.ok(!view.root.findAllByType("button").length, "banner must stay hidden before the delay");

  // 2. Через секунду баннер появляется с тремя вариантами действий.
  await act(async () => {
    await sleep(1300);
  });
  const labels = buttons(view).map(buttonText);
  assert.ok(labels.includes("🍪 We use cookies") || textOf(view.root).includes("We use cookies"), "banner title missing");
  for (const action of ["Accept all", "Reject all", "Customize"]) {
    assert.ok(labels.includes(action), `missing action: ${action}`);
  }

  // 3. «Customize» раскрывает настройки, необходимые cookie всегда включены.
  act(() => {
    buttons(view).find((button) => buttonText(button) === "Customize").props.onClick();
  });
  let text = textOf(view.root);
  for (const section of ["Cookie preferences", "Necessary cookies", "Analytics cookies", "Marketing cookies", "Functional cookies", "Always on", "Save preferences"]) {
    assert.ok(text.includes(section), `missing preferences section: ${section}`);
  }

  // 4. Переключаем аналитику и сохраняем: в localStorage попадает выбор.
  const switches = buttons(view).filter((button) => button.props.role === "switch");
  assert.equal(switches.length, 3, "expected three toggle switches");
  act(() => {
    switches[0].props.onClick(); // analytics on
    switches[1].props.onClick(); // marketing on, вернём обратно
    switches[1].props.onClick();
  });
  act(() => {
    buttons(view).find((button) => buttonText(button) === "Save preferences").props.onClick();
  });
  assert.ok(!view.root.findAllByType("button").length, "banner must close after saving");
  const saved = JSON.parse(storage.get("cookie-consent"));
  assert.equal(saved.analytics, true);
  assert.equal(saved.marketing, false);
  assert.equal(saved.functional, false);
  assert.equal(saved.necessary, true);
  assert.ok(saved.timestamp, "consent timestamp missing");

  // 5. Повторный визит: баннер больше не показывается.
  let secondVisit;
  act(() => {
    secondVisit = create(React.createElement(CookieBanner));
  });
  await act(async () => {
    await sleep(1300);
  });
  assert.ok(!secondVisit.root.findAllByType("button").length, "banner must not reappear after consent");
  act(() => secondVisit.unmount());

  // 6. «Accept all» включает все категории и закрывает баннер.
  storage.delete("cookie-consent");
  let third;
  act(() => {
    third = create(React.createElement(CookieBanner));
  });
  await act(async () => {
    await sleep(1300);
  });
  act(() => {
    buttons(third).find((button) => buttonText(button) === "Accept all").props.onClick();
  });
  const accepted = JSON.parse(storage.get("cookie-consent"));
  assert.equal(accepted.analytics, true);
  assert.equal(accepted.marketing, true);
  assert.equal(accepted.functional, true);
  assert.ok(!third.root.findAllByType("button").length, "banner must close after accept all");
  act(() => third.unmount());
  act(() => view.unmount());
});

test("Signup10 centers brand mark and headings, and CandlestickChart uses dark Hero 138 contrast", () => {
  let authView, chartView;
  act(() => {
    authView = create(React.createElement(Signup10, { mode: "login" }));
    chartView = create(
      React.createElement(CandlestickChart, {
        data: [
          {
            date: "2026-10-20",
            label: "20.10",
            open: 1_000_000,
            high: 2_300_000,
            low: 950_000,
            close: 2_300_000,
            volume: 3_250_000,
          },
        ],
        valueKind: "money",
        labels: {
          open: "Open",
          high: "High",
          low: "Low",
          close: "Close",
          volume: "Volume",
          empty: "No data",
        },
      })
    );
  });

  // Композиция login-02: заголовок по центру, знак — в углу колонки формы.
  const heading = authView.root.findByType("h1");
  assert.match(heading.props.className, /\btext-center\b/);
  const signupSource = fs.readFileSync(
    path.resolve(__dirname, "../components/blocks/signup10.tsx"),
    "utf8",
  );
  assert.match(signupSource, /flex justify-center md:justify-start/, "знак стоит в углу на десктопе");
  assert.match(signupSource, /lg:grid-cols-2/, "вход остаётся двухколоночным");
  assert.doesNotMatch(
    signupSource,
    /assets\/agents|lumi-poster/,
    "постер закрытого ИИ-направления не возвращается на вход",
  );
  assert.doesNotMatch(signupSource, /\/assets\/shop\//, "стоковые мокапы не возвращаются");
  const logoLink = authView.root.findAllByType("a").find((a) => a.props.href === "/");
  assert.match(logoLink.props.className, /\binline-flex\b/);
  assert.equal(logoLink.findByType("img").props.src, "/assets/logos/lnpip.svg");

  const svgTexts = chartView.root.findAllByType("text");
  assert.ok(svgTexts.length > 0);
  for (const t of svgTexts) {
    assert.equal(t.props.fill, "rgba(250, 250, 250, 0.56)");
  }

  act(() => {
    authView.unmount();
    chartView.unmount();
  });
});

test("interface copy contains no emoji glyphs; controls use icon components", () => {
  const emoji = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  const files = [];
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(target);
      else if (entry.isFile() && entry.name.endsWith(".tsx")) files.push(target);
    }
  };
  walk(path.resolve(__dirname, "../app"));
  walk(path.resolve(__dirname, "../components"));
  files.push(path.resolve(__dirname, "../messages/en.json"));
  files.push(path.resolve(__dirname, "../messages/ru.json"));
  for (const file of files) {
    assert.equal(emoji.test(fs.readFileSync(file, "utf8")), false, `emoji in ${path.relative(process.cwd(), file)}`);
  }
});

test("card hover and reveal motion stay layout-stable and preserve scroll anchors", () => {
  let featureView;
  let communityView;
  act(() => {
    featureView = create(React.createElement(Feature314));
    communityView = create(React.createElement(Community3));
  });

  const cards = [featureView, communityView].flatMap((view) =>
    view.root.findAllByType("div").filter((node) =>
      String(node.props.className).includes("glass-surface"),
    ),
  );
  assert.equal(cards.length, 5);
  for (const card of cards) {
    assert.doesNotMatch(card.props.className, /hover:-translate|group-hover:-translate/);
    assert.equal(card.props["data-reveal"], "");
  }
  for (const view of [featureView, communityView]) {
    assert.match(view.root.findByType("section").props.className, /motion-section/);
  }

  const globals = fs.readFileSync(path.resolve(__dirname, "../styles/globals.css"), "utf8");
  assert.match(globals, /overflow-anchor:\s*none/);
  assert.match(globals, /@media \(prefers-reduced-motion: reduce\)/);

  act(() => {
    featureView.unmount();
    communityView.unmount();
  });
});

test("DecryptText keeps readable stable glyphs and resolves a single scramble", () => {
  let now = 0;
  let nextFrame = 0;
  const frames = new Map();
  global.requestAnimationFrame = (callback) => {
    const id = ++nextFrame;
    frames.set(id, callback);
    return id;
  };
  global.cancelAnimationFrame = (id) => frames.delete(id);
  Object.defineProperty(global, "performance", {
    configurable: true,
    // React 19 development builds use User Timing around render work.
    value: { now: () => now, measure() {}, clearMeasures() {} },
  });
  global.window.matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  });

  let rootNode;
  const characters = [];
  let view;
  act(() => {
    view = create(
      React.createElement(DecryptText, {
        text: "Плюс UI",
        trigger: "mount",
        startDelay: 0,
        stagger: 20,
        jitter: 0,
      }),
      {
        createNodeMock(element) {
          if (element.props["data-decrypt-text"] !== undefined) {
            rootNode = { dataset: { decryptState: "idle" } };
            return rootNode;
          }
          if (element.props["data-character"] !== undefined) {
            const node = {
              dataset: {
                character: element.props["data-character"],
                state: "plain",
              },
              textContent: element.props.children,
            };
            characters.push(node);
            return node;
          }
          return null;
        },
      },
    );
  });

  assert.equal(view.root.findAll((node) => node.props.className === "sr-only").length, 1);
  assert.equal(view.root.findAll((node) => node.props.className === "invisible").length, 6);
  assert.equal(characters.length, 6);
  assert.equal(rootNode.dataset.decryptState, "scrambling");

  for (let index = 0; index < 80 && rootNode.dataset.decryptState !== "complete"; index += 1) {
    now += 50;
    const batch = [...frames.values()];
    frames.clear();
    for (const callback of batch) callback(now);
  }

  assert.equal(rootNode.dataset.decryptState, "complete");
  assert.equal(frames.size, 0);
  for (const character of characters) {
    assert.equal(character.textContent, character.dataset.character);
    assert.equal(character.dataset.state, "lock");
  }
  act(() => view.unmount());
});

test("ScrollExperience smooths desktop anchors and reveals below-fold content", async () => {
  class FakeHTMLElement {
    constructor(top) {
      this.top = top;
      this.dataset = { reveal: "" };
      this.style = { setProperty() {} };
    }
    hasAttribute(name) {
      return name === "data-reveal";
    }
    querySelectorAll() {
      return [];
    }
    getBoundingClientRect() {
      return { top: this.top, bottom: this.top + 100 };
    }
  }

  const belowFold = new FakeHTMLElement(1200);
  global.HTMLElement = FakeHTMLElement;
  global.window.innerHeight = 800;
  global.window.matchMedia = (query) => ({
    matches: query.includes("pointer: fine"),
    addEventListener() {},
    removeEventListener() {},
  });
  const windowListeners = new Map();
  global.window.addEventListener = (type, listener) => windowListeners.set(type, listener);
  global.window.removeEventListener = (type) => windowListeners.delete(type);
  global.document = {
    body: {},
    querySelectorAll: (selector) => (selector === "[data-reveal]" ? [belowFold] : []),
  };

  let intersectionObserver;
  global.IntersectionObserver = class {
    constructor(callback) {
      this.callback = callback;
      intersectionObserver = this;
    }
    observe(element) {
      this.element = element;
    }
    unobserve() {}
    disconnect() {}
  };
  global.MutationObserver = class {
    observe() {}
    disconnect() {}
  };

  let view;
  await act(async () => {
    view = create(React.createElement(ScrollExperience));
    await new Promise((resolve) => setImmediate(resolve));
  });

  // Lenis is an optional, lazily loaded enhancement: до первого жеста колесом
  // чанк не скачивается, поэтому активируем его явно.
  assert.equal(lenisInstances.length, 0);
  await act(async () => {
    windowListeners.get("wheel")();
    await new Promise((resolve) => setImmediate(resolve));
  });

  assert.equal(belowFold.dataset.reveal, "pending");
  assert.equal(intersectionObserver.element, belowFold);
  assert.equal(lenisInstances.length, 1);
  assert.equal(lenisInstances[0].options.anchors, true);
  assert.equal(lenisInstances[0].options.autoRaf, true);
  assert.equal(lenisInstances[0].options.syncTouch, false);

  act(() => {
    intersectionObserver.callback([{ isIntersecting: true, target: belowFold }]);
  });
  assert.equal(belowFold.dataset.reveal, "visible");

  act(() => view.unmount());
  assert.equal(lenisInstances[0].destroyed, true);
});

test("reduced motion resolves decrypt text and bypasses Lenis without hiding content", () => {
  const reducedQuery = (query) => ({
    matches: query.includes("prefers-reduced-motion"),
    addEventListener() {},
    removeEventListener() {},
  });
  global.window.matchMedia = reducedQuery;
  const element = {
    dataset: { reveal: "" },
  };
  global.document = {
    querySelectorAll: () => [element],
  };

  let rootNode;
  let characterNode;
  let decryptView;
  let scrollView;
  act(() => {
    decryptView = create(React.createElement(DecryptText, { text: "A", trigger: "mount" }), {
      createNodeMock(host) {
        if (host.props["data-decrypt-text"] !== undefined) {
          rootNode = { dataset: { decryptState: "idle" } };
          return rootNode;
        }
        if (host.props["data-character"] !== undefined) {
          characterNode = {
            dataset: { character: "A", state: "plain" },
            textContent: "A",
          };
          return characterNode;
        }
        return null;
      },
    });
    scrollView = create(React.createElement(ScrollExperience));
  });

  assert.equal(rootNode.dataset.decryptState, "complete");
  assert.equal(characterNode.textContent, "A");
  assert.equal(element.dataset.reveal, "visible");
  assert.equal(lenisInstances.length, 0);

  act(() => {
    decryptView.unmount();
    scrollView.unmount();
  });
});

test("меню шапки не закрывается при выходе курсора с триггера", () => {
  const navbar = fs.readFileSync(
    path.resolve(__dirname, "../components/blocks/navbar10.tsx"),
    "utf8",
  );

  // Панель живёт в Viewport, вне пункта меню: если закрывать по pointerleave
  // пункта, меню захлопывается по пути к содержимому.
  const item = navbar.slice(
    navbar.indexOf("<NavigationMenuItem\n        key={`desktop-menu-item-${index}`}"),
  );
  const itemTag = item.slice(0, item.indexOf(">"));
  assert.equal(
    /onPointerLeave/.test(itemTag),
    false,
    "выход из триггера не должен закрывать меню",
  );

  assert.match(navbar, /onPointerEnter=\{\(\) => onOpen\?\.\(value\)\}/, "наведение открывает раздел");
  assert.match(
    navbar,
    /onPointerEnter=\{\(\) => onPanelEnter\?\.\(value\)\}/,
    "вход в панель отменяет отложенное закрытие",
  );
  assert.match(navbar, /}, 260\);/, "закрытие откладывается на 260 мс");
});
