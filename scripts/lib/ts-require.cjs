// Lets plain Node scripts load the project's TypeScript modules (lib/database.ts),
// exactly like tests/*.test.cjs do. Keeping one implementation means the app, the
// Prisma CLI config and these scripts can never disagree about the database target.
const fs = require("node:fs");

function register() {
  if (require.extensions[".ts"]) return;

  let ts;
  try {
    ts = require("typescript");
  } catch {
    throw new Error(
      "The `typescript` dev dependency is required to run this script. Install it with `npm install`.",
    );
  }

  const compilerOptions = {
    module: ts.ModuleKind.CommonJS,
    esModuleInterop: true,
    target: ts.ScriptTarget.ES2022,
  };

  require.extensions[".ts"] = (module, filename) => {
    module._compile(
      ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions }).outputText,
      filename,
    );
  };
}

module.exports = { register };
