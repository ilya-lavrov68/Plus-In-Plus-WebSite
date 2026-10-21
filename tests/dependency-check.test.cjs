const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  OPTIONAL_AT_RUNTIME,
  checkDependencies,
  formatReport,
  importSpecifiers,
  needsInstall,
  npmCommand,
  scanImports,
} = require("../scripts/lib/dependency-check.cjs");
const {
  collectFindings,
  nodeVersionSatisfied,
  readEnvFile,
  requiredNodeVersion,
} = require("../scripts/doctor.cjs");

const rootDir = path.join(__dirname, "..");

/**
 * Builds a throwaway project with a package.json, an optional lockfile and only some of its
 * packages installed — exactly the state a stale `node_modules` is in after pulling a commit
 * that added a dependency.
 */
function createProject({
  dependencies = {},
  devDependencies = {},
  optionalDependencies = {},
  installed = [],
  locked = null,
  sources = {},
}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "plus-in-plus-deps-"));
  fs.writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify({ name: "fixture", dependencies, devDependencies, optionalDependencies }, null, 2)
  );
  if (locked) {
    fs.writeFileSync(
      path.join(dir, "package-lock.json"),
      JSON.stringify({
        lockfileVersion: 3,
        packages: { "": {}, ...Object.fromEntries(locked.map((name) => [`node_modules/${name}`, { version: "1.0.0" }])) },
      })
    );
  }
  for (const name of installed) {
    const packageDir = path.join(dir, "node_modules", name);
    fs.mkdirSync(packageDir, { recursive: true });
    fs.writeFileSync(path.join(packageDir, "package.json"), JSON.stringify({ name, version: "1.0.0" }));
  }
  for (const [file, source] of Object.entries(sources)) {
    const target = path.join(dir, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, source);
  }
  return dir;
}

test("dependency check reports nothing when the install is complete", () => {
  const dir = createProject({
    dependencies: { next: "15.5.27", "@radix-ui/react-slot": "^1.5.0" },
    devDependencies: { typescript: "^5" },
    installed: ["next", "@radix-ui/react-slot", "typescript"],
    sources: { "app/page.tsx": 'import next from "next";\nexport default next;\n' },
  });

  const result = checkDependencies({ dir });

  assert.equal(result.ok, true);
  assert.equal(result.nodeModulesFound, true);
  assert.deepEqual(result.missing, []);
  assert.deepEqual(result.missingDev, []);
  assert.deepEqual(result.undeclared, []);
  assert.deepEqual(formatReport(result), []);
  assert.equal(needsInstall(result), false);
});

test("dependency check names the packages a stale install is missing", () => {
  const dir = createProject({
    dependencies: { next: "15.5.27", "@radix-ui/react-navigation-menu": "^1.4.1" },
    devDependencies: { prisma: "6.19.3" },
    installed: ["next"],
  });

  const result = checkDependencies({ dir });

  assert.equal(result.ok, false);
  assert.deepEqual(result.missing, ["@radix-ui/react-navigation-menu"]);
  assert.deepEqual(result.missingDev, ["prisma"]);
  assert.equal(needsInstall(result), true);

  const report = formatReport(result).join("\n");
  assert.match(report, /@radix-ui\/react-navigation-menu/);
  assert.match(report, /prisma/);
  assert.match(report, /npm install/);
});

test("imports that package.json does not declare are reported", () => {
  const dir = createProject({
    dependencies: { next: "15.5.27" },
    installed: ["next", "left-pad"],
    sources: {
      "components/ui/thing.tsx": 'import * as React from "react";\nimport pad from "left-pad";\nexport default [React, pad];\n',
      "scripts/tool.cjs": 'const fs = require("node:fs");\nconst pg = require("pg");\nmodule.exports = [fs, pg];\n',
    },
  });

  const result = checkDependencies({ dir });

  // `react` and `left-pad` are used but undeclared; `node:fs` is a builtin and `pg` is the
  // documented optional extra of the one-off PostgreSQL migration.
  assert.deepEqual(result.undeclared.map((entry) => entry.name), ["left-pad", "react"]);
  assert.deepEqual(result.undeclared[1].files, ["components/ui/thing.tsx"]);
  assert.equal(needsInstall(result), false, "an undeclared import is fixed in package.json, not by installing");
  assert.match(formatReport(result).join("\n"), /not declared in package\.json/);
});

test("SQL and prose are not mistaken for imports", () => {
  const source = [
    '// select everything from "users" and also from "orders"',
    "const sql = `SELECT * FROM \"users\" WHERE id = ?`;",
    "/* import fake from \"not-a-module\"; */",
    'const real = require("zod");',
    'const lazy = await import("@tiptap/core");',
  ].join("\n");

  assert.deepEqual(importSpecifiers(source).sort(), ["@tiptap/core", "zod"]);

  const repository = scanImports(rootDir);
  assert.ok(repository.has("next") && repository.has("react"), "the scanner must see real imports");
  assert.ok(!repository.has("users"), "SQL strings are not imports");
});

