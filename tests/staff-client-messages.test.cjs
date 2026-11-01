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

test("the remaining Payload panel owns RU/EN chrome and accessibility provider", () => {
  const config = fs.readFileSync(path.join(root, "payload.config.ts"), "utf8");
  assert.match(config, /supportedLanguages: \{ en, ru \}/);
  assert.match(config, /fallbackLanguage: "ru"/);
  assert.match(config, /admin-a11y-provider#AdminA11yProvider/);
  assert.match(config, /routes: \{[\s\S]*?admin: "\/admin"/);
  const provider = fs.readFileSync(path.join(root, "payload", "components", "admin-a11y-provider.tsx"), "utf8");
  assert.doesNotMatch(provider, /box-shadow|drop-shadow/);
});
