const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) =>
  module._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    filename
  );

const modulePath = require.resolve("../payload/env.ts");
const names = [
  "PAYLOAD_SECRET",
  "PAYLOAD_DATABASE_URL",
  "PAYLOAD_DATABASE_AUTH_TOKEN",
  "TURSO_DATABASE_URL",
  "DATABASE_URL",
];

function withEnv(values, callback) {
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  for (const name of names) delete process.env[name];
  Object.assign(process.env, values);
  delete require.cache[modulePath];
  try {
    return callback();
  } finally {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
    delete require.cache[modulePath];
  }
}

const valid = {
  PAYLOAD_SECRET: "test-payload-secret-with-at-least-32-characters",
  PAYLOAD_DATABASE_URL: "file:/tmp/payload-env-test.db",
};

test("Payload environment requires a dedicated database and strong explicit secret", () => {
  withEnv(valid, () => {
    const { payloadEnv } = require(modulePath);
    assert.equal(payloadEnv.databaseUrl, valid.PAYLOAD_DATABASE_URL);
    assert.equal(payloadEnv.secret, valid.PAYLOAD_SECRET);
  });

  withEnv({ ...valid, PAYLOAD_SECRET: "short" }, () => {
    assert.throws(() => require(modulePath), /PAYLOAD_SECRET/);
  });
  withEnv({ PAYLOAD_SECRET: valid.PAYLOAD_SECRET }, () => {
    assert.throws(() => require(modulePath), /PAYLOAD_DATABASE_URL/);
  });
});

test("Payload refuses to reuse the Prisma/Turso application database", () => {
  withEnv(
    { ...valid, TURSO_DATABASE_URL: valid.PAYLOAD_DATABASE_URL },
    () => assert.throws(() => require(modulePath), /must not reuse/)
  );
  withEnv(
    { ...valid, PAYLOAD_DATABASE_URL: "file:./prisma/dev.db" },
    () => assert.throws(() => require(modulePath), /must not reuse/)
  );
});
