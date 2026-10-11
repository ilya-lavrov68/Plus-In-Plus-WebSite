// Loads lib/database.ts (the single source of truth for the database target) into
// a plain Node script.
const { register } = require("./ts-require.cjs");

function loadDatabaseModule() {
  register();
  return require("../../lib/database.ts");
}

module.exports = { loadDatabaseModule };
