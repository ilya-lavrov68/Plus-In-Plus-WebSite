// Fills the local development database with demo content so the shop, blog and
// admin tables have something to render.
//
//   npm run db:seed-demo
//
// Refuses to touch a remote (Turso) database: it deletes rows before inserting,
// so it is meant for the disposable local file only. Run `npm run db:push`
// first if the tables do not exist yet.
const path = require("node:path");

const rootDir = path.join(__dirname, "..");
const { loadDatabaseModule } = require("./lib/database-module.cjs");
const { resolveDatabaseConfig, describeDatabaseUrl } = loadDatabaseModule();
const config = resolveDatabaseConfig({
  env: { ...process.env, NODE_ENV: "development" },
  rootDir,
  allowDevelopmentFallback: true,
});

if (!config) {
  console.error("[seed-demo] No database target. Set TURSO_DATABASE_URL (see .env.example).");
  process.exit(1);
}
if (config.remote) {
  console.error(
    `[seed-demo] Refusing to seed a remote database (${describeDatabaseUrl(config.url)}).\n` +
      "This script deletes rows first and is only meant for the local dev file.",
  );
  process.exit(1);
}

const { createClient } = require("@libsql/client");
const bcrypt = require("bcryptjs");

const client = createClient({ url: config.url, authToken: config.authToken });
const now = Date.now();

// [title, slug, category, shortDesc, fullDesc, includes(json), shapes(json),
//  resultText, coverImage, isPublished, sortOrder,
//  basePrice(копейки), priceType, isOrderable]
const services = [
  ["Вывески и наружная реклама", "sign-design", "large", "Изготовление вывесок любого формата.", "Полный цикл: замер, дизайн-макет, производство и монтаж.", '["замер","макет","производство","монтаж"]', '["прямоугольник","фигурная","объёмная"]', "Готовая вывеска под ключ", "/uploads/services/sign.svg", 1, 1, 1_500_000, "from", 1],
  ["Печать визиток", "business-cards", "small", "Оперативная печать визиток.", "Печать от 50 штук, срок от одного дня.", '["дизайн","печать","резка"]', '["стандарт","евро","скруглённые углы"]', "Тираж визиток в руки", "/uploads/services/cards.svg", 1, 2, 89_000, "fixed", 1],
  ["Брендирование авто", "car-branding", "large", "Оклейка автомобилей плёнкой.", "Оклейка плёнкой любого класса, частичная или полная.", '["подбор плёнки","оклейка","гарантия"]', '["полная","частичная"]', "Брендированный автомобиль", "/uploads/services/car.svg", 1, 3, 2_000_000, "from", 1],
  ["Широкоформатная печать", "large-format", "large", "Печать баннеров и постеров.", "Широкоформатная печать до трёх метров.", '["макет","печать","люверсы"]', '["баннер","постер","сетка"]', "Готовое полотно", "/uploads/services/banner.svg", 1, 4, 45_000, "fixed", 1],
  ["Фото на документы", "photo-docs", "small", "Фотография на документы за пять минут.", "Моментальная печать, цифровая копия в подарок.", '["съёмка","печать","копия"]', '["30x40","35x45"]', "Комплект фото", "/uploads/services/photo.svg", 1, 5, 35_000, "fixed", 1],
  ["Лазерная гравировка", "laser-engraving", "small", "Гравировка на дереве, металле и акриле.", "Персональная гравировка подарков и табличек.", '["макет","гравировка"]', '["дерево","металл","акрил"]', "Готовое изделие", "/uploads/services/laser.svg", 0, 6, 120_000, "quote", 0],
];

