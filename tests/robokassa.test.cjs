const assert = require("node:assert/strict");
const { test, beforeEach, describe } = require("node:test");
const crypto = require("node:crypto");
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

/** В памяти: только платежи одного заказа — логику выставления проверяем. */
const invoiceDb = {
  payments: new Map(),
  orders: new Map(),
  logs: [],
  sequence: 0,
  reset() {
    this.payments = new Map();
    this.orders = new Map();
    this.logs = [];
    this.sequence = 0;
  },
  seed(rows) {
    for (const row of rows) {
      this.payments.set(row.id, {
        orderId: "ord-7",
        provider: "robokassa",
        createdAt: new Date("2026-01-01T00:00:00Z"),
        ...row,
      });
    }
    // Счётчик продолжается после подсунутых записей, иначе новый платёж
    // получит тот же id, что уже лежит в базе.
    this.sequence = Math.max(this.sequence, rows.length);
  },
  prisma: {
    payment: {
      findMany: async ({ where = {} } = {}) =>
        [...invoiceDb.payments.values()]
          .filter((p) => (!where.orderId || p.orderId === where.orderId) && (!where.status || p.status === where.status))
          .sort((a, b) => b.createdAt - a.createdAt)
          .map((row) => structuredClone(row)),
      findFirst: async ({ where = {} } = {}) => {
        const rows = [...invoiceDb.payments.values()]
          .filter((p) =>
            (!where.id || p.id === where.id) &&
            (!where.orderId || p.orderId === where.orderId) &&
            (!where.provider || p.provider === where.provider) &&
            (!where.externalId || p.externalId === where.externalId) &&
            (!where.status || p.status === where.status))
          .sort((a, b) => b.createdAt - a.createdAt);
        return structuredClone(rows[0] ?? null);
      },
      aggregate: async ({ where = {} } = {}) => {
        const rows = [...invoiceDb.payments.values()].filter((payment) =>
          (!where.orderId || payment.orderId === where.orderId) &&
          (!where.status || payment.status === where.status));
        return {
          _sum: { amount: rows.reduce((sum, payment) => sum + payment.amount, 0) },
          _count: { _all: rows.length },
        };
      },
      create: async ({ data }) => {
        if (data.externalId != null && [...invoiceDb.payments.values()].some((payment) =>
          payment.provider === data.provider && payment.externalId === data.externalId)) {
          throw Object.assign(new Error("duplicate provider invoice"), { code: "P2002" });
        }
        const row = { id: `pay-${++invoiceDb.sequence}`, createdAt: new Date(), ...data };
        invoiceDb.payments.set(row.id, row);
        return { id: row.id, paymentUrl: row.paymentUrl };
      },
      updateMany: async ({ where, data }) => {
        let count = 0;
        for (const row of invoiceDb.payments.values()) {
          if (where.id && row.id !== where.id) continue;
          if (where.orderId && row.orderId !== where.orderId) continue;
          if (where.status && row.status !== where.status) continue;
          if (where.amount !== undefined && row.amount !== where.amount) continue;
          if (where.paymentUrl !== undefined && row.paymentUrl !== where.paymentUrl) continue;
          Object.assign(row, structuredClone(data));
          count += 1;
        }
        return { count };
      },
    },
    order: {
      findUnique: async ({ where }) => structuredClone(invoiceDb.orders.get(where.id) ?? null),
      count: async ({ where = {} } = {}) => [...invoiceDb.orders.values()]
        .filter((order) =>
          (!where.status?.in || where.status.in.includes(order.status)) &&
          (!where.payments?.some || [...invoiceDb.payments.values()].some((payment) =>
            payment.orderId === order.id &&
            (!where.payments.some.status || payment.status === where.payments.some.status)))).length,
      updateMany: async ({ where, data }) => {
        const order = invoiceDb.orders.get(where.id);
        if (!order || (where.status && order.status !== where.status) ||
          (where.total !== undefined && order.total !== where.total)) return { count: 0 };
        Object.assign(order, structuredClone(data));
        return { count: 1 };
      },
    },
    activityLog: {
      create: async ({ data }) => { invoiceDb.logs.push(structuredClone(data)); return data; },
    },
    $transaction: async (callback) => callback(invoiceDb.prisma),
  },
};

