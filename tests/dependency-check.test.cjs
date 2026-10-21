const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { checkDependencies, formatReport } = require("../scripts/lib/dependency-check.cjs");

const rootDir = path.join(__dirname, "..");

/**
 * Builds a throwaway project with a package.json and only some of its packages installed —
 * exactly the state a stale `node_modules` is in after pulling a commit that added a dependency.
 */
function createProject({ dependencies = {}, devDependencies = {}, optionalDependencies = {}, installed = [] }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "plus-in-plus-deps-"));
  fs.writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify({ name: "fixture", dependencies, devDependencies, optionalDependencies }, null, 2)
  );
  for (const name of installed) {
    const packageDir = path.join(dir, "node_modules", name);
    fs.mkdirSync(packageDir, { recursive: true });
    fs.writeFileSync(path.join(packageDir, "package.json"), JSON.stringify({ name, version: "1.0.0" }));
  }
  return dir;
}

test("dependency check reports nothing when the install is complete", () => {
  const dir = createProject({
    dependencies: { next: "15.5.27", "@radix-ui/react-slot": "^1.5.0" },
    devDependencies: { typescript: "^5" },
    installed: ["next", "@radix-ui/react-slot", "typescript"],
  });

  const result = checkDependencies({ dir });

  assert.equal(result.ok, true);
  assert.equal(result.nodeModulesFound, true);
  assert.deepEqual(result.missing, []);
  assert.deepEqual(result.missingDev, []);
  assert.deepEqual(formatReport(result), []);
});

test("dependency check names the packages a stale install is missing", () => {
  const dir = createProject({
    dependencies: { next: "15.5.27", "@radix-ui/react-aspect-ratio": "^1.2.0" },
    devDependencies: { prisma: "6.19.3" },
    installed: ["next"],
  });

  const result = checkDependencies({ dir });

  assert.equal(result.ok, false);
  assert.deepEqual(result.missing, ["@radix-ui/react-aspect-ratio"]);
  assert.deepEqual(result.missingDev, ["prisma"]);

  const report = formatReport(result).join("\n");
  assert.match(report, /@radix-ui\/react-aspect-ratio/);
  assert.match(report, /prisma/);
  assert.match(report, /npm install/);
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

// ---------------------------------------------------------------------------
// Guards for the failure this suite was written after: `components/ui/aspect-ratio.tsx`
// imported a package that a stale node_modules did not contain, so every page 500'd.
// ---------------------------------------------------------------------------

const OPTIONAL_AT_RUNTIME = new Set([
  // scripts/migrate-from-postgres.cjs loads it inside try/catch and prints `npm i -D pg`.
  "pg",
]);

const SKIP_DIRECTORIES = new Set(["node_modules", ".next", ".git", "generated", "public", "docs"]);

function sourceFiles(dir = rootDir) {
  const found = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (SKIP_DIRECTORIES.has(entry.name) || entry.name.startsWith(".")) continue;
        walk(path.join(current, entry.name));
        continue;
      }
      if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name) && !entry.name.endsWith(".d.ts")) {
        found.push(path.join(current, entry.name));
      }
    }
  };
  walk(dir);
  return found;
}

/** Removes `// …` and `/* … *\/` comments without touching string literals. */
function stripComments(source) {
  let out = "";
  let quote = null;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (quote) {
      out += char;
      if (char === "\\") {
        out += next ?? "";
        index += 1;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      out += char;
      continue;
    }
    if (char === "/" && next === "/") {
      while (index < source.length && source[index] !== "\n") index += 1;
      out += "\n";
      continue;
    }
    if (char === "/" && next === "*") {
      index = source.indexOf("*/", index + 2);
      index = index === -1 ? source.length : index + 1;
      continue;
    }
    out += char;
  }

  return out;
}

/**
 * Module specifiers of real import/require statements.
 * The shapes are matched deliberately strictly: SQL such as `FROM "users"` inside a template
 * literal must not be mistaken for an import.
 */
function bareSpecifiers(source) {
  const code = stripComments(source);
  const patterns = [
    /(?:^|\n)\s*import\s+(?:[^;'"]*?\sfrom\s*)?(["'])([^"'\n]+)\1/g,
    /(?:^|\n)\s*export\s+(?:\*|\{[^}]*\})\s*from\s*(["'])([^"'\n]+)\1/g,
    /\brequire\(\s*(["'])([^"'\n]+)\1\s*\)/g,
    /\bimport\(\s*(["'])([^"'\n]+)\1\s*\)/g,
  ];
  const specifiers = [];

  for (const pattern of patterns) {
    for (const match of code.matchAll(pattern)) {
      const specifier = match[2];
      if (specifier.startsWith(".") || specifier.startsWith("/") || specifier.startsWith("@/")) continue;
      if (specifier.startsWith("node:")) continue;
      // npm names are lowercase; anything else came from a string we did not mean to scan.
      if (!/^(@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*(\/[^"'\s]*)?$/.test(specifier)) continue;
      specifiers.push(specifier);
    }
  }

  return specifiers;
}

const packageNameOf = (specifier) =>
  specifier.startsWith("@") ? specifier.split("/").slice(0, 2).join("/") : specifier.split("/")[0];

test("every imported package is declared in package.json", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
  const declared = new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.devDependencies ?? {}),
    ...Object.keys(manifest.optionalDependencies ?? {}),
  ]);

  const undeclared = new Map();
  for (const file of sourceFiles()) {
    for (const specifier of bareSpecifiers(fs.readFileSync(file, "utf8"))) {
      const name = packageNameOf(specifier);
      if (declared.has(name) || OPTIONAL_AT_RUNTIME.has(name)) continue;
      if (!undeclared.has(name)) undeclared.set(name, new Set());
      undeclared.get(name).add(path.relative(rootDir, file));
    }
  }

  const details = [...undeclared].map(([name, files]) => `${name} (${[...files].join(", ")})`).join("\n");
  assert.equal(undeclared.size, 0, `Undeclared dependencies — add them to package.json:\n${details}`);
});

test("AspectRatio does not depend on an external package", () => {
  const source = fs.readFileSync(path.join(rootDir, "components/ui/aspect-ratio.tsx"), "utf8");
  const manifest = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));

  assert.deepEqual(
    bareSpecifiers(source).filter((specifier) => !specifier.startsWith("react")),
    [],
    "aspect-ratio.tsx must stay dependency-free"
  );
  assert.ok(!("@radix-ui/react-aspect-ratio" in (manifest.dependencies ?? {})));
  assert.match(source, /export \{ AspectRatio \}/);
  assert.match(source, /ratio/);
});

test("the repository install satisfies package.json", (t) => {
  const result = checkDependencies({ dir: rootDir });
  if (!result.nodeModulesFound) {
    t.skip("node_modules is not installed");
    return;
  }

  assert.equal(result.ok, true, `Missing packages: ${[...result.missing, ...result.missingDev].join(", ")} — run npm install`);
});
