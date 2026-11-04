const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) =>
  module._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        esModuleInterop: true,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    filename
  );

let currentAdmin = null;
const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === "next-auth") return () => ({ auth: (callback) => callback });
  if (name === "next/navigation") {
    return {
      redirect: (url) => {
        throw new Error(`redirect:${url}`);
      },
    };
  }
  if (name === "@/lib/admin-session") {
    return {
      requireAdmin: async () =>
        currentAdmin && (currentAdmin.role === "ADMIN" || currentAdmin.role === "FOUNDER")
          ? currentAdmin
          : null,
      requireFounder: async () =>
        currentAdmin && currentAdmin.role === "FOUNDER" ? currentAdmin : null,
      requireStaff: async () =>
        currentAdmin &&
        (currentAdmin.role === "ADMIN" ||
          currentAdmin.role === "FOUNDER" ||
          currentAdmin.role === "MANAGER")
          ? currentAdmin
          : null,
    };
  }
  if (name === "@/lib/commerce-data") {
    const real = originalLoad.call(this, path.resolve(__dirname, "..", "lib", "commerce-data.ts"), parent, isMain);
    return {
      ...real,
      listSiteSettings: async () => ({
        studioName: "Plus In Plus",
        robokassaPassword1: "server-only-secret",
      }),
    };
  }
  if (name.startsWith("@/")) {
    name = path.resolve(__dirname, "..", name.slice(2));
  }
  return originalLoad.call(this, name, parent, isMain);
};

const { explicitLocaleFromPath } = require("../i18n.ts");
const { localizedPath } = require("../i18n/routing.ts");
const { proxy } = require("../proxy.ts");
const {
  localizePublicServices,
  localizeCatalogService,
} = require("../lib/service-localization.ts");
const { resolveServiceBySlug } = require("../lib/studio-catalog.ts");
const { createOrderSchema } = require("../lib/validators.ts");

test("bidirectional EN <-> RU path resolution handles prefixed, unprefixed, and protected routes", () => {
  // EN -> RU
  assert.equal(localizedPath("/", "ru"), "/ru");
  assert.equal(localizedPath("/services", "ru"), "/ru/services");
  assert.equal(localizedPath("/en/services", "ru"), "/ru/services");
  assert.equal(localizedPath("/en", "ru"), "/ru");

  // RU -> EN (including unprefixed URL when active cookie locale is RU!)
  assert.equal(localizedPath("/ru", "en"), "/en");
  assert.equal(localizedPath("/ru/services", "en"), "/en/services");
  assert.equal(localizedPath("/services", "en"), "/en/services");
  assert.equal(localizedPath("/", "en"), "/en");

  // Query string and hash preservation
  assert.equal(
    localizedPath("/ru/contact", "en", "service=sign-design", "#brief"),
    "/en/contact?service=sign-design#brief"
  );

  // Unprefixed protected routes stay unprefixed (switched via cookie + refresh)
  assert.equal(localizedPath("/admin", "ru"), "/admin");
  assert.equal(localizedPath("/profile", "en"), "/profile");
  assert.equal(localizedPath("/orders", "ru"), "/orders");

  // explicitLocaleFromPath distinguishes explicit /en or /ru from unprefixed paths
  assert.equal(explicitLocaleFromPath("/"), null);
  assert.equal(explicitLocaleFromPath("/services"), null);
  assert.equal(explicitLocaleFromPath("/en/services"), "en");
  assert.equal(explicitLocaleFromPath("/ru/services"), "ru");
});

test("proxy leaves authorization to the server guards and strips locale prefixes", async () => {
  process.env.AUTH_SECRET = "test-secret-with-at-least-32-characters";
  for (const role of ["MANAGER", "ADMIN", "FOUNDER"]) {
    const response = await proxy({
      url: "https://preview.example/admin/collections/site-settings",
      auth: { user: { id: `${role.toLowerCase()}-1`, role } },
    });
    assert.equal(response.status, 200);
  }

  const localeBypassRes = await proxy({
    url: "https://preview.example/ru/admin/collections/site-settings",
    auth: null,
  });
  assert.equal(localeBypassRes.status, 307);
  assert.equal(
    localeBypassRes.headers.get("location"),
    "https://preview.example/admin/collections/site-settings"
  );
  assert.match(localeBypassRes.headers.get("set-cookie") || "", /pip-locale=ru/);
});

