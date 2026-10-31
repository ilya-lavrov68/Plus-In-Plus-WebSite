const assert = require("node:assert/strict");
const { beforeEach, test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

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

const messages = require("../messages/en.json");
let productRows = [];
let publishedServices = [];
let publishedPosts = [];
let settingRows = [];
let settingQueries = [];

const prisma = {
  product: {
    findMany: async ({ where } = {}) =>
      productRows.filter((row) => !where?.isActive || row.isActive),
    count: async ({ where } = {}) =>
      productRows.filter((row) => !where?.isActive || row.isActive).length,
  },
  siteSetting: {
    findMany: async (query) => {
      settingQueries.push(structuredClone(query));
      return structuredClone(settingRows);
    },
  },
};

const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === "@/lib/prisma") return { prisma };
  if (name === "@/lib/request-locale") {
    return { getRequestLocale: async () => "en" };
  }
  if (name === "@/lib/server-i18n") {
    return {
      getRequestTranslations: async (namespace) => (key) =>
        messages[namespace][key],
    };
  }
  if (name === "@/lib/seo") {
    return {
      absoluteUrl: (value) => new URL(value, "https://example.test").toString(),
      createPageMetadata: (options) => ({
        title: options.title,
        description: options.description,
      }),
    };
  }
  if (name === "@/lib/data") {
    return {
      getSitemapServices: async () => publishedServices,
      getSitemapPosts: async () => publishedPosts,
      serviceHref: (service) => `/shop/${encodeURIComponent(service.slug || service.id)}`,
    };
  }
  if (name === "@/components/site/shop-catalog-view") {
    return { ShopCatalogView: () => null };
  }
  if (name === "@/components/ai/ai-page-view") {
    return { AiPageView: () => null };
  }
  if (name.startsWith("@/")) {
    name = path.resolve(__dirname, "..", name.slice(2));
  }
  return originalLoad.call(this, name, parent, isMain);
};

const shopPage = require("../app/(site)/shop/(index)/page.tsx");
const aiPage = require("../app/(site)/ai/page.tsx");
const sitemap = require("../app/(site)/sitemap.ts").default;
const { getPublicSiteSettings } = require("../lib/public-site-settings.ts");
const {
  normalizePublicSiteSettings,
  PUBLIC_SITE_SETTING_KEYS,
} = require("../lib/site-settings.ts");

beforeEach(() => {
  productRows = [];
  publishedServices = [];
  publishedPosts = [];
  settingRows = [];
  settingQueries = [];
});

test("empty shop keeps coming-soon metadata and stays out of sitemap while public service routes remain indexed", async () => {
  publishedServices = [{ id: "service-1", slug: "sign-design" }];
  publishedPosts = [{ slug: "studio-news", publishedAt: null }];

  const metadata = await shopPage.generateMetadata();
  assert.equal(metadata.title, messages.shop.comingSoonTitle);
  assert.deepEqual(metadata.robots, { index: false, follow: true });

  const entries = await sitemap();
  const urls = entries.map((entry) => entry.url);
  assert.ok(urls.includes("https://example.test/services"));
  assert.ok(urls.includes("https://example.test/ai"));
  assert.ok(urls.includes("https://example.test/contact"));
  assert.ok(urls.includes("https://example.test/shop/sign-design"));
  assert.ok(urls.includes("https://example.test/blog/studio-news"));
  assert.ok(!urls.includes("https://example.test/shop"));
});

test("AI direction exposes localised announcement metadata", async () => {
  const metadata = await aiPage.generateMetadata();
  assert.equal(metadata.title, messages.metadata.ai);
  assert.equal(metadata.description, messages.metadata.aiDescription);
});

