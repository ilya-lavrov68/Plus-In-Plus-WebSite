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
      filename,
    );
}

const root = path.resolve(__dirname, "..");
const source = (file) => fs.readFileSync(path.join(root, file), "utf8");
let postRows = [];
let featuredRows = [];
let postQueries = [];
let featuredQueries = [];

const prisma = {
  post: {
    findMany: async (query) => {
      postQueries.push(structuredClone(query));
      return structuredClone(postRows);
    },
    findFirst: async (query) => {
      featuredQueries.push(structuredClone(query));
      return structuredClone(featuredRows.shift() ?? null);
    },
  },
};

const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === "@/lib/prisma") return { prisma };
  if (name.startsWith("@/")) name = path.resolve(root, name.slice(2));
  return originalLoad.call(this, name, parent, isMain);
};

const { toBlogCardData } = require("../lib/blog-card.ts");
const { getFeaturedPost, getPublishedPosts } = require("../lib/data.ts");

beforeEach(() => {
  postRows = [];
  featuredRows = [];
  postQueries = [];
  featuredQueries = [];
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
    "app/blog/(index)/page.tsx",
    "app/blog/[slug]/content.tsx",
    "app/shop/[slug]/content.tsx",
  ]) {
    assert.match(source(file), /map\(toBlogCardData\)/, file);
  }
});

test("latest-post readers apply the database limit before mapping card content", async () => {
  postRows = [{
    id: "post-1", title: "Title", slug: "post-1", excerpt: "Excerpt", content: "<p>Body</p>",
    coverImage: "/uploads/blog/cover.webp", images: null, readTime: 4, source: "manual",
    sourceUrl: null, isFeatured: false, publishedAt: null, createdAt: new Date("2026-01-01T00:00:00Z"),
  }];

  await getPublishedPosts(3);
  assert.equal(postQueries.length, 1);
  assert.equal(postQueries[0].take, 3);
  assert.equal(postQueries[0].where.isPublished, true);
  assert.match(source("app/page.tsx"), /getPublishedPosts\(3\)/);
  assert.match(source("app/shop/[slug]/content.tsx"), /getPublishedPosts\(3\)/);
});

test("featured navigation reads only title, slug and cover, including the latest-post fallback", async () => {
  featuredRows = [null, { title: "Latest", slug: "latest", coverImage: "/assets/shop/retired.jpg" }];
  const post = await getFeaturedPost();

  assert.equal(featuredQueries.length, 2);
  for (const query of featuredQueries) {
    assert.deepEqual(query.select, { title: true, slug: true, coverImage: true });
  }
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
  for (const file of ["app/layout.tsx", "i18n-request.ts"]) {
    assert.match(source(file), /@\/i18n-catalog/);
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
