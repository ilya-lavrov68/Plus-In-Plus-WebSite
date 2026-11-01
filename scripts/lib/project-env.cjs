// Plain Node CLI scripts do not pass through Next/Payload startup. Load the
// same env-file variants before they resolve the database or Payload secret.
// Explicit shell/CI variables always keep priority over files.
const path = require("node:path");
const dotenv = require("dotenv");

const projectRoot = path.join(__dirname, "..", "..");

function loadProjectEnv(rootDir = projectRoot, env = process.env) {
  const mode = env.NODE_ENV === "production" ? "production" : env.NODE_ENV === "test" ? "test" : "development";
  const filenames = [
    `.env.${mode}.local`,
    ...(mode === "test" ? [] : [".env.local"]),
    `.env.${mode}`,
    ".env",
  ];
  return dotenv.config({
    path: filenames.map((filename) => path.join(rootDir, filename)),
    processEnv: env,
    quiet: true,
  });
}

module.exports = { loadProjectEnv };
