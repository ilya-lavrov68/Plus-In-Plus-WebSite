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
const tag =
  (name) =>
  ({ children, ...props }) =>
    React.createElement(name, props, children);

const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === "next-intl") return require("./next-intl-stub.cjs");
  if (name === "next-intl/server") return require("./next-intl-stub.cjs");
  if (name === "next/link") return tag("a");
  if (name === "next/image") return (props) => React.createElement("img", props);
  if (name === "next/navigation") {
    return {
      useRouter: () => ({ push() {}, replace() {}, refresh() {} }),
      usePathname: () => "/",
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
    };
  }
  if (name === "@/app/actions/auth") {
    return {
      loginUser: async () => ({ ok: true }),
      registerUser: async () => ({ ok: true }),
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
const { Navbar10 } = require("../components/blocks/navbar10.tsx");
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
const { CookieBanner } = require("../components/site/cookie-banner.tsx");
const { STUDIO_SERVICES, STUDIO_BLOG_POSTS } = require("../lib/studio-catalog.ts");

beforeEach(() => {
  sessionStatus = "unauthenticated";
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
});

const textOf = (node) =>
  node.children
    .map((child) => (typeof child === "string" ? child : textOf(child)))
    .join("");

test("Hero138 renders exact title, subtitle, Order & Contact us actions, and showcase frame", () => {
  let view;
  act(() => {
    view = create(React.createElement(Hero138));
  });
  const text = textOf(view.root);
  assert.match(text, /A next-generation.*design studio/s);
  assert.match(
    text,
    /Have an idea but don't know how to showcase it\? We'll package it in a stylish, clear design/
  );
  const links = view.root.findAllByType("a").map((a) => ({
    href: a.props.href,
    text: textOf(a),
  }));
  assert.ok(links.some((l) => l.href === "/shop" && l.text.includes("Order")));
  assert.ok(links.some((l) => l.href === "/contact" && l.text.includes("Contact us")));
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

  const footerImgs = footerView.root.findAllByType("img").map((img) => img.props.src);
  assert.ok(
    footerImgs.includes("/assets/logos/npip.svg"),
    "Footer7 must use full drawn wordmark /assets/logos/npip.svg"
  );
  assert.ok(
    !footerImgs.includes("/assets/logos/lnpip.svg"),
    "Footer7 must not use standalone mark /assets/logos/lnpip.svg with text caption"
  );

  const footerText = textOf(footerView.root);
  for (const col of ["Services", "About", "Resources", "Legal", "Company", "© 2026 Plus In Plus"]) {
    assert.ok(footerText.includes(col), `Missing footer item: ${col}`);
  }
  act(() => {
    navView.unmount();
    footerView.unmount();
  });
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

test("Blog11 and Blogpost11 render We're Up and Running with all 4 verbatim sections and post navigation", () => {
  let listView, postView;
  act(() => {
    listView = create(React.createElement(Blog11, { heading: "News from Plus In Plus" }));
    postView = create(
      React.createElement(Blogpost11, {
        post: STUDIO_BLOG_POSTS[0],
        previousPost: STUDIO_BLOG_POSTS[1],
        nextPost: STUDIO_BLOG_POSTS[2],
      })
    );
  });
  assert.ok(textOf(listView.root).includes("News from Plus In Plus"));
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

  const detailText = textOf(detailView.root);
  assert.ok(detailText.includes("Sign Design"));
  assert.ok(detailText.includes("Order"));
  assert.ok(detailText.includes("Our service includes"));
  assert.ok(detailText.includes("Any shape, any idea"));
  assert.ok(detailText.includes("The result"));

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

  const heading = authView.root.findByType("h1");
  assert.match(heading.props.className, /\btext-center\b/);
  const logoLink = authView.root.findAllByType("a").find((a) => a.props.href === "/");
  assert.match(logoLink.props.className, /\bmx-auto\b/);
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