const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  // Сгенерированный Prisma-клиент — ESM, из .cjs его не подключить.
  // invoice.ts всё равно работает только с базой, а здесь проверяется
  // чистая арифметика номера счёта.
  if (name === "@/lib/prisma") return { prisma: invoiceDb.prisma };
  if (name.startsWith("@/")) name = path.resolve(__dirname, "..", name.slice(2));
  return originalLoad.call(this, name, parent, isMain);
};

const robokassa = require("../lib/payments/robokassa.ts");
const { invoiceNumber } = require("../lib/payments/invoice.ts");

const LOGIN = "shop";
const PASS1 = "password-one";
const PASS2 = "password-two";

/** Эталонная подпись считается независимо — не тем же кодом, что проверяем. */
function md5(value) {
  return crypto.createHash("md5").update(value, "utf8").digest("hex").toUpperCase();
}

beforeEach(() => {
  process.env.ROBOKASSA_MERCHANT_LOGIN = LOGIN;
  process.env.ROBOKASSA_PASSWORD1 = PASS1;
  process.env.ROBOKASSA_PASSWORD2 = PASS2;
  delete process.env.ROBOKASSA_TEST_MODE;
  delete process.env.ROBOKASSA_HASH_ALGO;
});

describe("сумма", () => {
  test("копейки превращаются в рубли с двумя знаками", () => {
    assert.equal(robokassa.formatOutSum(123450), "1234.50");
    assert.equal(robokassa.formatOutSum(100), "1.00");
    assert.equal(robokassa.formatOutSum(0), "0.00");
    assert.equal(robokassa.formatOutSum(5), "0.05");
  });

  test("дробные копейки не протекают в сумму", () => {
    // Если где-то посчитали 1234.499, в платёж должно уйти ровное число.
    assert.equal(robokassa.formatOutSum(123449.9 | 0), "1234.49");
  });
});

describe("подписи", () => {
  test("подпись запроса: логин:сумма:счёт:пароль1", () => {
    const config = robokassa.readConfig();
    assert.equal(robokassa.requestSignature(config, "100.00", 5), md5(`${LOGIN}:100.00:5:${PASS1}`));
  });

  test("подпись уведомления строится на втором пароле", () => {
    const config = robokassa.readConfig();
    assert.equal(robokassa.resultSignature(config, "100.00", 5), md5(`100.00:5:${PASS2}`));
  });

  test("страница успеха подписывается первым паролем, а не вторым", () => {
    const config = robokassa.readConfig();
    assert.equal(robokassa.successSignature(config, "100.00", 5), md5(`100.00:5:${PASS1}`));
    // Второй пароль наружу не уходит — иначе его можно подсмотреть.
    assert.notEqual(
      robokassa.successSignature(config, "100.00", 5),
      robokassa.resultSignature(config, "100.00", 5),
    );
  });

  test("дополнительные параметры идут в алфавитном порядке", () => {
    const config = robokassa.readConfig();
    const expected = md5(`${LOGIN}:100.00:5:${PASS1}:shp_a=1:shp_b=2`);
    // Порядок в объекте намеренно обратный: сортировка обязана поправить.
    assert.equal(robokassa.requestSignature(config, "100.00", 5, { shp_b: "2", shp_a: "1" }), expected);
  });

  test("разные алгоритмы дают разные подписи", () => {
    process.env.ROBOKASSA_HASH_ALGO = "sha256";
    const config = robokassa.readConfig();
    assert.equal(config.hashAlgo, "sha256");
    assert.equal(
      robokassa.resultSignature(config, "100.00", 5),
      crypto.createHash("sha256").update(`100.00:5:${PASS2}`, "utf8").digest("hex").toUpperCase(),
    );
  });

  test("неизвестный алгоритм не ломает подпись, а берёт md5", () => {
    process.env.ROBOKASSA_HASH_ALGO = "sha1-чего-то";
    const config = robokassa.readConfig();
    assert.equal(config.hashAlgo, "md5");
    assert.equal(robokassa.resultSignature(config, "100.00", 5), md5(`100.00:5:${PASS2}`));
  });
});