test("site settings keep secrets out of the public projection", () => {
  const settings = fs.readFileSync(path.resolve(__dirname, "../lib/site-settings.ts"), "utf8");
  // Секретные ключи перечислены отдельно и не попадают в публичный набор.
  assert.match(settings, /isSecretSiteSettingKey/);
  assert.match(settings, /robokassaPassword1/);
  const publicLoader = fs.readFileSync(path.resolve(__dirname, "../lib/public-site-settings.ts"), "utf8");
  assert.ok(publicLoader.includes("normalizePublicSiteSettings"));
  assert.equal(publicLoader.includes("robokassaPassword"), false);
  assert.equal(fs.existsSync(path.resolve(__dirname, "../data/collections")), false);
});

test("service localization translates seeded studio services to RU without overwriting custom admin titles", () => {
  const sample = [
    {
      id: "svc-1",
      slug: "sign-design",
      title: "Sign Design",
      shortDesc: "Custom exterior and interior signage concepts tailored to your storefront.",
      category: "small",
      coverImage: "/assets/shop/sign-design.jpg",
      basePrice: 500000,
      priceType: "from",
      currency: "RUB",
      isOrderable: true,
    },
    {
      id: "svc-2",
      slug: "sign-design",
      title: "Авторская вывеска VIP",
      shortDesc: "Кастомное описание администратора",
      category: "small",
      coverImage: "/assets/shop/sign-design.jpg",
      basePrice: 700000,
      priceType: "from",
      currency: "RUB",
      isOrderable: true,
    },
  ];

  const ruList = localizePublicServices(sample, "ru");
  assert.equal(ruList[0].title, "Дизайн вывески");
  assert.match(ruList[0].shortDesc, /вывеск/i);
  // Custom admin title preserved
  assert.equal(ruList[1].title, "Авторская вывеска VIP");
  assert.equal(ruList[1].shortDesc, "Кастомное описание администратора");

  // Slug aliases are resolved by the DB query; no database row means no public service.
  assert.equal(resolveServiceBySlug("large-billboard-building", null), null);
  const databaseService = (slug) => ({
    id: `db-${slug}`, slug,
    title: slug === "large-billboard" ? "Large Billboard on a building" : "Advertisement on the fence",
    category: "large",
    shortDesc: "Short", fullDesc: "Full", includes: [], shapes: [],
    resultText: "Result", coverImage: "/assets/shop/large-billboard-building.jpg",
  });
  const billboard = resolveServiceBySlug(
    "large-billboard-building",
    databaseService("large-billboard"),
  );
  assert.ok(billboard);
  assert.equal(localizeCatalogService(billboard, "ru").title, "Крупный брандмауэр на здании");

  const fence = resolveServiceBySlug(
    "advertisement-fence",
    databaseService("advertisement-on-the-fence"),
  );
  assert.ok(fence);
  assert.equal(localizeCatalogService(fence, "ru").title, "Реклама на ограждении");
});

test("createOrderSchema forbids orders without selected services", () => {
  assert.equal(createOrderSchema.safeParse({ serviceIds: [] }).success, false);
  assert.equal(
    createOrderSchema.safeParse({
      serviceIds: ["svc-sign"],
      description: "Storefront sign",
    }).success,
    true
  );
});

test("Auth.js logger keeps operational codes but redacts JWT profiles and metadata", () => {
  const { authConfig } = require("../auth.config.ts");
  const output = [];
  const original = { error: console.error, warn: console.warn, log: console.log };
  console.error = (...args) => output.push(args.join(" "));
  console.warn = (...args) => output.push(args.join(" "));
  console.log = (...args) => output.push(args.join(" "));
  try {
    const error = new Error("decoded profile must not be logged");
    error.code = "JWTSessionError";
    error.details = { payload: { email: "private@example.test", sessionId: "private-session" } };
    authConfig.logger.error(error);
    const productionError = new Error("minified production error");
    productionError.name = "rk";
    productionError.type = "JWTSessionError";
    productionError.details = { payload: { email: "private@example.test" } };
    authConfig.logger.error(productionError);
    authConfig.logger.warn("debug-enabled");
    authConfig.logger.debug("private-token", { email: "private@example.test" });
  } finally {
    console.error = original.error;
    console.warn = original.warn;
    console.log = original.log;
  }
  const logged = output.join("\n");
  assert.equal(output.filter((line) => line.includes("JWTSessionError")).length, 2);
  assert.match(logged, /debug-enabled/);
  assert.doesNotMatch(logged, /private@example|private-session|private-token|decoded profile|minified production/);
});
