// `npm run doctor` — one command that answers "can this checkout actually run?".
//
// It reports, in order: the Node version, install integrity (the cause of every
// `Module not found` 500), the generated Payload artifacts, the database target and the
// environment values the site needs to authenticate users and take payments. Secrets are
// never printed — only whether they are present and long enough.
//
// Exit code 1 means the site will not work as-is; warnings are things to fix before
// production.
const fs = require("node:fs");
const path = require("node:path");

const { checkDependencies, formatReport } = require("./lib/dependency-check.cjs");
const { loadDatabaseModule } = require("./lib/database-module.cjs");

const rootDir = path.join(__dirname, "..");

/** Reads KEY=value pairs from a .env file without pulling in a parser dependency. */
function readEnvFile(file = path.join(rootDir, ".env")) {
  const values = {};
  let source;
  try {
    source = fs.readFileSync(file, "utf8");
  } catch {
    return values;
  }
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!match) continue;
    values[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return values;
}

/** Minimum Node version from `engines.node` (">=24.22.1" style ranges only). */
function requiredNodeVersion(manifest) {
  const range = String(manifest?.engines?.node ?? "").match(/(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (!range) return null;
  return { major: Number(range[1]), minor: Number(range[2] ?? 0), patch: Number(range[3] ?? 0) };
}

function nodeVersionSatisfied(current, required) {
  if (!required) return true;
  if (current.major !== required.major) return current.major > required.major;
  if (current.minor !== required.minor) return current.minor > required.minor;
  return current.patch >= required.patch;
}

/**
 * @param {{ env?: NodeJS.ProcessEnv, versions?: string }} [options]
 * @returns {{ level: "ok" | "warn" | "error", area: string, message: string }[]}
 */
function collectFindings({ env = process.env, versions = process.versions.node } = {}) {
  const findings = [];
  const add = (level, area, message) => findings.push({ level, area, message });

  const manifest = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
  const [major, minor, patch] = versions.split(".").map(Number);
  const required = requiredNodeVersion(manifest);
  if (nodeVersionSatisfied({ major, minor, patch }, required)) {
    add("ok", "node", `Node ${versions} satisfies engines.node (${manifest?.engines?.node ?? "any"}).`);
  } else {
    add("error", "node", `Node ${versions} is older than engines.node (${manifest?.engines?.node}). Next.js will fail to start.`);
  }

  const dependencies = checkDependencies({ dir: rootDir });
  if (dependencies.ok) {
    add("ok", "install", "Every declared and imported package is present in node_modules.");
  } else {
    for (const line of formatReport(dependencies, { prefix: "[doctor]" })) {
      add("error", "install", line.replace("[doctor] ", ""));
    }
  }

  const payloadTypes = path.join(rootDir, "payload", "payload-types.ts");
  const adminPage = path.join(rootDir, "app", "(admin)", "admin", "page.tsx");
  if (fs.existsSync(payloadTypes) && fs.existsSync(adminPage)) {
    add("ok", "db", "Payload types and the custom admin panel are present.");
  } else {
    add("error", "db", "Payload types are missing — run: npm run payload:types");
  }

  try {
    const { resolveDatabaseConfig, describeDatabaseUrl } = loadDatabaseModule();
    const config = resolveDatabaseConfig({ allowDevelopmentFallback: true });
    if (!config) {
      add("warn", "database", "No database target: set TURSO_DATABASE_URL in .env (see .env.example).");
    } else {
      add("ok", "database", `${describeDatabaseUrl(config.url)} (${config.remote ? "Turso/libSQL remote" : "local file"}).`);
    }
  } catch (error) {
    add("warn", "database", `Database target could not be resolved: ${error.message}`);
  }

  const fileEnv = readEnvFile();
  const secret = (env.AUTH_SECRET || env.NEXTAUTH_SECRET || fileEnv.AUTH_SECRET || fileEnv.NEXTAUTH_SECRET || "").trim();
  if (!secret) {
    add("warn", "auth", "AUTH_SECRET is not set — auth fails closed: nobody can sign in (pages still render).");
  } else if (secret.length < 32) {
    add("warn", "auth", `AUTH_SECRET is ${secret.length} characters; at least 32 are required for sessions to be issued.`);
  } else {
    add("ok", "auth", "AUTH_SECRET is set and long enough (value not printed).");
  }

  const payloadSecret = (env.PAYLOAD_SECRET || fileEnv.PAYLOAD_SECRET || "").trim();
  if (payloadSecret.length < 32) {
    add("error", "payload", "PAYLOAD_SECRET must contain at least 32 characters (value not printed).");
  } else {
    add("ok", "payload", "PAYLOAD_SECRET is set and long enough (value not printed).");
  }

  const isProduction = (env.NODE_ENV ?? "").toLowerCase() === "production";
  const testMode = (env.ROBOKASSA_TEST_MODE || fileEnv.ROBOKASSA_TEST_MODE || "").trim();
  if (isProduction && testMode === "1") {
    add("warn", "payments", "ROBOKASSA_TEST_MODE=1 in production: no real money moves. Clear it before launch.");
  }
  if (isProduction && !env.AUTH_URL && !env.NEXTAUTH_URL && !fileEnv.AUTH_URL) {
    add("warn", "auth", "AUTH_URL is not set in production: cookies and HSTS depend on the public HTTPS URL.");
  }

  return findings;
}

function main() {
  const findings = collectFindings();
  const icon = { ok: "ok  ", warn: "warn", error: "FAIL" };

  for (const finding of findings) {
    console.log(`[doctor] ${icon[finding.level]} ${finding.area}: ${finding.message}`);
  }

  const failed = findings.filter((finding) => finding.level === "error").length;
  const warned = findings.filter((finding) => finding.level === "warn").length;
  console.log(
    failed > 0
      ? `\n[doctor] ${failed} problem(s) to fix, ${warned} warning(s).`
      : `\n[doctor] No blocking problems${warned > 0 ? `, ${warned} warning(s)` : ""}.`,
  );
  process.exit(failed > 0 ? 1 : 0);
}

if (require.main === module) main();

module.exports = { collectFindings, nodeVersionSatisfied, readEnvFile, requiredNodeVersion };