describe("проверка подписи", () => {
  test("своя подпись принимается", () => {
    const config = robokassa.readConfig();
    const signature = robokassa.resultSignature(config, "100.00", 5);
    assert.equal(robokassa.signatureMatches(signature, signature), true);
  });

  test("регистр не важен, а вот любая ошибка — да", () => {
    const config = robokassa.readConfig();
    const signature = robokassa.resultSignature(config, "100.00", 5);
    assert.equal(robokassa.signatureMatches(signature, signature.toLowerCase()), true);
    assert.equal(robokassa.signatureMatches(signature, `${signature}X`), false);
    assert.equal(robokassa.signatureMatches(signature, ""), false);
    assert.equal(robokassa.signatureMatches(signature, null), false);
    assert.equal(robokassa.signatureMatches(signature, undefined), false);
  });

  test("не та сумма — не та подпись", () => {
    const config = robokassa.readConfig();
    const signature = robokassa.resultSignature(config, "1.00", 5);
    // Попытка оплатить заказ за копейку.
    assert.equal(robokassa.signatureMatches(robokassa.resultSignature(config, "100.00", 5), signature), false);
  });
});

describe("ссылка на оплату", () => {
  test("в ссылке есть всё нужное и верная подпись", () => {
    const url = robokassa.buildPaymentUrl({
      amount: 123450,
      invId: 7000,
      description: "Оплата заказа ПИП-000007",
      email: "client@test",
      extra: { OrderId: "ord-000007" },
    });
    const parsed = new URL(url);
    assert.equal(parsed.origin + parsed.pathname, "https://auth.robokassa.ru/Merchant/Index.aspx");
    assert.equal(parsed.searchParams.get("MerchantLogin"), LOGIN);
    assert.equal(parsed.searchParams.get("OutSum"), "1234.50");
    assert.equal(parsed.searchParams.get("InvId"), "7000");
    assert.equal(parsed.searchParams.get("Email"), "client@test");
    assert.equal(parsed.searchParams.get("Encoding"), "utf-8");

    // shp_-параметр подписан и при этом реально уехал в ссылку.
    const expected = md5(`${LOGIN}:1234.50:7000:${PASS1}:shp_OrderId=ord-000007`);
    assert.equal(parsed.searchParams.get("SignatureValue"), expected);
    assert.equal(parsed.searchParams.get("shp_OrderId"), "ord-000007");
  });

  test("подпись и ссылка не расходятся: всё, что подписано, уехало", () => {
    const url = new URL(
      robokassa.buildPaymentUrl({
        amount: 50000,
        invId: 900,
        description: "Счёт",
        extra: { OrderId: "ord-9", Source: "site" },
      }),
    );
    // Пересчитываем подпись по тем же данным, что реально лежат в ссылке.
    const expected = md5(
      `${LOGIN}:${url.searchParams.get("OutSum")}:900:${PASS1}:shp_OrderId=ord-9:shp_Source=site`,
    );
    assert.equal(url.searchParams.get("SignatureValue"), expected);
    assert.equal(url.searchParams.get("shp_OrderId"), "ord-9");
    assert.equal(url.searchParams.get("shp_Source"), "site");
  });

  test("тестовый режим помечает ссылку", () => {
    process.env.ROBOKASSA_TEST_MODE = "1";
    const url = robokassa.buildPaymentUrl({ amount: 100, invId: 1, description: "тест" });
    assert.equal(new URL(url).searchParams.get("IsTest"), "1");
  });

  test("без настроек в разработке работает демо-магазин TestMerchant", () => {
    delete process.env.ROBOKASSA_PASSWORD1;
    assert.equal(robokassa.isRobokassaConfigured(), false);
    // ТЗ: ключей нет — используем тестовые (TestMerchant / qwe / qwe),
    // деньги не списываются (IsTest=1).
    const url = new URL(robokassa.buildPaymentUrl({ amount: 100, invId: 1, description: "тест" }));
    assert.equal(url.searchParams.get("MerchantLogin"), "TestMerchant");
    assert.equal(url.searchParams.get("IsTest"), "1");
    assert.equal(url.searchParams.get("SignatureValue"), md5("TestMerchant:1.00:1:qwe"));
  });

  test("в production без ключей демо не подставляется: ссылки нет, но и падения нет", () => {
    // Пароль демо-магазина публичен: в production поддельное «уведомление об
    // оплате» подписал бы кто угодно. Поэтому без ключей — честный null.
    delete process.env.ROBOKASSA_PASSWORD1;
    const savedNodeEnv = process.env.NODE_ENV;
    const savedDemo = process.env.ROBOKASSA_DEMO_MODE;
    process.env.NODE_ENV = "production";
    delete process.env.ROBOKASSA_DEMO_MODE;
    try {
      assert.equal(robokassa.buildPaymentUrl({ amount: 100, invId: 1, description: "тест" }), null);
      // …а с явным флагом демо разрешено и в production (для сквозной проверки).
      process.env.ROBOKASSA_DEMO_MODE = "1";
      assert.ok(robokassa.buildPaymentUrl({ amount: 100, invId: 1, description: "тест" }));
    } finally {
      if (savedNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = savedNodeEnv;
      if (savedDemo === undefined) delete process.env.ROBOKASSA_DEMO_MODE; else process.env.ROBOKASSA_DEMO_MODE = savedDemo;
    }
  });

  test("описание обрезается по длине", () => {
    const url = robokassa.buildPaymentUrl({ amount: 100, invId: 1, description: "x".repeat(300) });
    assert.equal(new URL(url).searchParams.get("Description").length, 100);
  });
});

describe("сквозной сценарий", () => {
  test("уведомление подходит к ссылке, по которой клиент ушёл платить", () => {
    const config = robokassa.readConfig();
    const amount = 289900;
    const invId = 4000;
    const extra = { OrderId: "ord-000004" };

    // Ушли по ссылке…
    const url = new URL(robokassa.buildPaymentUrl({ amount, invId, description: "Счёт", extra }));
    // …вернулось уведомление с теми же суммой и номером.
    const incoming = {
      outSum: url.searchParams.get("OutSum"),
      invId: url.searchParams.get("InvId"),
      signature: robokassa.resultSignature(config, url.searchParams.get("OutSum"), invId, extra),
    };
    assert.equal(
      robokassa.signatureMatches(
        robokassa.resultSignature(config, incoming.outSum, incoming.invId, extra),
        incoming.signature,
      ),
      true,
    );
  });
});

describe("номер счёта", () => {
  test("выводится из номера заказа и не сталкивается при повторе", () => {
    assert.equal(invoiceNumber("ПИП-000007", 0), 7000);
    assert.equal(invoiceNumber("ПИП-000007", 1), 7001);
    assert.equal(invoiceNumber("ПИП-000012", 0), 12000);
  });

  test("битый номер не роняет выставление счёта", () => {
    assert.equal(invoiceNumber("без цифр", 0), 0);
    assert.equal(invoiceNumber("", 3), 3);
  });
});


describe("повторное выставление счёта", () => {
  test("та же сумма — тот же счёт, а не новый", async () => {
    const { issueInvoice } = require("../lib/payments/invoice.ts");
    invoiceDb.reset();
    invoiceDb.seed([{ id: "pay-1", status: "pending", amount: 1600000, externalId: "7000", paymentUrl: "https://pay/7000" }]);

    const again = await issueInvoice({
      orderId: "ord-7", orderNumber: "ПИП-000007", amount: 1_600_000,
      currency: "RUB", customerEmail: "c@test",
    });

    assert.equal(again.paymentId, "pay-1", "ссылка должна остаться прежней");
    assert.equal(invoiceDb.payments.size, 1, "новый счёт не создаётся");
  });

  test("pending счёт без ссылки подписывается на месте после подключения провайдера", async () => {
    const { issueInvoice } = require("../lib/payments/invoice.ts");
    invoiceDb.reset();
    invoiceDb.seed([{ id: "pay-existing", status: "pending", amount: 1600000, externalId: "7000", paymentUrl: null }]);
    const input = {
      orderId: "ord-7", orderNumber: "ПИП-000007", amount: 1_600_000,
      currency: "RUB", customerEmail: "c@test",
    };

    const regenerated = await issueInvoice(input);
    assert.equal(regenerated.paymentId, "pay-existing");
    assert.equal(regenerated.invId, 7000);
    assert.equal(invoiceDb.payments.size, 1);
    assert.equal(invoiceDb.payments.get("pay-existing").status, "pending");
    assert.equal(new URL(regenerated.paymentUrl).searchParams.get("InvId"), "7000");

    const repeated = await issueInvoice(input);
    assert.equal(repeated.paymentId, "pay-existing");
    assert.equal(invoiceDb.payments.size, 1);
  });

  test("concurrent invoice requests reuse one unique InvId", async () => {
    const { issueInvoice } = require("../lib/payments/invoice.ts");
    const schema = fs.readFileSync(path.join(__dirname, "..", "prisma", "schema.prisma"), "utf8");
    assert.match(schema, /@@unique\(\[provider, externalId\]\)/);
    invoiceDb.reset();
    const input = {
      orderId: "ord-7", orderNumber: "ПИП-000007", amount: 1_600_000,
      currency: "RUB", customerEmail: "c@test",
    };
    const [first, second] = await Promise.all([issueInvoice(input), issueInvoice(input)]);
    assert.equal(first.paymentId, second.paymentId);
    assert.equal(first.invId, 7000);
    assert.equal(second.invId, 7000);
    assert.equal(invoiceDb.payments.size, 1);
  });

  test("другая сумма — старый счёт закрывается, выставляется новый", async () => {
    const { issueInvoice } = require("../lib/payments/invoice.ts");
    invoiceDb.reset();
    invoiceDb.seed([{ id: "pay-1", status: "pending", amount: 1600000, externalId: "7000", paymentUrl: "https://pay/7000" }]);

    const changed = await issueInvoice({
      orderId: "ord-7", orderNumber: "ПИП-000007", amount: 1_750_000,
      currency: "RUB", customerEmail: "c@test",
    });

    assert.notEqual(changed.paymentId, "pay-1");
    assert.equal(invoiceDb.payments.get("pay-1").status, "failed", "старый счёт больше недействителен");
    assert.equal(invoiceDb.payments.get(changed.paymentId).amount, 1_750_000);
    // У клиента не должно быть двух ссылок на разные суммы.
    const pending = [...invoiceDb.payments.values()].filter((p) => p.status === "pending");
    assert.equal(pending.length, 1);
  });

  test("номер нового счёта не сталкивается с предыдущим", async () => {
    const { issueInvoice } = require("../lib/payments/invoice.ts");
    invoiceDb.reset();
    invoiceDb.seed([{ id: "pay-1", status: "pending", amount: 1600000, externalId: "7000", paymentUrl: "https://pay/7000" }]);

    const second = await issueInvoice({
      orderId: "ord-7", orderNumber: "ПИП-000007", amount: 1_900_000,
      currency: "RUB", customerEmail: "c@test",
    });

    assert.equal(second.invId, 7001, "вторая попытка — следующий номер счёта");
  });

  test("без ключей в разработке счёт получает демо-ссылку TestMerchant", async () => {
    const { issueInvoice } = require("../lib/payments/invoice.ts");
    const savedLogin = process.env.ROBOKASSA_MERCHANT_LOGIN;
    const savedPass1 = process.env.ROBOKASSA_PASSWORD1;
    delete process.env.ROBOKASSA_MERCHANT_LOGIN;
    delete process.env.ROBOKASSA_PASSWORD1;

    invoiceDb.reset();
    try {
      const result = await issueInvoice({
        orderId: "ord-7", orderNumber: "ПИП-000007", amount: 1_600_000,
        currency: "RUB", customerEmail: "c@test",
      });
      // Демо-режим из ТЗ: оплата проверяется без регистрации магазина.
      assert.equal(new URL(result.paymentUrl).searchParams.get("MerchantLogin"), "TestMerchant");
      assert.ok(result.paymentId, "счёт в базе остаётся: историю не теряем");
    } finally {
      process.env.ROBOKASSA_MERCHANT_LOGIN = savedLogin;
      process.env.ROBOKASSA_PASSWORD1 = savedPass1;
    }
  });

  test("в production без ключей счёт сохраняется, но без ссылки", async () => {
    const { issueInvoice } = require("../lib/payments/invoice.ts");
    const savedLogin = process.env.ROBOKASSA_MERCHANT_LOGIN;
    const savedPass1 = process.env.ROBOKASSA_PASSWORD1;
    const savedNodeEnv = process.env.NODE_ENV;
    delete process.env.ROBOKASSA_MERCHANT_LOGIN;
    delete process.env.ROBOKASSA_PASSWORD1;
    process.env.NODE_ENV = "production";
    delete process.env.ROBOKASSA_DEMO_MODE;

    invoiceDb.reset();
    try {
      const result = await issueInvoice({
        orderId: "ord-7", orderNumber: "ПИП-000007", amount: 1_600_000,
        currency: "RUB", customerEmail: "c@test",
      });
      assert.equal(result.paymentUrl, null, "ссылки нет — провайдер не настроен");
      assert.ok(result.paymentId, "счёт в базе остаётся: историю не теряем");
    } finally {
      process.env.ROBOKASSA_MERCHANT_LOGIN = savedLogin;
      process.env.ROBOKASSA_PASSWORD1 = savedPass1;
      if (savedNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = savedNodeEnv;
    }
  });
});

describe("выбор конфигурации (Settings → env → демо)", () => {
  test("настройки из БД имеют приоритет над env", () => {
    const { config, source } = robokassa.pickConfig({
      robokassaLogin: "db-shop",
      robokassaPassword1: "db-one",
      robokassaPassword2: "db-two",
      robokassaTestMode: "1",
    });
    assert.equal(source, "settings");
    assert.equal(config.merchantLogin, "db-shop");
    assert.equal(config.isTest, true);
  });

  test("частично заполненные настройки в БД не считаются настроенными", () => {
    // Полунастроенный магазин хуже ненастроенного: подпись не сойдётся.
    const { config, source } = robokassa.pickConfig({ robokassaLogin: "db-shop" });
    assert.equal(source, "env", "падаем на env, а не на полупустой набор");
    assert.equal(config.merchantLogin, LOGIN);
  });

  test("без БД и env в разработке выбирается демо", () => {
    delete process.env.ROBOKASSA_MERCHANT_LOGIN;
    const { config, source } = robokassa.pickConfig({});
    assert.equal(source, "demo");
    assert.equal(config.merchantLogin, "TestMerchant");
    assert.equal(robokassa.isDemoConfig(config), true);
  });

  test("generatePaymentLink и verifyPaymentHash — та же подпись, что и у основных функций", () => {
    const config = robokassa.readConfig();
    const link = robokassa.generatePaymentLink(
      { invId: 42, amountKopecks: 10000, description: "Счёт", extra: { OrderId: "ord-42" } },
      config,
    );
    const parsed = new URL(link);
    assert.equal(
      parsed.searchParams.get("SignatureValue"),
      md5(`${LOGIN}:100.00:42:${PASS1}:shp_OrderId=ord-42`),
    );

    const good = robokassa.resultSignature(config, "100.00", 42, { shp_OrderId: "ord-42" });
    assert.equal(
      robokassa.verifyPaymentHash(config, {
        outSum: "100.00", invId: 42, signatureValue: good, extra: { shp_OrderId: "ord-42" },
      }),
      true,
    );
    assert.equal(
      robokassa.verifyPaymentHash(config, {
        outSum: "1.00", invId: 42, signatureValue: good, extra: { shp_OrderId: "ord-42" },
      }),
      false,
      "подделка суммы не проходит",
    );
  });
});

describe("Result URL: целостность оплаты", () => {
  const { handleRobokassaResult } = require("../lib/payments/robokassa-result.ts");

  function seedAwaitingOrder(overrides = {}) {
    invoiceDb.orders.set("ord-7", {
      id: "ord-7",
      orderNumber: "ПИП-000007",
      number: "ПИП-000007",
      status: "awaiting_payment",
      total: 10000,
      ...overrides,
    });
  }

  function callback({ invId = "7000", outSum = "100.00", orderId = "ord-7", signedOrderId = orderId } = {}) {
    const config = robokassa.readConfig();
    const signature = robokassa.resultSignature(
      config,
      outSum,
      invId,
      signedOrderId ? { OrderId: signedOrderId } : {},
    );
    const body = new URLSearchParams({
      OutSum: outSum,
      InvId: String(invId),
      SignatureValue: signature,
    });
    if (orderId) body.set("shp_OrderId", orderId);
    return new Request("http://test.local/api/payment/result", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
  }

  beforeEach(() => {
    invoiceDb.reset();
    seedAwaitingOrder();
    invoiceDb.seed([{
      id: "pay-current",
      externalId: "7000",
      status: "pending",
      amount: 10000,
      paymentUrl: "https://pay.test/7000",
    }]);
  });

  test("валидный актуальный callback оплачивает заказ один раз", async () => {
    const first = await handleRobokassaResult(callback());
    assert.equal(await first.text(), "OK7000");
    assert.equal(invoiceDb.payments.get("pay-current").status, "succeeded");
    assert.equal(invoiceDb.orders.get("ord-7").status, "paid");
    assert.ok(invoiceDb.orders.get("ord-7").paidAt instanceof Date);
    assert.equal(invoiceDb.logs.length, 1);

    invoiceDb.orders.get("ord-7").status = "in_progress";
    const repeated = await handleRobokassaResult(callback());
    assert.equal(await repeated.text(), "OK7000");
    assert.equal(invoiceDb.orders.get("ord-7").status, "in_progress");
    assert.equal(invoiceDb.logs.length, 1, "повтор не создаёт вторую запись журнала");
  });

  test("старый pending-счёт не принимается после выставления нового", async () => {
    invoiceDb.seed([{
      id: "pay-new",
      externalId: "7001",
      status: "pending",
      amount: 10000,
      createdAt: new Date("2026-01-02T00:00:00Z"),
    }]);

    const response = await handleRobokassaResult(callback());
    assert.equal(await response.text(), "OK7000");
    assert.equal(invoiceDb.payments.get("pay-current").status, "pending");
    assert.equal(invoiceDb.orders.get("ord-7").status, "awaiting_payment");
    assert.equal(invoiceDb.logs.length, 0);
  });

  test("текущий счёт не принимается после изменения цены заказа", async () => {
    seedAwaitingOrder({ total: 12000 });
    const response = await handleRobokassaResult(callback());
    assert.equal(await response.text(), "OK7000");
    assert.equal(invoiceDb.payments.get("pay-current").status, "pending");
    assert.equal(invoiceDb.orders.get("ord-7").status, "awaiting_payment");
  });

  test("подписанный, но чужой Shp_OrderId не привязывает оплату", async () => {
    const response = await handleRobokassaResult(callback({ orderId: "ord-other" }));
    assert.equal(await response.text(), "OK7000");
    assert.equal(invoiceDb.payments.get("pay-current").status, "pending");
    assert.equal(invoiceDb.orders.get("ord-7").status, "awaiting_payment");
  });

  test("без Shp_OrderId уведомление не меняет данные", async () => {
    const response = await handleRobokassaResult(callback({ orderId: "", signedOrderId: "" }));
    assert.equal(await response.text(), "OK7000");
    assert.equal(invoiceDb.payments.get("pay-current").status, "pending");
  });

  test("закрытый заказ и не-pending счёт не принимают оплату", async () => {
    for (const status of ["completed", "cancelled", "refunded"]) {
      invoiceDb.reset();
      seedAwaitingOrder({ status });
      invoiceDb.seed([{ id: "pay-current", externalId: "7000", status: "pending", amount: 10000 }]);
      await handleRobokassaResult(callback());
      assert.equal(invoiceDb.payments.get("pay-current").status, "pending");
      assert.equal(invoiceDb.orders.get("ord-7").status, status);
    }

    invoiceDb.reset();
    seedAwaitingOrder();
    invoiceDb.seed([{ id: "pay-current", externalId: "7000", status: "failed", amount: 10000 }]);
    await handleRobokassaResult(callback());
    assert.equal(invoiceDb.payments.get("pay-current").status, "failed");
    assert.equal(invoiceDb.orders.get("ord-7").status, "awaiting_payment");
  });
});

describe("выставление счетов: актуальная попытка", () => {
  const { issueInvoice } = require("../lib/payments/invoice.ts");

  beforeEach(() => invoiceDb.reset());

  test("успешный платёж запрещает новый счёт при любом статусе заказа", async () => {
    invoiceDb.seed([{ id: "pay-success", status: "succeeded", amount: 10000, externalId: "7000" }]);
    const result = await issueInvoice({
      orderId: "ord-7", orderNumber: "ПИП-000007", amount: 10000,
      currency: "RUB", customerEmail: "client@test",
    });
    assert.equal(result, null);
    assert.equal(invoiceDb.payments.size, 1);
  });

  test("старый pending не воскресает, если последний счёт уже закрыт", async () => {
    invoiceDb.seed([
      { id: "pay-old", status: "pending", amount: 10000, externalId: "7000", paymentUrl: "https://pay.test/old", createdAt: new Date("2026-01-01") },
      { id: "pay-latest", status: "failed", amount: 10000, externalId: "7001", createdAt: new Date("2026-01-02") },
    ]);
    const result = await issueInvoice({
      orderId: "ord-7", orderNumber: "ПИП-000007", amount: 10000,
      currency: "RUB", customerEmail: "client@test",
    });
    assert.notEqual(result.paymentId, "pay-old");
    assert.equal(invoiceDb.payments.get("pay-old").status, "failed");
  });
});

describe("статистика заказов: деньги по успешным платежам", () => {
  const { getOrderStats } = require("../lib/admin-orders.ts");

  test("статус paid без платежа не создаёт выручку", async () => {
    invoiceDb.reset();
    for (const [id, status, total] of [
      ["ord-queue", "quote_requested", 0],
      ["ord-status-only", "paid", 99900],
      ["ord-paid", "completed", 12345],
      ["ord-stale", "awaiting_payment", 77700],
    ]) invoiceDb.orders.set(id, { id, status, total });
    invoiceDb.seed([
      { id: "pay-1", orderId: "ord-paid", status: "succeeded", amount: 20000 },
      { id: "pay-2", orderId: "ord-stale", status: "succeeded", amount: 10000 },
    ]);

    const stats = await getOrderStats();
    assert.equal(stats.queue, 1);
    assert.equal(stats.revenue, 30000);
    assert.equal(stats.paidCount, 2);
    assert.equal(stats.averageOrder, 15000);
  });
});