// Группы опций по услугам. priceDelta — копейки, priceFactor — множитель.
// Цена: round((basePrice + Σ priceDelta) * Π priceFactor)
const optionGroups = {
  "business-cards": [
    ["Тираж", 1, [
      ["50 шт", 0, 1],
      ["100 шт", 0, 1.6],
      ["250 шт", 0, 3.2],
      ["500 шт", 0, 5.5],
    ]],
    ["Плотность", 1, [
      ["300 г/м²", 0, 1],
      ["350 г/м²", 15_000, 1],
    ]],
    ["Ламинация", 0, [
      ["Без ламинации", 0, 1],
      ["Матовая", 25_000, 1],
      ["Глянцевая", 25_000, 1],
      ["Софт-тач", 45_000, 1],
    ]],
  ],
  "sign-design": [
    ["Материал", 1, [
      ["ПВХ 5 мм", 0, 1],
      ["Акрил 5 мм", 400_000, 1],
      ["Композит", 650_000, 1],
    ]],
    ["Подсветка", 0, [
      ["Без подсветки", 0, 1],
      ["Светодиодная", 800_000, 1],
    ]],
  ],
  "large-format": [
    ["Размер", 1, [
      ["1 × 2 м", 0, 1],
      ["2 × 3 м", 0, 2.8],
      ["3 × 6 м", 0, 6.5],
    ]],
    ["Материал", 1, [
      ["Баннер 440 г/м²", 0, 1],
      ["Сетка", 10_000, 1],
      ["Фотобумага", 30_000, 1],
    ]],
  ],
};

// [title, slug, excerpt, content, coverImage, readTime, source, sourceUrl,
//  isFeatured, isPublished, publishedAt]
const posts = [
  ["Как выбрать материал для наружной вывески", "vyveska-material", "Разбираем, какие материалы выдерживают климат и как это влияет на бюджет.", "<p>Материалы для наружной рекламы: ПВХ, акрил, композит, нержавеющая сталь.</p>", "/uploads/blog/material.svg", 6, "manual", null, 1, 1, "2026-09-12"],
  ["Пять ошибок в макете визитки", "vizitka-oshibki", "Частые ошибки, из-за которых тираж приходится перепечатывать.", "<p>Разбор типовых ошибок в макетах визитных карточек.</p>", "/uploads/blog/cards.svg", 4, "manual", null, 1, 1, "2026-09-28"],
  ["Оклейка автомобиля: вопросы и ответы", "okleyka-avto", "Отвечаем на частые вопросы о сроке службы плёнки и уходе за ней.", "<p>Ответы на популярные вопросы об оклейке автомобилей.</p>", "/uploads/blog/car.svg", 5, "vk", "https://vk.com", 0, 1, "2026-10-02"],
  ["Тренды наружной рекламы 2026", "trendy-2026", "Что меняется в наружной рекламе и на что обратить внимание.", "<p>Обзор трендов наружной рекламы на 2026 год.</p>", "/uploads/blog/trends.svg", 7, "telegram", "https://t.me", 0, 1, "2026-10-08"],
  ["Черновик: гравировка на дереве", "gravirovka-derevo", "Черновик статьи о гравировке по дереву.", "<p>Черновик.</p>", "/uploads/blog/laser.svg", 3, "manual", null, 0, 0, null],
];

// [email, password, firstName, lastName, role, isBlocked]
const users = [
  ["admin@plusinplus.test", "Admin12345", "Demo", "Admin", "ADMIN", 0],
  // Менеджер: работает только с заявками, в управление сайтом (услуги, блог,
  // пользователи, настройки) войти не может.
  ["manager@plusinplus.test", "Manager12345", "Анна", "Морозова", "MANAGER", 0],
  ["user1@plusinplus.test", "User12345", "Иван", "Петров", "USER", 0],
  ["user2@plusinplus.test", "User12345", "Мария", "Сидорова", "USER", 1],
];

const count = async (table) => Number((await client.execute(`SELECT count(*) c FROM ${table}`)).rows[0].c);

