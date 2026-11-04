const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));

test("собственная админ-панель заменила админку Payload", () => {
  // Payload больше не отдаёт /admin: маршрут занят нашим приложением.
  assert.equal(exists(path.join("app", "(payload)", "admin")), false);
  assert.equal(exists(path.join("app", "(payload)", "custom.scss")), false);

  for (const page of ["page.tsx", "layout.tsx", "orders/page.tsx", "services/page.tsx", "products/page.tsx", "posts/page.tsx", "accounts/page.tsx", "activity/page.tsx"]) {
    assert.ok(exists(path.join("app", "(admin)", "admin", page)), page);
  }
});

test("доступ в админку закрыт дважды: proxy и серверная проверка роли", () => {
  const layout = read("app/(admin)/admin/layout.tsx");
  assert.match(layout, /requireStaff\(\)/);
  assert.match(layout, /redirect\("\/login\?next=\/admin"\)/);
  for (const page of ["accounts/page.tsx", "activity/page.tsx"]) {
    assert.match(read(`app/(admin)/admin/${page}`), /isAdmin/);
  }
  // Менеджер не видит справочник клиентов и журнал аудита в навигации.
  assert.match(layout, /staff\.isAdmin \? \[\{ href: "\/admin\/accounts"/);
});

test("админка читает и пишет собственными SQL-запросами, без CMS-слоя", () => {
  const queries = read("lib/admin-queries.ts");
  assert.match(queries, /queryPayloadRows/);
  for (const table of ["orders", "services", "products", "posts", "accounts", "activity_logs"]) {
    assert.ok(queries.includes(table), table);
  }
  // Статусы меняет отдельный модуль правил жизненного цикла, тоже на SQL.
  const guards = read("lib/order-guards.ts");
  assert.match(guards, /transitionOrder\(order\.id, order\.status/);
  assert.match(guards, /ORDER_TRANSITIONS/);
  // Все значения передаются параметрами, без склейки строк.
  assert.doesNotMatch(queries, /\$\{orderId\}|\$\{status\}|\$\{input\./);
});

test("смена статуса заказа требует ADMIN и валидирует жизненный цикл", () => {
  const action = read("app/(admin)/admin/orders/actions.ts");
  assert.match(action, /requireAdmin\(\)/);
  assert.match(action, /ORDER_STATUSES/);
  assert.match(action, /changeOrderStatus\(/);
  assert.match(action, /logAdminAction/);
  assert.match(action, /revalidatePath\("\/admin\/orders"\)/);
});

test("графики доступны: SVG с ролью img и текстовым описанием, без теней", () => {
  const charts = read("components/admin/charts.tsx");
  assert.match(charts, /role="img"/);
  assert.match(charts, /aria-label=/);
  assert.match(charts, /figcaption/);
  assert.doesNotMatch(charts, /(?:box|text|drop)-shadow/);
});

test("интерфейс админки без теней и с видимым focus, подписи RU и EN рядом", () => {
  const files = [
    "components/admin/admin-nav.tsx",
    "components/admin/stat-card.tsx",
    "components/ui/table.tsx",
    "app/(admin)/admin/page.tsx",
    "app/(admin)/admin/orders/page.tsx",
  ];
  for (const file of files) {
    assert.doesNotMatch(read(file), /(?:box|text|drop)-shadow/, file);
  }
  assert.match(read("components/admin/admin-nav.tsx"), /focus-visible:outline/);
  assert.match(read("components/admin/admin-nav.tsx"), /aria-current/);

  const labels = read("components/admin/labels.ts");
  assert.match(labels, /locale === "ru"/);
  assert.match(labels, /ru \? "[^"]+[а-яА-Я][^"]*" : "[^"]+"/);
});

test("обзор использует существующую аналитику и показывает заказы", () => {
  const page = read("app/(admin)/admin/page.tsx");
  for (const fn of ["getOrderStats", "getTrafficSummary", "getDailySeries", "getTopPages", "getTrafficSources", "getDeviceSplit", "getOrders", "getRevenueSeries"]) {
    assert.ok(page.includes(fn), fn);
  }
});
