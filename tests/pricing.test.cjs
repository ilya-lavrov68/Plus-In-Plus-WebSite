const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const ts = require("typescript");

// Тот же приём, что в остальных тестах: этот файл .cjs, а lib/pricing.ts — .ts.
require.extensions[".ts"] = (module, filename) =>
  module._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
    }).outputText,
    filename,
  );

const {
  calculateEstimate,
  defaultOptionFor,
  formatKopecks,
  estimateDriftPercent,
  showPublicPrice,
  pricePrefix,
} = require("../lib/pricing.ts");

/** Услуга без опций — базовая цена и всё. */
const plain = {
  basePrice: 35000,
  priceType: "fixed",
  groups: [],
};

/** Визитки: тираж (множитель), плотность (надбавка), ламинация (необязательная). */
const businessCards = {
  basePrice: 89000,
  priceType: "fixed",
  groups: [
    {
      id: "g-qty",
      name: "Тираж",
      required: true,
      sortOrder: 0,
      options: [
        { id: "o-50", label: "50 шт", priceDelta: 0, priceFactor: 1, isDefault: true, sortOrder: 0 },
        { id: "o-100", label: "100 шт", priceDelta: 0, priceFactor: 1.6, isDefault: false, sortOrder: 1 },
        { id: "o-500", label: "500 шт", priceDelta: 0, priceFactor: 5.5, isDefault: false, sortOrder: 2 },
      ],
    },
    {
      id: "g-density",
      name: "Плотность",
      required: true,
      sortOrder: 1,
      options: [
        { id: "o-300", label: "300 г/м²", priceDelta: 0, priceFactor: 1, isDefault: true, sortOrder: 0 },
        { id: "o-350", label: "350 г/м²", priceDelta: 15000, priceFactor: 1, isDefault: false, sortOrder: 1 },
      ],
    },
    {
      id: "g-lam",
      name: "Ламинация",
      required: false,
      sortOrder: 2,
      options: [
        { id: "o-none", label: "Без ламинации", priceDelta: 0, priceFactor: 1, isDefault: true, sortOrder: 0 },
        { id: "o-matte", label: "Матовая", priceDelta: 25000, priceFactor: 1, isDefault: false, sortOrder: 1 },
      ],
    },
  ],
};

test("услуга без опций считается по базовой цене", () => {
  const result = calculateEstimate(plain);
  assert.equal(result.estimatedAmount, 35000);
  assert.equal(result.complete, true);
});

test("порядок: сначала надбавки, потом множители", () => {
  // (89 000 + 15 000 за плотность) × 1.6 за тираж = 166 400.
  // Если бы множитель применили раньше, было бы 89 000 × 1.6 + 15 000 = 157 400.
  const result = calculateEstimate(businessCards, ["o-100", "o-350"]);
  assert.equal(result.estimatedAmount, 166400);
});

test("необязательная группа не влияет на цену, пока не выбрана", () => {
  const without = calculateEstimate(businessCards, ["o-50", "o-300"]);
  const withNone = calculateEstimate(businessCards, ["o-50", "o-300", "o-none"]);
  assert.equal(without.estimatedAmount, 89000);
  assert.equal(withNone.estimatedAmount, 89000);
});

test("выбор ламинации добавляет надбавку до умножения", () => {
  // (89 000 + 25 000) × 1 = 114 000
  const result = calculateEstimate(businessCards, ["o-50", "o-300", "o-matte"]);
  assert.equal(result.estimatedAmount, 114000);
});

test("обязательная группа без явного выбора берёт опцию по умолчанию", () => {
  const result = calculateEstimate(businessCards, []);
  assert.equal(result.estimatedAmount, 89000); // тираж ×1, плотность +0
  assert.equal(result.complete, false); // но цена ещё не окончательна
  assert.ok(result.missingGroupIds.includes("g-qty"));
  // Необязательная ламинация в пропущенные не попадает.
  assert.ok(!result.missingGroupIds.includes("g-lam"));
});

test("все обязательные группы выбраны → расчёт полный", () => {
  const result = calculateEstimate(businessCards, ["o-500", "o-350"]);
  assert.equal(result.complete, true);
  assert.deepEqual(result.missingGroupIds, []);
  // (89 000 + 15 000) × 5.5 = 572 000
  assert.equal(result.estimatedAmount, 572000);
});

test("цена не уходит в минус при большой скидке", () => {
  const discounted = {
    basePrice: 10000,
    priceType: "fixed",
    groups: [
      {
        id: "g1",
        name: "Скидка",
        required: false,
        sortOrder: 0,
        options: [{ id: "big", label: "−50 000 ₽", priceDelta: -50000, priceFactor: 1, isDefault: false, sortOrder: 0 }],
      },
    ],
  };
  assert.equal(calculateEstimate(discounted, ["big"]).estimatedAmount, 0);
});

test("сумма округлена до целых копеек, без хвоста от float", () => {
  const result = calculateEstimate(businessCards, ["o-100", "o-350"]);
  assert.equal(Number.isInteger(result.estimatedAmount), true);
  assert.equal(result.estimatedAmount, 166400);
});

test("разбивка объясняет, из чего сложилась сумма", () => {
  const result = calculateEstimate(businessCards, ["o-100", "o-350"]);
  const base = result.breakdown.find((line) => line.kind === "base");
  const delta = result.breakdown.find((line) => line.kind === "delta");
  const factor = result.breakdown.find((line) => line.kind === "factor");
  assert.equal(base.amount, 89000);
  assert.equal(delta.amount, 15000);
  assert.equal(delta.label, "350 г/м²");
  // Множитель ×1.6 добавил (89 000 + 15 000) × 0.6 = 62 400
  assert.equal(factor.amount, 62400);
});

test("defaultOptionFor: сначала isDefault, иначе первая по sortOrder", () => {
  const group = businessCards.groups[0];
  assert.equal(defaultOptionFor(group).id, "o-50");
  const noDefault = { ...group, options: group.options.map((o) => ({ ...o, isDefault: false })) };
  assert.equal(defaultOptionFor(noDefault).id, "o-50");
  assert.equal(defaultOptionFor({ ...group, options: [] }), undefined);
});

test("formatKopecks переводит копейки в рубли", () => {
  assert.match(formatKopecks(1560000), /15\s?600/);
  assert.match(formatKopecks(0), /0/);
});

test("estimateDriftPercent показывает расхождение расчёта с фактом", () => {
  // Менеджер поднял цену с 26 000 ₽ до 29 000 ₽
  assert.equal(estimateDriftPercent(2600000, 2900000), 12);
  // Дал скидку с 3 135 ₽ до 2 900 ₽
  assert.equal(estimateDriftPercent(313500, 290000), -7);
  // Расчёта нет — сравнить не с чем
  assert.equal(estimateDriftPercent(0, 290000), null);
});

test("цена типа quote не показывается на сайте", () => {
  assert.equal(showPublicPrice("quote"), false);
  assert.equal(showPublicPrice("fixed"), true);
  assert.equal(showPublicPrice("from"), true);
  assert.equal(pricePrefix("from"), "от ");
  assert.equal(pricePrefix("fixed"), "");
});
