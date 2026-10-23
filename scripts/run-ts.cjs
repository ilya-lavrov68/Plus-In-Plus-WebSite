// Executes a TypeScript script in `scripts/*.ts` using the repository's existing
// `typescript` devDependency and database configuration (local SQLite or Turso).
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const ts = require("typescript");
const { loadDatabaseModule } = require("./lib/database-module.cjs");

const rootDir = path.join(__dirname, "..");

const compilerOptions = {
  module: ts.ModuleKind.CommonJS,
  esModuleInterop: true,
  target: ts.ScriptTarget.ES2022,
};

require.extensions[".ts"] = (mod, filename) => {
  const source = fs
    .readFileSync(filename, "utf8")
    .replace(
      /\bimport\.meta\.url\b/g,
      'require("node:url").pathToFileURL(__filename).href'
    );
  const { outputText } = ts.transpileModule(source, { compilerOptions });
  mod._compile(outputText, filename);
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request.startsWith("@/")) {
    const resolved = path.join(rootDir, request.slice(2));
    return originalLoad.call(this, resolved, parent, isMain);
  }
  return originalLoad.call(this, request, parent, isMain);
};

// Default to local `prisma/dev.db` when TURSO_DATABASE_URL is not explicitly set.
if (!process.env.TURSO_DATABASE_URL) {
  const { resolveDatabaseConfig } = loadDatabaseModule();
  const config = resolveDatabaseConfig({
    env: { ...process.env, NODE_ENV: "development" },
    rootDir,
    allowDevelopmentFallback: true,
  });
  if (config?.url) {
    process.env.TURSO_DATABASE_URL = config.url;
  }
}

const target = process.argv[2];
if (!target) {
  console.error("Usage: node scripts/run-ts.cjs <script.ts>");
  process.exit(1);
}

require(path.resolve(rootDir, target));
