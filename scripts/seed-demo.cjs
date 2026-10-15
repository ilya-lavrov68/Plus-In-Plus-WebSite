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
//  resultText, coverImage, isPublished, sortOrder]
const services = [
  ["Вывески и наружная реклама", "sign-design", "large", "Изготовление вывесок любого формата.", "Полный цикл: замер, дизайн-макет, производство и монтаж.", '["замер","макет","производство","монтаж"]', '["прямоугольник","фигурная","объёмная"]', "Готовая вывеска под ключ", "/uploads/services/sign.svg", 1, 1],
  ["Печать визиток", "business-cards", "small", "Оперативная печать визиток.", "Печать от 50 штук, срок от одного дня.", '["дизайн","печать","резка"]', '["стандарт","евро","скруглённые углы"]', "Тираж визиток в руки", "/uploads/services/cards.svg", 1, 2],
  ["Брендирование авто", "car-branding", "large", "Оклейка автомобилей плёнкой.", "Оклейка плёнкой любого класса, частичная или полная.", '["подбор плёнки","оклейка","гарантия"]', '["полная","частичная"]', "Брендированный автомобиль", "/uploads/services/car.svg", 1, 3],
  ["Широкоформатная печать", "large-format", "large", "Печать баннеров и постеров.", "Широкоформатная печать до трёх метров.", '["макет","печать","люверсы"]', '["баннер","постер","сетка"]', "Готовое полотно", "/uploads/services/banner.svg", 1, 4],
  ["Фото на документы", "photo-docs", "small", "Фотография на документы за пять минут.", "Моментальная печать, цифровая копия в подарок.", '["съёмка","печать","копия"]', '["30x40","35x45"]', "Комплект фото", "/uploads/services/photo.svg", 1, 5],
  ["Лазерная гравировка", "laser-engraving", "small", "Гравировка на дереве, металле и акриле.", "Персональная гравировка подарков и табличек.", '["макет","гравировка"]', '["дерево","металл","акрил"]', "Готовое изделие", "/uploads/services/laser.svg", 0, 6],
];

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
  ["user1@plusinplus.test", "User12345", "Иван", "Петров", "USER", 0],
  ["user2@plusinplus.test", "User12345", "Мария", "Сидорова", "USER", 1],
];

const count = async (table) => Number((await client.execute(`SELECT count(*) c FROM ${table}`)).rows[0].c);

(async () => {
  console.log(`[seed-demo] Database: ${describeDatabaseUrl(config.url)}`);

  await client.execute("DELETE FROM services");
  await client.execute("DELETE FROM posts");
  await client.execute("DELETE FROM users");

  for (const s of services) {
    await client.execute({
      sql: "INSERT INTO services (id,title,slug,category,shortDesc,fullDesc,includes,shapes,resultText,coverImage,isPublished,sortOrder,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      args: [`svc-${s[1]}`, ...s, now, now],
    });
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

  console.log(`[seed-demo] Услуг: ${await count("services")} (5 опубликовано) | Постов: ${await count("posts")} (4 опубликовано) | Пользователей: ${await count("users")}`);
  console.log("\n  АДМИН:  admin@plusinplus.test / Admin12345");
  console.log("  ЮЗЕРЫ:  user1@plusinplus.test / User12345 (активный)");
  console.log("          user2@plusinplus.test / User12345 (заблокированный)");
})();
