const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("Payload registers the branded nav, menu and generated import-map entries", () => {
  const config = read("payload.config.ts");
  const importMap = read("app/(payload)/admin/importMap.js");
  for (const component of [
    "admin-nav#AdminNav",
    "admin-menu-button#AdminMenuButton",
    "admin-brand#AdminIcon",
    "admin-brand#AdminLogo",
    "auth-logout#AuthLogout",
  ]) {
    assert.ok(config.includes(component), component);
    assert.ok(importMap.includes(component), `generated import map: ${component}`);
  }
  assert.equal(JSON.parse(read("package.json")).dependencies["lucide-animated"], "1.0.5");
});

test("custom navigation retains Payload permissions, localized labels and preferences", () => {
  const server = read("payload/components/admin-nav.tsx");
  const client = read("payload/components/admin-nav-client.tsx");
  for (const contract of [
    "groupNavItems",
    "visibleEntities.collections",
    "visibleEntities.globals",
    "permissions",
    "PREFERENCE_KEYS.NAV",
    "payload-preferences",
  ]) {
    assert.ok(server.includes(contract), contract);
  }
  for (const contract of [
    "getTranslation",
    "formatAdminURL",
    "setPreference",
    "aria-expanded",
    "aria-current",
  ]) {
    assert.ok(client.includes(contract), contract);
  }
  assert.ok(client.includes("useReducedMotion"));
  for (const slug of [
    "accounts",
    "services",
    "products",
    "posts",
    "media",
    "story",
    "orders",
    "payments",
    "activity-logs",
    "page-views",
    "site-settings",
  ]) {
    assert.ok(client.includes(slug), `missing meaningful icon mapping: ${slug}`);
  }
});

test("admin styling is larger, shadow-free and keeps the exact PIP accent", () => {
  const styles = read("app/(payload)/custom.scss");
  assert.match(styles, /--base-body-size:\s*16/);
  assert.match(styles, /--nav-width:\s*300px/);
  assert.match(styles, /#ffff01/i);
  assert.match(styles, /:focus-visible[\s\S]*?outline:\s*2px/);
  const shadows = styles
    .split("\n")
    .filter((line) => /(?:box|text)-shadow/.test(line) && !/:\s*none/.test(line));
  assert.deepEqual(shadows, []);
  assert.match(styles, /prefers-reduced-motion:\s*reduce/);
});

test("brand artwork is unframed, uncropped and responsive controls keep their places", () => {
  const brand = read("payload/components/admin-brand.tsx");
  const styles = read("app/(payload)/custom.scss");
  assert.match(brand, /viewBox="0 0 189 42"/);
  assert.match(brand, /fill="currentColor"/);
  assert.match(brand, /fill="#FFFF01"/);
  assert.match(brand, /<AdminLogo className="pip-admin-nav-brand__logo"/);
  assert.doesNotMatch(brand, /<img/);

  const mark = styles.match(/\.pip-admin-brand-mark\s*\{([^}]*)\}/);
  assert.ok(mark);
  assert.doesNotMatch(mark[1], /border|background|border-radius/);
  assert.match(mark[1], /overflow:\s*visible/);
  assert.doesNotMatch(styles, /\.pip-admin-brand-mark img/);
  assert.match(styles, /--pip-admin-canvas:\s*#fafaf8/);
  assert.match(styles, /\.pip-admin-overview__heading\s*\{[^}]*flex-direction:\s*row/);
  assert.match(styles, /\.dashboard-breadcrumb-select \.rs__control\s*\{[^}]*flex-wrap:\s*nowrap/);
  assert.match(styles, /@media \(max-width: 360px\)[\s\S]*?min-width:\s*96px/);
});

test("only key public interactions opt into animated icons", () => {
  for (const file of [
    "components/site/cart-icon.tsx",
    "components/site/add-to-cart-button.tsx",
    "components/site/cookie-banner.tsx",
    "components/blocks/navbar10.tsx",
    "components/spectrumui/ui/responsive-modal.tsx",
    "components/ui/sheet.tsx",
    "components/ui/toast.tsx",
    "components/ui/accordion.tsx",
    "components/ui/navigation-menu.tsx",
    "components/ui/select.tsx",
  ]) {
    const source = read(file);
    assert.ok(source.includes("AnimatedIcon"), file);
    assert.ok(source.includes("data-pip-icon-trigger"), `whole-control interaction: ${file}`);
  }
  for (const file of [
    "components/site/service-card.tsx",
    "components/site/story-timeline.tsx",
    "components/site/order-card.tsx",
  ]) {
    assert.doesNotMatch(read(file), /lucide-animated/, `decorative icons stay static: ${file}`);
  }
});
