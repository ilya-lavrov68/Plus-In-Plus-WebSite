const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) =>
  module._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    filename,
  );

/**
 * Telegram в тестах не вызывается: подменяем `fetch` и модуль настроек,
 * поэтому проверяется логика «настроено / не настроено / ошибка API», а не сеть.
 */

let storedSettings = {};
const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === "@/lib/commerce-data") {
    return { listSiteSettings: async () => ({ ...storedSettings }) };
  }
  if (name.startsWith("@/")) name = path.resolve(__dirname, "..", name.slice(2));
  return originalLoad.call(this, name, parent, isMain);
};

const {
  readNotificationConfig,
  sendTelegramMessage,
  sendTelegramTest,
  notifyNewOrder,
} = require("../lib/notifications.ts");

function fakeFetch(response) {
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({ url, init });
    return {
      ok: response.ok,
      status: response.status ?? (response.ok ? 200 : 400),
      json: async () => response.body,
    };
  };
  fetcher.calls = calls;
  return fetcher;
}

test("readNotificationConfig returns null until both values are set", async () => {
  storedSettings = {};
  assert.equal(await readNotificationConfig(), null);
  storedSettings = { telegramBotToken: "123456789:AAHfakefakefakefakefakefakefakefake" };
  assert.equal(await readNotificationConfig(), null);
  storedSettings = {
    telegramBotToken: "123456789:AAHfakefakefakefakefakefakefakefake",
    telegramChatId: "-1001234567890",
  };
  assert.deepEqual(await readNotificationConfig(), {
    botToken: "123456789:AAHfakefakefakefakefakefakefakefake",
    chatId: "-1001234567890",
  });
});

test("sendTelegramMessage posts to the Bot API and reports success", async () => {
  const fetcher = fakeFetch({ ok: true, body: { ok: true } });
  const result = await sendTelegramMessage({ botToken: "123:token", chatId: "42" }, "hello", fetcher);
  assert.deepEqual(result, { ok: true });
  assert.equal(fetcher.calls.length, 1);
  assert.match(fetcher.calls[0].url, /^https:\/\/api\.telegram\.org\/bot123:token\/sendMessage$/);
  const payload = JSON.parse(fetcher.calls[0].init.body);
  assert.equal(payload.chat_id, "42");
  assert.equal(payload.text, "hello");
});

test("sendTelegramMessage maps API errors to reasons", async () => {
  const unauthorized = fakeFetch({ ok: false, status: 401, body: { ok: false, description: "Unauthorized" } });
  assert.deepEqual(
    await sendTelegramMessage({ botToken: "1:t", chatId: "1" }, "x", unauthorized),
    { ok: false, reason: "invalid_config", detail: "Unauthorized" },
  );

  const serverError = fakeFetch({ ok: false, status: 500, body: { ok: false, description: "Server" } });
  assert.deepEqual(
    await sendTelegramMessage({ botToken: "1:t", chatId: "1" }, "x", serverError),
    { ok: false, reason: "api", detail: "Server" },
  );
});

test("sendTelegramMessage reports a network failure instead of throwing", async () => {
  const fetcher = async () => {
    throw new Error("getaddrinfo ENOTFOUND api.telegram.org");
  };
  assert.deepEqual(
    await sendTelegramMessage({ botToken: "1:t", chatId: "1" }, "x", fetcher),
    { ok: false, reason: "network" },
  );
});

test("sendTelegramTest explains that nothing is configured", async () => {
  assert.deepEqual(await sendTelegramTest(null), { ok: false, reason: "not_configured" });
});

test("notifyNewOrder formats the order and stays silent without config", async () => {
  storedSettings = {};
  assert.deepEqual(await notifyNewOrder({ orderNumber: "PIP-1", services: ["Знак"], amount: 5000 }), {
    ok: false,
    reason: "not_configured",
  });

  storedSettings = {
    telegramBotToken: "123456789:AAHfakefakefakefakefakefakefakefake",
    telegramChatId: "-1001234567890",
  };
  const fetcher = fakeFetch({ ok: true, body: { ok: true } });
  const result = await notifyNewOrder(
    {
      orderNumber: "PIP-1001",
      services: ["Sign Design", "Billboard"],
      amount: 15000,
      customerEmail: "client@example.com",
      deadline: "2026-12-01T00:00:00.000Z",
    },
    fetcher,
  );
  assert.deepEqual(result, { ok: true });
  const text = JSON.parse(fetcher.calls[0].init.body).text;
  assert.match(text, /PIP-1001/);
  assert.match(text, /Sign Design, Billboard/);
  assert.match(text, /15\s?000/);
  assert.match(text, /2026-12-01/);
  assert.match(text, /client@example\.com/);
});
