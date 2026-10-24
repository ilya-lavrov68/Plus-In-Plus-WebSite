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
  if (name === "@/lib/prisma") {
    return {
      prisma: {
        siteSetting: {
          findMany: async () => [
            { key: "studioName", value: "Plus In Plus" },
            { key: "robokassaPassword1", value: "server-only-secret" },
          ],
        },
      },
    };
  }
  if (name.startsWith("@/")) {
    name = path.resolve(__dirname, "..", name.slice(2));
  }
  return originalLoad.call(this, name, parent, isMain);
};

const { explicitLocaleFromPath } = require("../i18n.ts");
const { localizedPath } = require("../i18n/routing.ts");
const { middleware } = require("../middleware.ts");
const { getSiteSettings } = require("../lib/admin-data.ts");
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
  assert.equal(localizedPath("/admin/dashboard", "ru"), "/admin/dashboard");
  assert.equal(localizedPath("/profile", "en"), "/profile");
  assert.equal(localizedPath("/orders", "ru"), "/orders");

  // explicitLocaleFromPath distinguishes explicit /en or /ru from unprefixed paths
  assert.equal(explicitLocaleFromPath("/"), null);
  assert.equal(explicitLocaleFromPath("/services"), null);
  assert.equal(explicitLocaleFromPath("/en/services"), "en");
  assert.equal(explicitLocaleFromPath("/ru/services"), "ru");
});

test("middleware restricts /admin/settings to FOUNDER only and prevents locale-prefixed bypasses", async () => {
  process.env.AUTH_SECRET = "test-secret-with-at-least-32-characters";

  // ADMIN is redirected away from /admin/settings to /admin/dashboard
  const adminRes = await middleware({
    url: "https://preview.example/admin/settings",
    auth: { user: { id: "admin-1", role: "ADMIN" } },
  });
  assert.equal(adminRes.status, 307);
  assert.equal(
    adminRes.headers.get("location"),
    "https://preview.example/admin/dashboard"
  );

  // FOUNDER is allowed into /admin/settings
  const founderRes = await middleware({
    url: "https://preview.example/admin/settings",
    auth: { user: { id: "founder-1", role: "FOUNDER" } },
  });
  assert.equal(founderRes.status, 200);

  // Locale-prefixed protected path (/ru/admin/settings) sets cookie and redirects to unprefixed protected path
  const localeBypassRes = await middleware({
    url: "https://preview.example/ru/admin/settings",
    auth: null,
  });
  assert.equal(localeBypassRes.status, 307);
  assert.equal(
    localeBypassRes.headers.get("location"),
    "https://preview.example/admin/settings"
  );
  assert.match(
    localeBypassRes.headers.get("set-cookie") || "",
    /pip-locale=ru/
  );
});

test("getSiteSettings enforces FOUNDER-only access in data layer", async () => {
  currentAdmin = { id: "admin-1", role: "ADMIN" };
  await assert.rejects(() => getSiteSettings(), /redirect:\//);

  currentAdmin = { id: "founder-1", role: "FOUNDER" };
  const settings = await getSiteSettings();
  assert.deepEqual(settings.values, { studioName: "Plus In Plus" });
  assert.equal(settings.secrets.robokassaPassword1, true);
  assert.doesNotMatch(JSON.stringify(settings), /server-only-secret/);
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
