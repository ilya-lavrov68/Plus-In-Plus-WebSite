const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

/**
 * Next.js rejects a client/server-action bundle at runtime when a "use server"
 * module exports a value that is not an async function. Type-only exports are
 * erased and remain valid.
 */
test("every runtime export from a use server module is an async function", () => {
  const actionsDirectory = path.resolve(__dirname, "../app/actions");
  const files = fs
    .readdirSync(actionsDirectory)
    .filter((name) => name.endsWith(".ts") || name.endsWith(".tsx"));
  const failures = [];
  let serverModules = 0;

  for (const name of files) {
    const filename = path.join(actionsDirectory, name);
    const source = ts.createSourceFile(
      filename,
      fs.readFileSync(filename, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      name.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const hasServerDirective = source.statements.some(
      (statement) =>
        ts.isExpressionStatement(statement) &&
        ts.isStringLiteral(statement.expression) &&
        statement.expression.text === "use server",
    );
    if (!hasServerDirective) continue;
    serverModules += 1;

    for (const statement of source.statements) {
      if (ts.isExportDeclaration(statement)) {
        if (!statement.isTypeOnly) {
          failures.push(`${name}: value re-export is not a server action`);
        }
        continue;
      }
      if (ts.isExportAssignment(statement)) {
        failures.push(`${name}: default export is not a named async action`);
        continue;
      }

      const modifiers = ts.canHaveModifiers(statement)
        ? ts.getModifiers(statement) ?? []
        : [];
      const exported = modifiers.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
      );
      if (!exported) continue;
      if (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) {
        continue;
      }

      const isAsyncFunction =
        ts.isFunctionDeclaration(statement) &&
        modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword);
      if (!isAsyncFunction) {
        const location = source.getLineAndCharacterOfPosition(statement.getStart(source));
        const declaration = statement.declarationList
          ? "variable/object"
          : statement.kind === ts.SyntaxKind.ClassDeclaration
            ? "class"
            : "non-async";
        failures.push(`${name}:${location.line + 1} ${declaration} export`);
      }
    }
  }

  assert.ok(serverModules >= 6, "the audit must discover the server action modules");
  assert.deepEqual(failures, []);
});
