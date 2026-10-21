// Preflight for `npm run dev`: report declared packages that are missing from node_modules.
//
// After pulling a commit that added a dependency, a stale install otherwise surfaces deep
// inside webpack as `Module not found: Can't resolve '…'` plus a 500 on every page — with no
// hint that the real fix is `npm install`. Naming the missing packages before Next.js starts
// makes that obvious immediately.
const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.join(__dirname, "..", "..");

/** @param {string} dir @returns {{ dependencies?: object, devDependencies?: object, optionalDependencies?: object } | null} */
function readManifest(dir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
  } catch {
    return null;
  }
}

function isInstalled(dir, name) {
  return fs.existsSync(path.join(dir, "node_modules", name, "package.json"));
}

/**
 * @param {{ dir?: string }} [options] project directory to inspect
 * @returns {{ ok: boolean, nodeModulesFound: boolean, missing: string[], missingDev: string[] }}
 */
function checkDependencies({ dir = rootDir } = {}) {
  const result = {
    ok: true,
    nodeModulesFound: fs.existsSync(path.join(dir, "node_modules")),
    missing: [],
    missingDev: [],
  };

  const manifest = readManifest(dir);
  if (!manifest) return result;

  // Optional packages (and platform-specific ones such as `sharp`) are allowed to be absent.
  const optional = new Set(Object.keys(manifest.optionalDependencies ?? {}));
  const absent = (names) => names.filter((name) => !optional.has(name) && !isInstalled(dir, name));

  result.missing = absent(Object.keys(manifest.dependencies ?? {}));
  result.missingDev = absent(Object.keys(manifest.devDependencies ?? {}));
  result.ok = result.missing.length === 0 && result.missingDev.length === 0;

  return result;
}

/**
 * @param {{ ok: boolean, nodeModulesFound: boolean, missing: string[], missingDev: string[] }} result
 * @returns {string[]} `[dev] …` lines; empty when nothing is missing
 */
function formatReport(result) {
  if (result.ok) return [];

  const lines = [];
  if (!result.nodeModulesFound) {
    lines.push("[dev] node_modules was not found — dependencies are not installed.");
  } else {
    const all = [...result.missing, ...result.missingDev];
    lines.push(`[dev] Missing ${all.length} ${all.length === 1 ? "package" : "packages"} from node_modules: ${all.join(", ")}`);
    lines.push("[dev] The install is out of date (usually after pulling new commits).");
  }
  lines.push("[dev] Pages will fail with \"Module not found\" until you run:  npm install");

  return lines;
}

module.exports = { checkDependencies, formatReport, isInstalled, rootDir };
