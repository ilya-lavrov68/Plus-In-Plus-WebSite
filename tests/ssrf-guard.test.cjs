const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => {
  module._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    filename
  );
};

const { assertPublicUrl, fetchPublicText, isBlockedHostname, isPrivateAddress, UnsafeTargetError } = require("../lib/ssrf-guard.ts");

// Everything here is offline: addresses that need DNS are only checked for rejection, and the
// accepted cases use IP literals, which the guard validates without resolving anything.

test("loopback, private, link-local and reserved addresses are private", () => {
  for (const address of [
    "127.0.0.1",
    "127.1.2.3",
    "0.0.0.0",
    "10.0.0.1",
    "10.255.255.255",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.0.1",
    "169.254.169.254", // cloud metadata
    "100.64.0.1", // carrier-grade NAT
    "224.0.0.1",
    "255.255.255.255",
    "::1",
    "::",
    "fc00::1",
    "fd12:3456::1",
    "fe80::1",
    "ff02::1",
    "[::1]",
  ]) {
    assert.equal(isPrivateAddress(address), true, `${address} must be treated as internal`);
  }

  for (const address of ["8.8.8.8", "93.184.216.34", "172.32.0.1", "1.1.1.1", "2606:2800:220:1:248:1893:25c8:1946"]) {
    assert.equal(isPrivateAddress(address), false, `${address} is a public address`);
  }
});

test("hostnames that mean 'this machine' or 'the internal network' are blocked", () => {
  for (const hostname of [
    "localhost",
    "LOCALHOST",
    "printer.local",
    "db.internal",
    "app.localhost",
    "fileserver.lan",
    "metadata.google.internal",
    "127.0.0.1",
    "[::1]",
    "192.168.1.10",
    "",
    "   ",
  ]) {
    assert.equal(isBlockedHostname(hostname), true, `${hostname} must be blocked`);
  }

  for (const hostname of ["vk.com", "t.me", "www.youtube.com", "example.org"]) {
    assert.equal(isBlockedHostname(hostname), false, `${hostname} is a normal public host`);
  }
});

test("only http and https on the standard ports are accepted", async () => {
  for (const url of [
    "file:///etc/passwd",
    "ftp://example.com/file",
    "gopher://127.0.0.1:70/",
    "http://[::1]/",
    "http://127.0.0.1/admin",
    "http://127.0.0.1:3000/admin",
    "https://169.254.169.254/latest/meta-data/",
    "http://10.0.0.5:8080/",
    "http://192.168.1.1",
    "http://localhost:3000",
    "http://printer.local/share",
    "http://user:password@93.184.216.34/",
    "http://93.184.216.34:8080/",
    "http://93.184.216.34:22/",
    "not a url",
  ]) {
    await assert.rejects(assertPublicUrl(url), UnsafeTargetError, `${url} must be rejected`);
  }

  const accepted = await assertPublicUrl("https://93.184.216.34/wall-1");
  assert.equal(accepted.protocol, "https:");
  // The URL parser drops default ports, so an explicit :80 must survive as "no port".
  const withPort = await assertPublicUrl("http://93.184.216.34:80/page");
  assert.equal(withPort.hostname, "93.184.216.34");
  assert.equal(withPort.port, "");
});

test("credentials and non-http schemes never reach the network", async () => {
  await assert.rejects(assertPublicUrl("https://admin:secret@8.8.8.8/"), /credentials/);
  await assert.rejects(assertPublicUrl("javascript:alert(1)"), UnsafeTargetError);
  await assert.rejects(assertPublicUrl("data:text/html,<script>"), UnsafeTargetError);
});

test("response reads stop at the byte cap even when one chunk is larger", async () => {
  let cancelled = false;
  let readCount = 0;
  const body = {
    getReader: () => ({
      read: async () => {
        readCount += 1;
        return { done: false, value: new TextEncoder().encode("0123456789abcdef") };
      },
      cancel: async () => { cancelled = true; },
    }),
  };
  let dispatcherSeen = false;
  const fetchImpl = async (_url, init) => {
    dispatcherSeen = Boolean(init.dispatcher);
    return { status: 200, ok: true, headers: new Headers(), body };
  };

  const text = await fetchPublicText("https://93.184.216.34/large", {
    fetchImpl,
    maxBytes: 5,
    timeoutMs: 1_000,
  });

  assert.equal(text, "01234");
  assert.equal(readCount, 1, "the consumer must not read another chunk after reaching the cap");
  assert.equal(cancelled, true, "the unread response stream must be cancelled");
  assert.equal(dispatcherSeen, true, "the validated DNS target must be passed to the transport");
});

test("every redirect is revalidated before another request", async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(String(url));
    return new Response(null, {
      status: 302,
      headers: { Location: "http://127.0.0.1/internal" },
    });
  };

  await assert.rejects(
    fetchPublicText("https://93.184.216.34/start", { fetchImpl, timeoutMs: 1_000 }),
    UnsafeTargetError,
  );
  assert.deepEqual(calls, ["https://93.184.216.34/start"]);
});
