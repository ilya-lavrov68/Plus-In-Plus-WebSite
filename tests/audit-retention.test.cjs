const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => {
  module._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    filename,
  );
};

const {
  looksLikeContactOrNetworkText,
  pseudonymizeActivityRecord,
} = require("../lib/audit-retention.ts");

const KEY = "audit-retention-test-key-with-at-least-32-characters";

test("pseudonymization replaces every direct actor, email and IPv4 occurrence deterministically", () => {
  const original = {
    actorId: "user-direct-id",
    actorPseudonym: null,
    title: "User person@example.test emailed PERSON@example.test from 203.0.113.7 and 203.0.113.7",
  };
  const first = pseudonymizeActivityRecord(original, KEY);
  const second = pseudonymizeActivityRecord(original, KEY);

  assert.deepEqual(first, second);
  assert.equal(first.actorId, null);
  assert.match(first.actorPseudonym, /^actor_[a-f0-9]{32}$/);
  assert.equal(first.title.includes("person@example.test"), false);
  assert.equal(first.title.includes("PERSON@example.test"), false);
  assert.equal(first.title.includes("203.0.113.7"), false);
  assert.equal((first.title.match(/contact_[a-f0-9]{32}/g) ?? []).length, 2);
  assert.equal((first.title.match(/network_[a-f0-9]{32}/g) ?? []).length, 2);
  assert.equal(original.actorId, "user-direct-id", "the input record is not mutated");
  assert.equal(first.title.includes(KEY), false);
});

test("different keys do not produce the same pseudonym and clean records stay unchanged", () => {
  const record = { actorId: "user-id", actorPseudonym: null, title: "User account" };
  const first = pseudonymizeActivityRecord(record, KEY);
  const other = pseudonymizeActivityRecord(record, `${KEY}-other`);
  assert.notEqual(first.actorPseudonym, other.actorPseudonym);

  const clean = { actorId: null, actorPseudonym: first.actorPseudonym, title: "User account" };
  assert.deepEqual(pseudonymizeActivityRecord(clean, KEY), { ...clean, changed: false });
});

test("contact detection has no stateful regex carry-over between records", () => {
  for (let iteration = 0; iteration < 3; iteration += 1) {
    assert.equal(looksLikeContactOrNetworkText("person@example.test"), true);
    assert.equal(looksLikeContactOrNetworkText("198.51.100.8"), true);
    assert.equal(looksLikeContactOrNetworkText("User account"), false);
  }
});
