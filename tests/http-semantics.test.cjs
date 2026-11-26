const assert = require("node:assert/strict");
const { beforeEach, test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

for (const extension of [".ts", ".tsx"]) {
  require.extensions[extension] = (module, filename) =>
    module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText, filename);
}

const messages = require("../messages/en.json");
let locale = "en";
let posts = [];
let service = null;

function controlError(kind, destination = "") {
  return Object.assign(new Error(kind), { digest: `${kind}${destination}` });
}

const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === "next/navigation") {
    return {
      notFound: () => { throw controlError("NEXT_NOT_FOUND"); },
      redirect: (destination) => { throw controlError("NEXT_REDIRECT", destination); },
    };
  }
  if (name === "@/lib/data") {
    return {
      getPublishedPosts: async () => posts,
      getPublishedPost: async (slug) => posts.find((post) => post.slug === slug) ?? null,
      getPublishedService: async () => service,
      getServicePricing: async () => null,
    };
  }
  if (name === "@/lib/request-locale") {
    return { getRequestLocale: async () => locale };
  }
  if (name === "@/lib/server-i18n") {
    return {
      getRequestTranslations: async (namespace) => {
        const translate = (key) => messages[namespace]?.[key] ?? key;
        translate.raw = (key) => messages[namespace]?.[key];
        return translate;
      },
    };
  }
  if (name === "@/lib/seo") {
    return { createPageMetadata: (options) => options };
  }
  if (name.startsWith("@/components/")) {
    return new Proxy({}, { get: () => () => null });
  }
  if (name === "@/app/actions/cart" || name === "@/app/actions/orders") {
  return new Proxy({}, { get: () => async () => ({ ok: true }) });
  }
  if (name.startsWith("@/")) name = path.resolve(__dirname, "..", name.slice(2));
  return originalLoad.call(this, name, parent, isMain);
};

const blogPage = require("../app/(site)/blog/[slug]/page.tsx");
const shopPage = require("../app/(site)/services/[slug]/page.tsx");

beforeEach(() => {
  locale = "en";
  posts = [];
  service = null;
});

test("missing blog slugs invoke notFound in metadata and rendering for EN and RU", async () => {
  for (const currentLocale of ["en", "ru"]) {
    locale = currentLocale;
    const props = { params: Promise.resolve({ slug: "definitely-missing" }) };
    await assert.rejects(blogPage.generateMetadata(props), (error) => error.digest === "NEXT_NOT_FOUND");
    await assert.rejects(blogPage.default(props), (error) => error.digest === "NEXT_NOT_FOUND");
  }
});

test("missing service slugs redirect in metadata and rendering for EN and RU", async () => {
  for (const currentLocale of ["en", "ru"]) {
    locale = currentLocale;
    const props = { params: Promise.resolve({ slug: "definitely-missing" }) };
    await assert.rejects(shopPage.generateMetadata(props), (error) => error.digest === "NEXT_REDIRECT/services");
    await assert.rejects(shopPage.default(props), (error) => error.digest === "NEXT_REDIRECT/services");
  }
});

test("dynamic routes have no ancestor loading boundary that streams an early shell", () => {
  for (const file of [
    "app/loading.tsx",
    "app/(site)/loading.tsx",
    "app/(site)/blog/loading.tsx",
    "app/(site)/blog/[slug]/loading.tsx",
    "app/(site)/services/loading.tsx",
    "app/(site)/services/[slug]/loading.tsx",
  ]) {
    assert.equal(fs.existsSync(path.join(__dirname, "..", file)), false, file);
  }
  for (const route of ["blog", "services"]) {
    const source = fs.readFileSync(path.join(__dirname, "..", "app", "(site)", route, "[slug]", "page.tsx"), "utf8");
    assert.doesNotMatch(source, /<Suspense/);
  }
});
