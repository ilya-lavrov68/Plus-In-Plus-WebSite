const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

/**
 * Финансовые графики админки: сначала математика (свечи, просадка, корзины),
 * потом контракты разметки — направление свечи читается формой, деньги
 * переводятся из копеек один раз, диапазон грузится серверным действием.
 */

for (const extension of [".ts", ".tsx"]) {
  require.extensions[extension] = (module, filename) =>
    module._compile(
      ts.transpileModule(fs.readFileSync(filename, "utf8"), {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          jsx: ts.JsxEmit.ReactJSX,
          esModuleInterop: true,
          target: ts.ScriptTarget.ES2022,
        },
      }).outputText,
      filename,
    );
}

const root = path.join(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const math = require(path.join(root, "lib/finance-math.ts"));
const money = require(path.join(root, "lib/admin-money.ts"));

const day = (offset, value, start = "2026-08-01") => {
  const date = new Date(`${start}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  const key = date.toISOString().slice(0, 10);
  return { key, label: `${key.slice(8, 10)}.${key.slice(5, 7)}`, value };
};

test("свечи: тело строится по дневной выручке внутри отрезка", () => {
  const daily = [day(0, 100), day(1, 300), day(2, 0), day(3, 200), day(4, 500), day(5, 400), day(6, 600), day(7, 0)];
  const candles = math.buildRevenueCandles(daily, 4);

  assert.equal(candles.length, 2, "два отрезка по четыре дня");
  const [first, second] = candles;
  assert.equal(first.open, 100, "открытие — первый день с выручкой");
  assert.equal(first.close, 200, "закрытие — последний день с выручкой");
  assert.equal(first.high, 300);
  assert.equal(first.low, 100);
  assert.equal(first.volume, 600, "объём — вся выручка отрезка, включая пустой день");
  assert.equal(first.activeDays, 3, "пустые дни не попадают в тело свечи");

  assert.equal(second.open, 500);
  assert.equal(second.close, 600);
  assert.equal(second.activeDays, 3);
});

test("свечи: отрезок без выручки не превращается в нулевую свечу", () => {
  const daily = [day(0, 0), day(1, 0), day(2, 0), day(3, 0), day(4, 700), day(5, 900)];
  const candles = math.buildRevenueCandles(daily, 4);
  assert.equal(candles.length, 1, "пустой отрезок пропущен");
  assert.equal(candles[0].key, daily[4].key, "свеча начинается с первого дня отрезка");
  assert.equal(candles[0].open, 700);
});

test("свечи: длина отрезка растёт вместе с диапазоном", () => {
  const finance = read("lib/admin-finance.ts");
  assert.match(finance, /if \(days <= 31\) return 4;/);
  assert.match(finance, /if \(days <= 92\) return 7;/);
  assert.match(finance, /if \(days <= 200\) return 14;/);
  assert.match(finance, /return 30;/);
});

test("портфель: просадка считается от бегущего пика, а не от базы", () => {
  const daily = [day(0, 100), day(1, 100), day(2, 100), day(3, 50), day(4, 20), day(5, 120), day(6, 120)];
  const series = math.buildPortfolio(daily, 3);

  assert.equal(series.window, 3);
  assert.equal(series.points.length, 7);
  // Окно 3 дня: 100+100+100 = 300 на третьем дне — пик периода.
  assert.equal(series.points[2].smoothed, 300);
  assert.equal(series.points[2].peak, 300);
  assert.equal(series.points[2].drawdownPct, 0);
  // Дальше окно проседает: 100+100+50 = 250 → -16.7% от пика.
  assert.equal(series.points[3].smoothed, 250);
  assert.equal(series.points[3].drawdown, 50);
  assert.equal(series.points[3].drawdownPct, -16.7);
  // Окно 50 + 20 + 120 = 190, затем 20 + 120 + 120 = 260: пик 300 не обновлён.
  assert.equal(series.points[5].smoothed, 190);
  assert.equal(series.points[6].smoothed, 260, "восстановление идёт, но до пика не доходит");
  assert.equal(series.points[6].peak, 300);
  // Самый глубокий провал — 100 + 50 + 20 = 170 против пика 300: −43.3%.
  assert.equal(series.points[4].smoothed, 170);
  assert.equal(series.points[4].drawdownPct, -43.3);
  assert.equal(series.maxDrawdownPct, -43.3);
  assert.equal(series.total, 610);
});

test("портфель: база — средний темп, дельта считается к ней", () => {
  const daily = [day(0, 100), day(1, 200), day(2, 300), day(3, 400)];
  const series = math.buildPortfolio(daily, 1);
  assert.equal(series.points[0].basis, 100);
  assert.equal(series.points[3].basis, 250, "среднее по всем дням периода");
  assert.equal(series.deltaPct, 60, "(400 − 250) / 250");
});

test("портфель: пустой период не делит на ноль", () => {
  const series = math.buildPortfolio([], 7);
  assert.deepEqual(series.points, []);
  assert.equal(series.total, 0);
  assert.equal(series.deltaPct, 0);
  assert.equal(series.maxDrawdownPct, 0);
});

test("гистограмма: корзины на красивых границах и открытый хвост", () => {
  const histogram = math.buildHistogram([500, 1200, 1400, 3000, 9000, 45000], 5);
  assert.equal(histogram.samples, 6);
  assert.equal(histogram.max, 45000, "максимум попадает в открытую корзину");
  assert.equal(histogram.bins.reduce((sum, bin) => sum + bin.count, 0), 6, "ни один заказ не потерян");
  assert.equal(histogram.bins[histogram.bins.length - 1].label.endsWith("+"), true);
  assert.equal(histogram.p50, 2200, "медиана — среднее двух средних значений");
  assert.equal(histogram.p95, 36000);
  assert.equal(math.buildHistogram([]).samples, 0);
});

test("структура выручки: топ-N плюс «Другое», ряды выровнены по дням", () => {
  const rows = [
    { date: "2026-08-01", bucket: "large", amount: 100 },
    { date: "2026-08-01", bucket: "small", amount: 60 },
    { date: "2026-08-02", bucket: "large", amount: 200 },
    { date: "2026-08-02", bucket: "print", amount: 10 },
    { date: "2026-08-02", bucket: "web", amount: 5 },
  ];
  const series = math.buildCategorySeries(rows, 1);
  assert.deepEqual(series.dates, ["2026-08-01", "2026-08-02"]);
  assert.equal(series.series[0].key, "large");
  assert.deepEqual(series.series[0].values, [100, 200]);
  assert.equal(series.series[1].key, "__other");
  assert.deepEqual(series.series[1].values, [60, 15], "остальные категории складываются");
  assert.equal(series.series[1].total, 75);
});

test("плотный ряд по дням дополняет пропуски нулями", () => {
  const now = new Date("2026-08-10T12:00:00Z").getTime();
  const series = math.fillDailySeries([{ date: "2026-08-08", value: 500 }], 3, now);
  assert.equal(series.length, 3);
  assert.deepEqual(
    series.map((point) => point.value),
    [500, 0, 0],
  );
  assert.equal(series[2].key, "2026-08-10");
});

test("деньги: копейки и рубли не путаются", () => {
  assert.equal(money.toRubles(150000), 1500);
  assert.equal(money.toRubles(149999), 1500);
  assert.equal(money.toKopecks(1500), 150000);
  assert.equal(money.toRubles(Number.NaN), 0);

  const queries = read("lib/admin-queries.ts");
  assert.match(queries, /total: toRubles\(num\(row\.total\)\)/, "сумма заказа переводится один раз");
  assert.match(queries, /revenue: toRubles\(num\(row\.revenue\)\)/, "выручка периода — в рублях");

  const analytics = read("lib/admin-analytics.ts");
  assert.match(analytics, /const revenue = toRubles\(num\(row\.revenue\)\)/, "платежи тоже в копейках");

  const finance = read("lib/admin-finance.ts");
  assert.equal(finance.match(/value: toRubles\(toNumber\(row\.value\)\)/g).length, 2, "свечи и портфель — в рублях");
  assert.match(finance, /buildHistogram\(rows\.map\(\(row\) => toRubles\(toNumber\(row\.total\)\)\)\)/);
});

test("свечи читаются формой: рост полый, падение залито", () => {
  const candles = read("components/admin/finance/candles.tsx");
  assert.match(candles, /fill=\{rising \? "var\(--md-surface-container-low\)" : "var\(--md-outline\)"\}/);
  assert.match(candles, /stroke=\{rising \? "var\(--md-on-surface\)" : "var\(--md-outline\)"\}/);
  assert.match(candles, /aria-label=\{summary\}/, "график описан текстом");
  assert.match(candles, /aria-live="polite"/, "курсор по клавиатуре озвучивается");
  assert.match(candles, /<ChartDataTable/, "точные значения доступны таблицей");
});

test("графики не используют тени и внешние библиотеки", () => {
  const files = fs
    .readdirSync(path.join(root, "components/admin/finance"))
    .filter((name) => name.endsWith(".tsx"));
  for (const name of files) {
    const source = read(path.join("components/admin/finance", name));
    assert.equal(/shadow-|drop-shadow/.test(source), false, `${name}: тени запрещены`);
    assert.equal(/from "(recharts|chart\.js|d3|@nivo)/.test(source), false, `${name}: только свой SVG`);
  }
});

test("диапазон графиков грузится серверным действием с проверкой прав", () => {
  const action = read("app/(admin)/admin/finance/chart-data.ts");
  assert.match(action, /^"use server";/);
  assert.equal(
    /(insert into|update |delete from)/i.test(action),
    false,
    "модуль только читает: мутации панели живут в других разделах",
  );
  assert.match(action, /await requireStaff\(\)/, "без staff данные не отдаются");
  assert.match(action, /!isFinanceKind\(kind\) \|\| !isFinanceRange\(range\)/, "входные значения проверяются");

  const panel = read("components/admin/finance/panel.tsx");
  assert.match(panel, /useTransition\(\)/, "переключение не блокирует интерфейс");
  assert.match(panel, /aria-busy/, "состояние загрузки объявлено");

  const page = read("app/(admin)/admin/page.tsx");
  assert.match(page, /<Suspense/, "блоки графиков стримятся");
  assert.match(page, /<CandlesSection/, "свечи на странице обзора");
  assert.match(page, /<PortfolioSection/, "портфель на странице обзора");
  assert.match(page, /<ChecksSection/, "распределение чеков на странице обзора");
  assert.match(page, /<CategoriesSection/, "структура выручки на странице обзора");
});

test("подписи графиков есть в обоих языках", () => {
  const labels = require(path.join(root, "components/admin/labels.ts"));
  const ru = labels.adminLabels("ru").finance;
  const en = labels.adminLabels("en").finance;

  const keys = (value, prefix = "") =>
    Object.entries(value).flatMap(([key, item]) =>
      item && typeof item === "object" && !Array.isArray(item) ? keys(item, `${prefix}${key}.`) : [`${prefix}${key}`],
    );

  assert.deepEqual(keys(ru).sort(), keys(en).sort(), "наборы ключей совпадают");

  const strings = (value) =>
    Object.values(value).flatMap((item) =>
      typeof item === "string" ? [item] : Array.isArray(item) ? item.map((entry) => entry.label) : strings(item),
    );
  for (const item of strings(en)) assert.ok(item.trim().length > 0, "английская подпись не пустая");
  for (const item of strings(ru)) assert.ok(item.trim().length > 0, "русская подпись не пустая");
  assert.equal(/[\u{1F300}-\u{1FAFF}]/u.test(JSON.stringify(ru)), false, "эмодзи в подписях нет");
});
