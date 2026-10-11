// Structural comparison of prisma/schema.prisma against the live libSQL database.
//
// `prisma db push` decides schema changes far more precisely, but the Prisma CLI
// keeps its adapter connection open for about a minute after it printed the result
// (v6.19 + libSQL adapter), which would make every `npm run dev` wait a minute for
// nothing. This lightweight check answers the only question that matters at
// startup — "does every table/column from the schema exist?" — in milliseconds,
// and the CLI is only started when it does not.
const fs = require("node:fs");
const path = require("node:path");

const SCALAR_TYPES = new Set([
  "String", "Int", "BigInt", "Float", "Decimal", "Boolean", "DateTime", "Json", "Bytes",
]);

/** @returns {{ table: string, columns: string[] }[]} */
function parseSchema(schemaPath = path.join(__dirname, "..", "..", "prisma", "schema.prisma")) {
  const source = fs.readFileSync(schemaPath, "utf8");
  const models = [];

  for (const match of source.matchAll(/model\s+(\w+)\s*\{([\s\S]*?)\n\}/g)) {
    const [, name, body] = match;
    const mappedName = body.match(/@@map\("([^"]+)"\)/)?.[1] ?? name;
    const columns = [];

    for (const line of body.split("\n")) {
      const field = line.trim().match(/^(\w+)\s+([A-Za-z]+)(\[\])?(\?)?/);
      if (!field) continue;
      const [, fieldName, fieldType, isList] = field;
      // Relations (User, ActivityLog[]) and attributes are not columns.
      if (!SCALAR_TYPES.has(fieldType) || isList) continue;
      const mapped = line.match(/@map\("([^"]+)"\)/)?.[1];
      columns.push(mapped ?? fieldName);
    }

    models.push({ table: mappedName, columns });
  }

  return models;
}

async function inspectDatabase(url, authToken) {
  const { createClient } = require("@libsql/client");
  const client = createClient({ url, authToken });

  const master = await client.execute("select name from sqlite_master where type = 'table'");
  const tables = new Set(master.rows.map((row) => String(row.name)));
  const columnsByTable = new Map();

  for (const table of tables) {
    const info = await client.execute(`pragma table_info("${table}")`);
    columnsByTable.set(table, new Set(info.rows.map((row) => String(row.name))));
  }

  return { tables, columnsByTable, close: () => client.close() };
}

/** @returns {Promise<{ ok: boolean, missingTables: string[], missingColumns: string[] }>} */
async function checkSchema({ url, authToken, schemaPath }) {
  const expected = parseSchema(schemaPath);
  const database = await inspectDatabase(url, authToken);

  try {
    const missingTables = [];
    const missingColumns = [];

    for (const model of expected) {
      if (!database.tables.has(model.table)) {
        missingTables.push(model.table);
        continue;
      }
      const present = database.columnsByTable.get(model.table);
      for (const column of model.columns) {
        if (!present.has(column)) missingColumns.push(`${model.table}.${column}`);
      }
    }

    return { ok: missingTables.length === 0 && missingColumns.length === 0, missingTables, missingColumns };
  } finally {
    database.close();
  }
}

module.exports = { checkSchema, parseSchema };