test("active products switch shop to catalog metadata and add only the catalog route to sitemap", async () => {
  productRows = [
    {
      id: "product-active",
      name: "Studio tote",
      slug: "studio-tote",
      description: "A product from the database",
      price: 2500,
      coverImage: null,
      category: "merch",
      stock: 4,
      isActive: true,
    },
    {
      id: "product-hidden",
      name: "Hidden product",
      slug: "hidden-product",
      description: null,
      price: 1000,
      coverImage: null,
      category: null,
      stock: 0,
      isActive: false,
    },
  ];

  const metadata = await shopPage.generateMetadata();
  assert.equal(metadata.title, messages.shop.catalogTitle);
  assert.equal(metadata.description, messages.shop.catalogDescription);
  assert.deepEqual(metadata.robots, { index: true, follow: true });

  const page = await shopPage.default();
  assert.deepEqual(
    page.props.products.map((product) => product.id),
    ["product-active"]
  );

  const urls = (await sitemap()).map((entry) => entry.url);
  assert.equal(urls.filter((url) => url === "https://example.test/shop").length, 1);
  assert.ok(!urls.some((url) => url.includes("hidden-product")));
});

test("sitemap keeps encoded slugs, legacy service ids and optional publication dates", async () => {
  publishedServices = [
    { id: "legacy service", slug: "" },
    { id: "service-2", slug: "design/sign" },
  ];
  const publishedAt = new Date("2026-10-20T12:00:00.000Z");
  publishedPosts = [
    { slug: "news/today", publishedAt },
    { slug: "unscheduled", publishedAt: null },
  ];

  const entries = await sitemap();
  assert.ok(entries.some((entry) => entry.url === "https://example.test/shop/legacy%20service"));
  assert.ok(entries.some((entry) => entry.url === "https://example.test/shop/design%2Fsign"));

  const datedPost = entries.find((entry) => entry.url === "https://example.test/blog/news%2Ftoday");
  assert.equal(datedPost.lastModified, publishedAt);
  const unscheduledPost = entries.find((entry) => entry.url === "https://example.test/blog/unscheduled");
  assert.equal(Object.hasOwn(unscheduledPost, "lastModified"), false);
});

test("public site settings apply only validated non-secret values", async () => {
  settingRows = [
    { key: "studioName", value: "  Plus In Plus Studio  " },
    { key: "studioDescription", value: "First line\nsecond line" },
    { key: "contactEmail", value: "hello@example.test" },
    { key: "contactPhone", value: "+7 (900) 123-45-67" },
    { key: "vkUrl", value: "https://vk.com/plusinplus" },
    { key: "telegramUrl", value: "javascript:alert(1)" },
    { key: "robokassaPassword1", value: "must-not-leak" },
  ];

  const settings = await getPublicSiteSettings();
  assert.equal(settings.studioName, "Plus In Plus Studio");
  assert.equal(settings.studioDescription, "First line second line");
  assert.equal(settings.contactEmail, "hello@example.test");
  assert.equal(settings.contactPhone, "+7 (900) 123-45-67");
  assert.equal(settings.vkUrl, "https://vk.com/plusinplus");
  assert.equal(settings.telegramUrl, undefined);
  assert.equal(JSON.stringify(settings).includes("must-not-leak"), false);
  assert.deepEqual(settingQueries[0].where.key.in, [...PUBLIC_SITE_SETTING_KEYS]);
  assert.deepEqual(settingQueries[0].select, { key: true, value: true });

  const normalized = normalizePublicSiteSettings([
    { key: "contactEmail", value: "not-an-email" },
    { key: "youtubeUrl", value: "https://user:secret@example.test/channel" },
    { key: "metaTitle", value: "A title that is safe to publish" },
  ]);
  assert.deepEqual(normalized, { metaTitle: "A title that is safe to publish" });
});

test("public settings have a server-only loader and are wired to metadata and the footer", () => {
  const shared = fs.readFileSync(path.resolve(__dirname, "../lib/site-settings.ts"), "utf8");
  const loader = fs.readFileSync(path.resolve(__dirname, "../lib/public-site-settings.ts"), "utf8");
  const layout = fs.readFileSync(path.resolve(__dirname, "../app/(site)/layout.tsx"), "utf8");
  const footer = fs.readFileSync(path.resolve(__dirname, "../components/site/footer.tsx"), "utf8");

  assert.equal(shared.includes("@/lib/prisma"), false);
  assert.ok(loader.includes("@/lib/prisma"));
  assert.ok(layout.includes("getPublicSiteSettings"));
  assert.ok(layout.includes("settings.metaTitle"));
  assert.ok(footer.includes("getPublicSiteSettings"));
  assert.ok(footer.includes("settings.vkUrl"));
});
