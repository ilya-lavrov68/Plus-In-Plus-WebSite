const assert = require("node:assert/strict");
const { beforeEach, test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const { createSqlRowsMock, dbModuleWith } = require("./helpers/sql-db-mock.cjs");

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

const root = path.resolve(__dirname, "..");
const source = (file) => fs.readFileSync(path.join(root, file), "utf8");
const mock = createSqlRowsMock();

const originalLoad = Module._load;
const realDb = originalLoad.call(module, path.join(root, "lib", "db.ts"), module, false);
Module._load = function (name, parent, isMain) {
  if (name === "@/lib/db") return dbModuleWith(realDb, mock);
  if (name.startsWith("@/")) name = path.resolve(root, name.slice(2));
  return originalLoad.call(this, name, parent, isMain);
};

const { toBlogCardData } = require("../lib/blog-card.ts");
const {
  getFeaturedPost,
  getPublishedPosts,
  getSitemapPosts,
  getSitemapServices,
} = require("../lib/data.ts");
const { getClientMessages, messages } = require("../i18n-catalog.ts");

beforeEach(() => {
  mock.setServices([]);
  mock.setPosts([]);
  mock.queries.length = 0;
});

test("blog cards exclude article bodies, sections, excerpts and navigation-only fields", () => {
  const card = toBlogCardData({
    id: "post-1",
    slug: "post-1",
    title: "Card title",
    dateLabel: "October 26, 2026",
    category: "Studio",
    image: "/uploads/blog/cover.webp",
    excerpt: "Not needed by the card",
    htmlContent: "<p>Full article must stay on the server</p>",
    sections: [{ title: "Full section", paragraphs: ["Server only"] }],
    metaLabel: "Server-only metadata",
  });

  assert.deepEqual(card, {
    id: "post-1",
    slug: "post-1",
    title: "Card title",
    dateLabel: "October 26, 2026",
    category: "Studio",
    image: "/uploads/blog/cover.webp",
  });
  assert.doesNotMatch(JSON.stringify(card), /Full article|Full section|Not needed|Server-only/);

  const blogSource = source("components/blocks/blog11.tsx");
  assert.doesNotMatch(blogSource, /STUDIO_BLOG_POSTS|from "@\/lib\/studio-catalog"/);
  for (const file of [
    "components/site/blog-section.tsx",
    "app/(site)/blog/(index)/page.tsx",
    "app/(site)/blog/[slug]/content.tsx",
    "app/(site)/shop/[slug]/content.tsx",
  ]) {
    assert.match(source(file), /map\(toBlogCardData\)/, file);
  }
});

test("latest-post readers apply the database limit before mapping card content", async () => {
  mock.setPosts([{
    id: "post-1", title: "Title", slug: "post-1", excerpt: "Excerpt", content: "<p>Body</p>",
    coverImage: "/uploads/blog/cover.webp", images: null, readTime: 4, source: "manual",
    sourceUrl: null, isFeatured: false, publishedAt: null, createdAt: new Date("2026-01-01T00:00:00Z"),
  }]);

  const posts = await getPublishedPosts(3);
  assert.equal(posts.length, 1);
  assert.equal(posts[0].content, "<p>Body</p>");

  const query = mock.queries.find((item) => item.sql.includes("from posts p"));
  assert.ok(query);
  assert.match(query.sql, /p\.is_published = 1/);
  assert.match(query.sql, /limit \?/);
  assert.equal(query.args[query.args.length - 1], 3);
  assert.match(source("app/(site)/page.tsx"), /getPublishedPosts\(3\)/);
  assert.match(source("app/(site)/shop/[slug]/content.tsx"), /getPublishedPosts\(3\)/);
});

test("sitemap keeps both unbounded reads but selects only URL and date fields", async () => {
  const publishedAt = new Date("2026-10-20T12:00:00.000Z");
  mock.setPosts([{ slug: "studio-news", publishedAt }]);
  mock.setServices([{ id: "service-1", slug: "sign-design" }]);

  const [posts, services] = await Promise.all([getSitemapPosts(), getSitemapServices()]);
  assert.deepEqual(posts, [{ slug: "studio-news", publishedAt }]);
  assert.deepEqual(services, [{ id: "service-1", slug: "sign-design" }]);

  const postQuery = mock.queries.find((item) => item.sql.includes("from posts p"));
  const serviceQuery = mock.queries.find((item) => item.sql.includes("from services s"));
  assert.ok(postQuery && serviceQuery);
  assert.doesNotMatch(postQuery.sql, /limit \?/);
  assert.match(postQuery.sql, /p\.is_published = 1/);
  assert.match(serviceQuery.sql, /s\.is_active = 1/);
  assert.match(serviceQuery.sql, /s\.is_published = 1/);
  assert.match(serviceQuery.sql, /order by s\.created_at asc/);

  const sitemapSource = source("app/(site)/sitemap.ts");
  assert.match(sitemapSource, /getSitemapPosts\(\)/);
  assert.match(sitemapSource, /getSitemapServices\(\)/);
  assert.doesNotMatch(sitemapSource, /getPublishedPosts|getPublishedServices/);
});

test("featured navigation falls back to the latest post and keeps only navigation fields", async () => {
  mock.setPosts([{ title: "Latest", slug: "latest", coverImage: "/assets/shop/retired.jpg" }]);

  const post = await getFeaturedPost();
  const postQueries = mock.queries.filter((item) => item.sql.includes("from posts p"));
  assert.equal(postQueries.length, 2);
  assert.match(postQueries[0].sql, /p\.is_featured = 1/);
  assert.deepEqual(post, {
    title: "Latest",
    slug: "latest",
    coverImage: "/assets/placeholders/post-cover.svg",
  });
  assert.equal(Object.hasOwn(post, "content"), false);
});

test("full locale catalogs are separated from browser-safe locale helpers", () => {
  const helpers = source("i18n.ts");
  assert.doesNotMatch(helpers, /messages\/(?:en|ru)\.json|export const messages/);

  const catalogs = source("i18n-catalog.ts");
  assert.match(catalogs, /@\/messages\/en\.json/);
  assert.match(catalogs, /@\/messages\/ru\.json/);
  for (const file of ["app/(site)/layout.tsx", "i18n-request.ts"]) {
    assert.match(source(file), /@\/i18n-catalog/);
  }
});

test("client messages omit server actions and legacy staff bundles are gone", () => {
  for (const locale of ["en", "ru"]) {
    const client = getClientMessages(locale);
    assert.equal(Object.hasOwn(client, "actions"), false);
    assert.equal(typeof messages[locale].actions.validation, "object");
    assert.equal(client.common, messages[locale].common);
    for (const key of ["genericError", "updateServiceFailed", "invalidAmount"]) {
      assert.equal(client.admin[key], messages[locale].actions[key]);
    }
  }

  assert.match(source("app/(site)/layout.tsx"), /messages=\{getClientMessages\(locale\)\}/);
  for (const file of [
    "components/admin/inline-price-editor.tsx",
    "components/admin/inline-price-type.tsx",
    "components/orders/order-price-form.tsx",
  ]) {
    assert.equal(fs.existsSync(path.join(root, file)), false, file);
  }
});

test("critical font preloads are locale-aware and reuse CSS font requests", () => {
  const layout = source("app/(site)/layout.tsx");
  const head = layout.split("<head>")[1].split("</head>")[0];

  for (const href of [
    "/assets/fonts/geist-variable.woff2",
    "/assets/fonts/google-sans-flex-latin.woff2",
    "/assets/fonts/inter-cyrillic-wght-normal.woff2",
  ]) {
    assert.ok(head.includes(`href="${href}"`), `Missing ${href}`);
  }
  assert.equal((head.match(/as="font"/g) || []).length, 3);
  assert.equal((head.match(/type="font\/woff2"/g) || []).length, 3);
  assert.equal((head.match(/crossOrigin="anonymous"/g) || []).length, 3);
  assert.match(head, /locale === "ru" \? \(/);
  assert.doesNotMatch(head, /cyrillic-ext|latin-ext/);

  const styles = source("styles/globals.css");
  assert.equal((styles.match(/font-display: swap/g) || []).length, 5);
});

test("CI restores only Next incremental cache and never skips verification", () => {
  const workflow = source(".github/workflows/ci.yml");
  assert.match(workflow, /uses: actions\/cache@v4/);
  assert.match(workflow, /path: \.next\/cache/);
  assert.doesNotMatch(workflow, /path: \.next\s*$/m);
  assert.match(workflow, /hashFiles\('package-lock\.json'\)/);
  assert.match(workflow, /restore-keys:/);

  for (const command of [
    "npm run security:audit",
    "npm run security:dependencies",
    "npm run lint",
    "npm run typecheck",
    "npm test",
    "npm run build",
  ]) {
    assert.ok(workflow.includes(command), `CI must still run ${command}`);
  }
});

test("bundle analyzer is exact, opt-in and absent from the ordinary config path", () => {
  const config = source("next.config.mjs");
  assert.doesNotMatch(config, /import withBundleAnalyzer from "@next\/bundle-analyzer"/);
  assert.match(config, /if \(process\.env\.ANALYZE === "true"\)/);
  assert.match(config, /await import\("@next\/bundle-analyzer"\)/);

  const packageJson = JSON.parse(source("package.json"));
  assert.equal(packageJson.devDependencies["@next/bundle-analyzer"], packageJson.dependencies.next);
  assert.equal(packageJson.scripts.analyze, "ANALYZE=true next build");
});

test("account and WebAuthn code load on explicit interaction instead of the initial layout", () => {
  const navbar = source("components/blocks/navbar10.tsx");
  assert.match(navbar, /LazyAccountModal/);
  assert.doesNotMatch(navbar, /import \{ AccountModal \} from "@\/components\/site\/account-modal"/);

  const lazyModal = source("components/site/lazy-account-modal.tsx");
  assert.match(lazyModal, /dynamic\(loadAccountModal, \{ ssr: false \}\)/);
  assert.match(lazyModal, /if \(!hasOpened && !props\.open\) return null/);

  for (const [file, method] of [
    ["components/site/account-modal.tsx", "startAuthentication"],
    ["components/blocks/signup10.tsx", "startAuthentication"],
    ["components/site/security-settings.tsx", "startRegistration"],
  ]) {
    const text = source(file);
    assert.doesNotMatch(text, new RegExp(`import \\{ ${method} \\} from "@simplewebauthn/browser"`));
    assert.match(text, /await import\("@simplewebauthn\/browser"\)/);
  }
});