(async () => {
  console.log(`[seed-demo] Database: ${describeDatabaseUrl(config.url)}`);

  await client.execute("DELETE FROM order_items");
  await client.execute("DELETE FROM payments");
  await client.execute("DELETE FROM orders");
  await client.execute("DELETE FROM cart_items");
  await client.execute("DELETE FROM service_options");
  await client.execute("DELETE FROM service_option_groups");
  await client.execute("DELETE FROM services");
  await client.execute("DELETE FROM posts");
  await client.execute("DELETE FROM users");

  for (const s of services) {
    const [title, slug, category, shortDesc, fullDesc, includes, shapes, resultText,
      coverImage, isPublished, sortOrder, basePrice, priceType, isOrderable] = s;
    // Поля перечислены явно, а не через spread: при spread легко ошибиться с
    // порядком (currency и isOrderable уже один раз поменялись местами),
    // а SQLite не проверяет соответствие типов при вставке.
    await client.execute({
      sql: "INSERT INTO services (id,title,slug,category,shortDesc,fullDesc,includes,shapes,resultText,coverImage,isPublished,sortOrder,basePrice,priceType,currency,isOrderable,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      args: [
        `svc-${slug}`, title, slug, category, shortDesc, fullDesc, includes, shapes,
        resultText, coverImage, isPublished, sortOrder, basePrice, priceType,
        "RUB", isOrderable, now, now,
      ],
    });
  }

  let groupCount = 0;
  let optionCount = 0;
  for (const [slug, groups] of Object.entries(optionGroups)) {
    for (const [name, required, options] of groups) {
      const groupId = `grp-${slug}-${groupCount++}`;
      await client.execute({
        sql: "INSERT INTO service_option_groups (id,serviceId,name,required,sortOrder) VALUES (?,?,?,?,?)",
        args: [groupId, `svc-${slug}`, name, required, groupCount],
      });
      for (const [label, priceDelta, priceFactor] of options) {
        await client.execute({
          sql: "INSERT INTO service_options (id,groupId,label,priceDelta,priceFactor,isDefault,sortOrder) VALUES (?,?,?,?,?,?,?)",
          args: [`opt-${optionCount++}`, groupId, label, priceDelta, priceFactor, 0, optionCount],
        });
      }
    }
  }

  for (const p of posts) {
    await client.execute({
      sql: "INSERT INTO posts (id,title,slug,excerpt,content,coverImage,readTime,source,sourceUrl,isFeatured,isPublished,publishedAt,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      args: [`post-${p[1]}`, p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7], p[8], p[9], p[10] ? Date.parse(p[10]) : null, now, now],
    });
  }

  for (const [email, password, firstName, lastName, role, isBlocked] of users) {
    const passwordHash = await bcrypt.hash(password, 12);
    await client.execute({
      sql: "INSERT INTO users (id,email,passwordHash,firstName,lastName,role,isBlocked,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?)",
      args: [`usr-${email.split("@")[0]}`, email, passwordHash, firstName, lastName, role, isBlocked, now, now],
    });
  }

  // ── Демо-заказы: без них панель дохода пуста ──────────────────────────────
  // Разные статусы и разные даты, чтобы графики и фильтры было чем наполнить.
  // [number, клиент, статус, расчёт из опций, согласованная цена,
  //  пожелание клиента, daysAgo, оплачен?, менеджер?, комментарий менеджера,
  //  slug услуги, количество]
  const orderRows = [
    ["ПИП-000001", "user1@plusinplus.test", "completed", 142_400, 142_400, "Визитки, матовая ламинация", 38, true, "admin@plusinplus.test", null, "business-cards", 1],
    // Менеджер поднял цену: клиент попросил срочный тираж
    ["ПИП-000002", "user1@plusinplus.test", "completed", 2_600_000, 2_900_000, "Вывеска, акрил, с подсветкой", 21, true, "admin@plusinplus.test", "Срочный заказ, доплата за ночную смену", "sign-design", 1],
    ["ПИП-000003", "user2@plusinplus.test", "in_progress", 89_000, 89_000, "Визитки 100 шт", 12, true, "admin@plusinplus.test", null, "business-cards", 1],
    // Менеджер дал скидку: постоянный клиент
    ["ПИП-000004", "user1@plusinplus.test", "awaiting_payment", 313_500, 290_000, "Баннер 2×3 м, сетка", 5, false, "admin@plusinplus.test", "Скидка постоянному клиенту 23 500 ₽", "large-format", 1],
    ["ПИП-000005", "user2@plusinplus.test", "cancelled", 45_000, 45_000, "Отменён клиентом", 3, false, null, "Клиент передумал", "large-format", 1],
    ["ПИП-000006", "user1@plusinplus.test", "paid", 126_000, 126_000, "Фото на документы ×3", 1, true, "admin@plusinplus.test", null, "photo-docs", 3],
    // Свежие заявки — то, что менеджер видит в очереди
    ["ПИП-000007", "user2@plusinplus.test", "quote_requested", 1_560_000, 0, "Нужна вывеска на фасад, 3×1.5 м", 0, false, null, null, "sign-design", 1],
    ["ПИП-000008", "user1@plusinplus.test", "negotiating", 574_000, 0, "Визитки 500 шт, нужен макет", 0, false, "admin@plusinplus.test", "Ждём макет от клиента", "business-cards", 1],
  ];

  for (const [number, email, status, estimated, agreed, note, daysAgo, paid, managerEmail, managerNote, slug, quantity] of orderRows) {
    const createdMs = now - daysAgo * 86_400_000;
    const paidMs = paid ? createdMs + 3_600_000 : null;
    const orderId = `ord-${number.slice(-6)}`;
    const userId = `usr-${email.split("@")[0]}`;
    const managerId = managerEmail ? `usr-${managerEmail.split("@")[0]}` : null;
    // Цена зафиксирована, когда менеджер её выставил — то есть для всех
    // статусов начиная с awaiting_payment.
    const priced = ["awaiting_payment", "paid", "in_progress", "completed"].includes(status);
    const priceAgreedAt = priced ? createdMs + 1_800_000 : null;

    await client.execute({
      sql: "INSERT INTO orders (id,number,userId,status,estimatedAmount,subtotal,discount,total,currency,customerNote,managerNote,managerId,priceAgreedAt,createdAt,updatedAt,paidAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      args: [orderId, number, userId, status, estimated, agreed, 0, agreed, "RUB", note, managerNote, managerId, priceAgreedAt, createdMs, createdMs, paidMs],
    });

    const unitAgreed = agreed > 0 ? Math.round(agreed / quantity) : 0;
    await client.execute({
      sql: "INSERT INTO order_items (id,orderId,serviceId,title,quantity,estimatedUnitPrice,unitPrice,totalPrice,optionsSnapshot) VALUES (?,?,?,?,?,?,?,?,?)",
      args: [
        `oi-${number.slice(-6)}`, orderId, `svc-${slug}`,
        services.find((s) => s[1] === slug)[0],
        quantity, Math.round(estimated / quantity), unitAgreed, agreed,
        '[{"group":"demo","option":"demo"}]',
      ],
    });

    // Счёт создаётся только когда цена согласована.
    if (priced) {
      await client.execute({
        sql: "INSERT INTO payments (id,orderId,provider,externalId,status,amount,currency,paymentUrl,createdAt,updatedAt,paidAt) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        args: [
          `pay-${number.slice(-6)}`, orderId, "robokassa", number.slice(-6),
          paid ? "succeeded" : "pending",
          agreed, "RUB", `https://auth.robokassa.ru/Merchant/Index.aspx?InvId=${number.slice(-6)}`,
          priceAgreedAt ?? createdMs, priceAgreedAt ?? createdMs, paidMs,
        ],
      });
    }
  }

  console.log(`[seed-demo] Услуг: ${await count("services")} (5 опубликовано) | Постов: ${await count("posts")} (4 опубликовано) | Пользователей: ${await count("users")}`);
  console.log(`[seed-demo] Групп опций: ${await count("service_option_groups")} | Опций: ${await count("service_options")}`);
  console.log(`[seed-demo] Заказов: ${await count("orders")} | Позиций: ${await count("order_items")} | Платежей: ${await count("payments")}`);
  console.log("\n  АДМИН:  admin@plusinplus.test / Admin12345");
  console.log("  ЮЗЕРЫ:  user1@plusinplus.test / User12345 (активный)");
  console.log("          user2@plusinplus.test / User12345 (заблокированный)");
})();