test("declared packages must also exist in package-lock.json", () => {
  const dir = createProject({
    dependencies: { next: "15.5.27", zod: "^4.6.6" },
    installed: ["next", "zod"],
    locked: ["next"],
  });

  const result = checkDependencies({ dir });

  assert.equal(result.ok, false);
  assert.deepEqual(result.missingFromLock, ["zod"]);
  assert.equal(needsInstall(result), true);
  assert.match(formatReport(result).join("\n"), /absent from package-lock\.json/);
});

test("optional dependencies may be absent", () => {
  const dir = createProject({
    dependencies: { next: "15.5.27" },
    optionalDependencies: { sharp: "0.35.5" },
    installed: ["next"],
  });

  const result = checkDependencies({ dir });

  assert.equal(result.ok, true);
  assert.deepEqual(formatReport(result), []);
});

test("a project without node_modules is reported as not installed", () => {
  const dir = createProject({ dependencies: { next: "15.5.27" } });

  const result = checkDependencies({ dir });

  assert.equal(result.ok, false);
  assert.equal(result.nodeModulesFound, false);
  assert.match(formatReport(result).join("\n"), /node_modules was not found/);
});

test("npm is spawned through its Windows shim", () => {
  assert.equal(npmCommand("win32"), "npm.cmd");
  assert.equal(npmCommand("linux"), "npm");
  assert.equal(npmCommand("darwin"), "npm");
  assert.equal(OPTIONAL_AT_RUNTIME.has("pg"), true);
});

// ---------------------------------------------------------------------------
// Guards for the failure this suite was written after: `components/ui/aspect-ratio.tsx`
// imported a package that a stale node_modules did not contain, so every page 500'd, and
// the next stale install simply failed on the following package instead.
// ---------------------------------------------------------------------------

test("the repository declares every package it imports and installs them all", (t) => {
  const result = checkDependencies({ dir: rootDir });

  assert.deepEqual(
    result.undeclared.map((entry) => `${entry.name} (${entry.files.join(", ")})`),
    [],
    "Add these to package.json (or to OPTIONAL_AT_RUNTIME if they are truly optional)"
  );
  assert.deepEqual(result.missingFromLock, [], "package-lock.json is out of sync with package.json");

  if (!result.nodeModulesFound) {
    t.skip("node_modules is not installed");
    return;
  }
  assert.equal(
    result.ok,
    true,
    `Missing packages: ${[...result.missing, ...result.missingDev].join(", ")} — run npm install`
  );
});

test("AspectRatio does not depend on an external package", () => {
  const source = fs.readFileSync(path.join(rootDir, "components/ui/aspect-ratio.tsx"), "utf8");
  const manifest = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));

  assert.deepEqual(
    importSpecifiers(source).filter((specifier) => specifier !== "react"),
    [],
    "aspect-ratio.tsx must stay dependency-free"
  );
  assert.ok(!("@radix-ui/react-aspect-ratio" in (manifest.dependencies ?? {})));
  assert.match(source, /export \{ AspectRatio \}/);
});

test("doctor checks the Node version and never prints secrets", () => {
  assert.equal(requiredNodeVersion({ engines: { node: ">=20.19.0" } }).major, 20);
  assert.equal(nodeVersionSatisfied({ major: 20, minor: 19, patch: 0 }, { major: 20, minor: 19, patch: 0 }), true);
  assert.equal(nodeVersionSatisfied({ major: 20, minor: 18, patch: 9 }, { major: 20, minor: 19, patch: 0 }), false);
  assert.equal(nodeVersionSatisfied({ major: 22, minor: 0, patch: 0 }, { major: 20, minor: 19, patch: 0 }), true);

  const findings = collectFindings({ env: { AUTH_SECRET: "s".repeat(48) } });
  assert.deepEqual(
    findings.filter((finding) => finding.level === "error" && finding.area === "install"),
    [],
    "the repository install must satisfy package.json"
  );
  assert.ok(findings.some((finding) => finding.level === "ok" && finding.area === "auth"));
  assert.ok(!findings.some((finding) => finding.message.includes("s".repeat(48))), "secrets must not be printed");
});

test("doctor reads .env values without echoing them", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "plus-in-plus-env-"));
  const file = path.join(dir, ".env");
  fs.writeFileSync(file, 'TURSO_DATABASE_URL=""\nAUTH_SECRET="short"\n# AUTH_SECRET="commented"\n');

  const parsed = readEnvFile(file);
  assert.equal(parsed.AUTH_SECRET, "short");
  assert.equal(parsed.TURSO_DATABASE_URL, "");
  assert.equal(Object.keys(parsed).length, 2, "comments are not values");

  const findings = collectFindings({ env: {} });
  const auth = findings.filter((finding) => finding.area === "auth");
  assert.ok(auth.length >= 1, "the auth configuration is always reported");
  assert.ok(
    auth.every((finding) => !/AUTH_SECRET\s*=/.test(finding.message) && !finding.message.includes(parsed.AUTH_SECRET)),
    "env values are never echoed"
  );
});
