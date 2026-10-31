const test = require("node:test");
const assert = require("node:assert/strict");

const manifest = require("../package.json");
const lockfile = require("../package-lock.json");
const minimatch = require("minimatch");

test("dependency overrides keep the patched glob policy and official minimatch upstream", () => {
  assert.equal(manifest.devDependencies.minimatch, "file:vendor/minimatch");
  assert.equal(manifest.devDependencies["minimatch-upstream"], "npm:minimatch@11.0.3");
  assert.equal(manifest.overrides.minimatch, "$minimatch");
  assert.equal(manifest.overrides.glob, "14.0.3");
  assert.equal(require("minimatch/package.json").version, "11.0.3-compat.0");
  assert.equal(require("minimatch-upstream/package.json").version, "11.0.3");
  const installedGlobs = Object.entries(lockfile.packages)
    .filter(([name]) => name === "node_modules/glob" || name.endsWith("/node_modules/glob"));
  for (const [name, metadata] of installedGlobs) {
    assert.equal(metadata.version, "14.0.3", `${name} must retain the security override`);
  }
});

test("legacy consumers retain a callable CommonJS minimatch export", () => {
  assert.equal(typeof minimatch, "function");
  assert.equal(minimatch("src/agent.ts", "**/*.{ts,tsx}"), true);
  assert.equal(minimatch("src/agent.js", "**/*.{ts,tsx}"), false);
  assert.equal(minimatch("AGENT.TS", "*.ts", { nocase: true }), true);
  assert.equal(minimatch(".agent.ts", "*.ts"), false);
});

test("modern named exports and collection helpers share the patched implementation", () => {
  assert.equal(typeof minimatch.minimatch, "function");
  assert.equal(minimatch.minimatch("src/agent.tsx", "**/*.tsx"), true);
  assert.equal(new minimatch.Minimatch("**/*.ts").match("src/agent.ts"), true);
  assert.deepEqual(minimatch.match(["agent.ts", "agent.js"], "*.ts"), ["agent.ts"]);
  assert.deepEqual(["agent.ts", "agent.js"].filter(minimatch.filter("*.ts")), ["agent.ts"]);
  assert.equal(minimatch.defaults({ nocase: true })("AGENT.TS", "*.ts"), true);
  assert.deepEqual(minimatch.braceExpand("*.{ts,tsx}"), ["*.ts", "*.tsx"]);
  const escaped = minimatch.escape("agent*.ts");
  assert.equal(minimatch("agent*.ts", escaped), true);
  assert.equal(minimatch.unescape(escaped), "agent*.ts");
});

test("ESM consumers receive callable default and named exports", async () => {
  const esm = await import("minimatch");
  assert.equal(typeof esm.default, "function");
  assert.equal(typeof esm.minimatch, "function");
  assert.equal(typeof esm.Minimatch, "function");
  assert.equal(typeof esm.match, "function");
  assert.equal(esm.minimatch("src/agent.ts", "**/*.ts"), true);
});
