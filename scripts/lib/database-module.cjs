// Loads lib/database.ts (the single source of truth for the database target) into
// a plain Node script.
const { register } = require("./ts-require.cjs");
const { loadProjectEnv } = require("./project-env.cjs");

// Every plain Node entry point imports this module before reading database env.
loadProjectEnv();

function loadDatabaseModule() {
  register();
  return require("../../lib/database.ts");
}

module.exports = { loadDatabaseModule };
