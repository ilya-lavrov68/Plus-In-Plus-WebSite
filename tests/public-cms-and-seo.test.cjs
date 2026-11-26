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
let publishedServices = [];
let publishedPosts = [];
let settingRows = [];
let settingQueries = [];


const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === "@/lib/db") {
    const real = originalLoad.call(this, path.join(__dirname, "..", "lib", "db.ts"), parent, isMain);
    return {
      ...real,
      // Настройки читаются SQL-запросом с allowlist в параметрах.
      rows: async (sql, args = []) => {
        const query = String(sql).replace(/\s+/g, " ");
        // Счётчик товаров для sitemap идёт тем же SQL-слоем.
        if (query.includes("count(*)" ) && query.includes("from products")) {
          return [{ total: productRows.filter((row) => row.isActive).length }];
        }
        if (!query.includes("from site_settings")) return [];
        settingQueries.push({ sql: query, args });
        const allowed = new Set(args.map(String));
        return structuredClone(settingRows.filter((row) => allowed.has(row.key)));
      },
    };
  }
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
      SITE_URL: new URL("https://example.test"),
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
      serviceHref: (service) => `/services/${encodeURIComponent(service.slug || service.id)}`,
    };
  }
  if (name.startsWith("@/")) {
    name = path.resolve(__dirname, "..", name.slice(2));
  }
  return originalLoad.call(this, name, parent, isMain);
};

const sitemap = require("../app/(site)/sitemap.ts").default;
const robots = require("../app/robots.ts").default;
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

test("sitemap indexes the product page and every live service route", async () => {
  publishedServices = [{ id: "service-1", slug: "sign-design" }];
  publishedPosts = [{ slug: "studio-news", publishedAt: null }];

  const entries = await sitemap();
  const urls = entries.map((entry) => entry.url);
  assert.ok(urls.includes("https://example.test/services"));
  assert.ok(urls.includes("https://example.test/line-launcher"));
  assert.equal(urls.some((url) => url.includes("/ai")), false, "ИИ-маршруты не попадают в sitemap");
  assert.ok(urls.includes("https://example.test/contact"));
  assert.ok(urls.includes("https://example.test/services/sign-design"));
  assert.ok(urls.includes("https://example.test/blog/studio-news"));
  assert.equal(urls.some((url) => url.includes("/shop")), false, "магазин удалён из sitemap");
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
  assert.ok(entries.some((entry) => entry.url === "https://example.test/services/legacy%20service"));
  assert.ok(entries.some((entry) => entry.url === "https://example.test/services/design%2Fsign"));

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
  assert.match(settingQueries[0].sql, /from site_settings/);
  assert.deepEqual(settingQueries[0].args, [...PUBLIC_SITE_SETTING_KEYS]);
  assert.equal(settingQueries[0].args.includes("robokassaPassword1"), false);

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

  assert.equal(shared.includes("@/lib/payload-db"), false);
  // Загрузчик читает SQLite напрямую и не зависит от CMS-слоя.
  assert.ok(loader.includes("@/lib/db"));
  assert.equal(loader.includes("@/lib/payload-native"), false);
  assert.ok(layout.includes("getPublicSiteSettings"));
  assert.ok(layout.includes("settings.metaTitle"));
  assert.ok(footer.includes("getPublicSiteSettings"));
  assert.ok(footer.includes("settings.vkUrl"));
});

test("robots.txt is generated from the app root, not from a route group", () => {
  const root = path.resolve(__dirname, "..");
  // Next.js регистрирует `robots` только на верхнем уровне app/: файл внутри
  // группы `(site)` собирается, но маршрут `/robots.txt` не появляется и
  // страница отдаёт 404 — именно так и было до этого теста.
  assert.equal(fs.existsSync(path.join(root, "app", "robots.ts")), true, "app/robots.ts must exist");
  for (const group of ["(site)", "(admin)"]) {
    assert.equal(
      fs.existsSync(path.join(root, "app", group, "robots.ts")),
      false,
      `robots.ts inside app/${group} is never served`,
    );
  }

  const rules = robots();
  const disallow = Array.isArray(rules.rules) ? rules.rules.flatMap((rule) => rule.disallow ?? []) : rules.rules.disallow;
  assert.ok(disallow.includes("/admin/"), "the panel must stay out of search results");
  assert.ok(disallow.includes("/api/auth/"), "auth endpoints must stay out of search results");
  assert.equal(rules.rules.allow ?? rules.rules[0]?.allow, "/");
  assert.equal(rules.host, "https://example.test", "the host directive points at the public origin");
  assert.equal(String(rules.sitemap), "https://example.test/sitemap.xml");
});
