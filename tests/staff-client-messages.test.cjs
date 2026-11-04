const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");

test("legacy staff client bundles and their action-message dependencies stay removed", () => {
  for (const file of [
    "components/admin/inline-price-editor.tsx",
    "components/admin/inline-price-type.tsx",
    "components/orders/order-price-form.tsx",
    "components/admin/story-form.tsx",
    "components/admin/post-content-editor.tsx",
  ]) {
    assert.equal(fs.existsSync(path.join(root, file)), false, file);
  }
  for (const file of ["app/actions/services.ts", "app/actions/posts.ts", "app/actions/story.ts"]) {
    assert.equal(fs.existsSync(path.join(root, file)), false, file);
  }
});

test("staff panel is ours: RU/EN chrome, skip link and no shadows", () => {
  const layout = fs.readFileSync(path.join(root, "app", "(admin)", "admin", "layout.tsx"), "utf8");
  const labels = fs.readFileSync(path.join(root, "components", "admin", "labels.ts"), "utf8");
  const nav = fs.readFileSync(path.join(root, "components", "admin", "admin-nav.tsx"), "utf8");

  // Единственная staff-панель — наша: guard, skip-link и подписи RU/EN рядом.
  assert.match(layout, /requireStaff\(\)/);
  assert.match(layout, /href="#admin-main"/);
  assert.match(layout, /adminLabels\(locale\)/);
  assert.match(labels, /locale === "ru"/);
  assert.doesNotMatch(nav, /box-shadow|drop-shadow|text-shadow/);

  // CMS-слой удалён целиком: ни UI, ни конфига, ни локального API.
  assert.equal(fs.existsSync(path.join(root, "app", "(payload)")), false);
  assert.equal(fs.existsSync(path.join(root, "payload", "components")), false);
  assert.equal(fs.existsSync(path.join(root, "payload.config.ts")), false);
  assert.equal(fs.existsSync(path.join(root, "lib", "payload-native.ts")), false);
});
