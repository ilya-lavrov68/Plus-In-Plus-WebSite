const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);

const { isJsonObject, readJsonBody } = require("../lib/request-body.ts");

function jsonRequest(body, headers = {}) {
  return new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body,
  });
}

test("JSON body parser accepts a bounded JSON document with a charset", async () => {
  const result = await readJsonBody(jsonRequest('{"ok":true}', { "Content-Type": "application/json; charset=utf-8" }), 1024);
  assert.deepEqual(result, { ok: true, value: { ok: true } });
  assert.equal(isJsonObject(result.value), true);
  assert.equal(isJsonObject(null), false);
  assert.equal(isJsonObject([]), false);
});

test("JSON endpoints reject wrong media types before parsing", async () => {
  const result = await readJsonBody(jsonRequest('{"ok":true}', { "Content-Type": "text/plain" }), 1024);
  assert.deepEqual(result, { ok: false, status: 415, error: "Content-Type must be application/json." });
});

test("declared and actual oversized bodies return 413", async () => {
  const declared = await readJsonBody(jsonRequest('{"ok":true}', { "Content-Length": "2048" }), 16);
  assert.equal(declared.status, 413);

  // Node's Request may calculate its own length, so use a stream with no declared size.
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('{"value":"'));
      controller.enqueue(new TextEncoder().encode("x".repeat(64)));
      controller.enqueue(new TextEncoder().encode('"}'));
      controller.close();
    },
  });
  const request = new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: stream,
    duplex: "half",
  });
  assert.equal(request.headers.has("content-length"), false);
  const streamed = await readJsonBody(request, 16);
  assert.equal(streamed.status, 413);
});

test("malformed JSON, invalid UTF-8 and invalid Content-Length return 400", async () => {
  assert.equal((await readJsonBody(jsonRequest("{"), 1024)).status, 400);
  assert.equal((await readJsonBody(jsonRequest("{}", { "Content-Length": "invalid" }), 1024)).status, 400);

  const invalidUtf8 = new Request("http://localhost/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: new Uint8Array([0xc3, 0x28]),
  });
  assert.equal((await readJsonBody(invalidUtf8, 1024)).status, 400);
});
