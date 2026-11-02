// Install integrity for `npm run dev` and `npm run doctor`.
//
// Two failure modes produce the same confusing webpack output —
// `Module not found: Can't resolve '…'` plus a 500 on every page:
//
//   1. a declared package is absent from node_modules (stale install: somebody pulled a
//      commit that added a dependency and never re-ran `npm install`);
//   2. a source file imports a package that package.json never declared (it only resolved
//      by accident through hoisting).
//
// Both are answered here, before Next.js starts, with the names and the command that fixes
// them. The same functions back `npm run doctor` and tests/dependency-check.test.cjs.
const fs = require("node:fs");
const path = require("node:path");
const { builtinModules } = require("node:module");

const rootDir = path.join(__dirname, "..", "..");

const BUILTINS = new Set(builtinModules);

/**
 * Imported on purpose without being declared: `scripts/seed-services.ts` loads `pg`
 * inside try/catch and prints `npm i -D pg`, because only that one-off migration needs it.
 */
const OPTIONAL_AT_RUNTIME = new Set(["pg"]);

const SKIP_DIRECTORIES = new Set(["node_modules", ".next", ".git", "generated", "public", "docs", "vendor"]);
const SOURCE_EXTENSIONS = /\.(ts|tsx|js|jsx|mjs|cjs)$/;

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function readManifest(dir) {
  return readJson(path.join(dir, "package.json"));
}

function readLockfile(dir) {
  return readJson(path.join(dir, "package-lock.json"));
}

function isInstalled(dir, name) {
  return fs.existsSync(path.join(dir, "node_modules", name, "package.json"));
}

/** Removes `// …` and block comments without touching string literals. */
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
      const end = source.indexOf("*/", index + 2);
      index = end === -1 ? source.length : end + 1;
      continue;
    }
    out += char;
  }

  return out;
}

/**
 * Module specifiers of real import/require statements.
 *
 * The statement shapes are matched deliberately strictly, because SQL such as
 * `FROM "users"` inside a template literal must not be mistaken for an import.
 */
function importSpecifiers(source) {
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
      // npm names are lowercase: anything else came from a string we did not mean to scan.
      if (!/^(@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*(\/[^"'\s]*)?$/.test(specifier)) continue;
      specifiers.push(specifier);
    }
  }

  return specifiers;
}

const packageNameOf = (specifier) =>
  specifier.startsWith("@") ? specifier.split("/").slice(0, 2).join("/") : specifier.split("/")[0];

function sourceFiles(dir) {
  const found = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (SKIP_DIRECTORIES.has(entry.name) || entry.name.startsWith(".")) continue;
        walk(path.join(current, entry.name));
        continue;
      }
      if (SOURCE_EXTENSIONS.test(entry.name) && !entry.name.endsWith(".d.ts")) {
        found.push(path.join(current, entry.name));
      }
    }
  };
  walk(dir);
  return found;
}

/** @returns {Map<string, string[]>} package name → the files that import it */
function scanImports(dir = rootDir) {
  const imported = new Map();

  for (const file of sourceFiles(dir)) {
    let source;
    try {
      source = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const specifier of importSpecifiers(source)) {
      const name = packageNameOf(specifier);
      if (BUILTINS.has(name)) continue;
      if (!imported.has(name)) imported.set(name, []);
      const files = imported.get(name);
      const relative = path.relative(dir, file);
      if (!files.includes(relative)) files.push(relative);
    }
  }

  return imported;
}

/**
 * @param {{ dir?: string, scan?: boolean }} [options] `scan: false` skips the source walk
 * @returns {{
 *   ok: boolean,
 *   nodeModulesFound: boolean,
 *   missing: string[],
 *   missingDev: string[],
 *   undeclared: { name: string, files: string[] }[],
 *   missingFromLock: string[],
 * }}
 */
function checkDependencies({ dir = rootDir, scan = true } = {}) {
  const result = {
    ok: true,
    nodeModulesFound: fs.existsSync(path.join(dir, "node_modules")),
    missing: [],
    missingDev: [],
    undeclared: [],
    missingFromLock: [],
  };

  const manifest = readManifest(dir);
  if (!manifest) return result;

  const dependencies = Object.keys(manifest.dependencies ?? {});
  const devDependencies = Object.keys(manifest.devDependencies ?? {});
  // Optional packages (platform-specific ones such as `sharp`) are allowed to be absent.
  const optional = new Set(Object.keys(manifest.optionalDependencies ?? {}));
  const absent = (names) => names.filter((name) => !optional.has(name) && !isInstalled(dir, name));

  result.missing = absent(dependencies);
  result.missingDev = absent(devDependencies);

  const lockfile = readLockfile(dir);
  if (lockfile?.packages) {
    const declared = [...dependencies, ...devDependencies];
    result.missingFromLock = declared.filter((name) => !lockfile.packages[`node_modules/${name}`]);
  }

  if (scan) {
    const declared = new Set([...dependencies, ...devDependencies, ...optional]);
    for (const [name, files] of scanImports(dir)) {
      if (declared.has(name) || OPTIONAL_AT_RUNTIME.has(name)) continue;
      result.undeclared.push({ name, files: [...files].sort() });
    }
    result.undeclared.sort((a, b) => a.name.localeCompare(b.name));
  }

  result.ok =
    result.missing.length === 0 &&
    result.missingDev.length === 0 &&
    result.undeclared.length === 0 &&
    result.missingFromLock.length === 0;

  return result;
}

/** True when a plain `npm install` can repair the situation. */
function needsInstall(result) {
  return result.missing.length > 0 || result.missingDev.length > 0 || result.missingFromLock.length > 0;
}

/** `npm` is `npm.cmd` on Windows; a spawn without the extension fails there. */
function npmCommand(platform = process.platform) {
  return platform === "win32" ? "npm.cmd" : "npm";
}

/**
 * @param {ReturnType<typeof checkDependencies>} result
 * @returns {string[]} `[…]`-prefixed lines; empty when the install is healthy
 */
function formatReport(result, { prefix = "[dev]" } = {}) {
  if (result.ok) return [];

  const lines = [];

  if (!result.nodeModulesFound) {
    lines.push(`${prefix} node_modules was not found — dependencies are not installed.`);
  } else {
    const all = [...result.missing, ...result.missingDev];
    if (all.length > 0) {
      lines.push(
        `${prefix} Missing ${all.length} ${all.length === 1 ? "package" : "packages"} from node_modules: ${all.join(", ")}`,
      );
      lines.push(`${prefix} The install is out of date (usually after pulling new commits).`);
    }
  }

  for (const entry of result.undeclared) {
    lines.push(
      `${prefix} Imported but not declared in package.json: ${entry.name} (${entry.files.slice(0, 3).join(", ")})`,
    );
  }

  if (result.missingFromLock.length > 0) {
    lines.push(
      `${prefix} Declared but absent from package-lock.json: ${result.missingFromLock.join(", ")}`,
    );
  }

  lines.push(
    needsInstall(result)
      ? `${prefix} Pages will fail with "Module not found" until you run:  npm install`
      : `${prefix} Fix package.json, then run:  npm install`,
  );

  return lines;
}

module.exports = {
  OPTIONAL_AT_RUNTIME,
  checkDependencies,
  formatReport,
  importSpecifiers,
  isInstalled,
  needsInstall,
  npmCommand,
  packageNameOf,
  rootDir,
  scanImports,
  stripComments,
};
