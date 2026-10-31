const assert = require("node:assert/strict");
const { test } = require("node:test");
const merge = require("../vendor/deepmerge");

const malicious = (value) => JSON.parse(value);

test("patched deepmerge rejects returned-object prototype poisoning", () => {
  const nullPrototypeTarget = Object.create(null);
  nullPrototypeTarget.debug = false;
  const fromNullPrototype = merge(
    nullPrototypeTarget,
    malicious('{"__proto__":{"isAdmin":true}}')
  );
  assert.equal(Object.getPrototypeOf(fromNullPrototype), Object.prototype);
  assert.equal(fromNullPrototype.isAdmin, undefined);
  assert.equal(fromNullPrototype.debug, false);

  const fromNullPlaceholder = merge(
    { session: null },
    malicious('{"session":{"__proto__":{"isAdmin":true}}}')
  );
  assert.equal(Object.getPrototypeOf(fromNullPlaceholder.session), Object.prototype);
  assert.equal(fromNullPlaceholder.session.isAdmin, undefined);

  const fromOwnProto = merge(
    malicious('{"__proto__":{"isAdmin":true},"debug":false}'),
    { verbose: true }
  );
  assert.equal(Object.getPrototypeOf(fromOwnProto), Object.prototype);
  assert.equal(fromOwnProto.isAdmin, undefined);
  assert.equal(Object.hasOwn(fromOwnProto, "__proto__"), false);
  assert.equal(fromOwnProto.debug, false);
  assert.equal(fromOwnProto.verbose, true);

  const fromArray = merge(
    { list: [] },
    malicious('{"list":[{"__proto__":{"isAdmin":true}}]}')
  );
  assert.equal(Object.getPrototypeOf(fromArray.list[0]), Object.prototype);
  assert.equal(fromArray.list[0].isAdmin, undefined);
  assert.equal({}.isAdmin, undefined);
});
