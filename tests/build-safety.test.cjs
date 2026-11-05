// Сборка не должна читать файлы локальной базы.
//
// На Windows SQLite держит `*.db-shm` и `*.db-wal` залоченными, пока сервер
// работает. Пока Tailwind искал классы сам, он обходил весь каталог проекта,
// натыкался на эти файлы и ронял Turbopack сообщением «An unexpected Turbopack
// error occurred» (os error 33) — на случайной странице, чаще всего на /cart.
// Эти проверки фиксируют источники сканирования и защиту окружения.
const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("Tailwind не сканирует каталог проекта целиком", () => {
  // Комментарии в CSS содержат примеры синтаксиса — их не учитываем.
  const css = read("styles/globals.css").replace(/\/\*[\s\S]*?\*\//g, "");

  assert.match(
    css,
    /@import\s+"tailwindcss"\s+source\(none\)/,
    "автопоиск источников выключен: иначе сборщик читает базу и её залоченные -shm/-wal",
  );
  assert.doesNotMatch(css, /@import\s+"tailwindcss";/, "не осталось включённого автопоиска");

  const sources = [...css.matchAll(/@source\s+"([^"]+)"/g)].map((match) => match[1]);
  assert.ok(sources.includes("../app"), "сканируется app/");
  assert.ok(sources.includes("../components"), "сканируется components/");

  // Все каталоги с классами должны быть перечислены: иначе стили молча пропадут.
  for (const source of sources) {
    const dir = path.resolve(root, "styles", source);
    assert.ok(fs.existsSync(dir), `@source "${source}" указывает на несуществующий каталог`);
  }
});

test("файлы базы не попадают в git и в сканирование", () => {
  const ignore = read(".gitignore");
  for (const pattern of ["*.db", "*.db-shm", "*.db-wal", "*.db-journal", "/payload/"]) {
    assert.ok(ignore.includes(pattern), `.gitignore не игнорирует ${pattern}`);
  }
});

test("dev-сервер предупреждает о базе внутри проекта", () => {
  const { databaseFileInProject } = require("../scripts/dev.cjs");

  const inProject = databaseFileInProject("file:./payload/pip.db");
  assert.ok(inProject, "legacy-путь payload/pip.db распознаётся");
  assert.match(inProject.absolute, /payload[\\/]pip\.db$/);

  assert.ok(databaseFileInProject("file:./pip.db"), "база в корне проекта тоже проблема");

  assert.equal(databaseFileInProject("file:./data/pip.db"), null, "data/ — правильное место");
  assert.ok(
    databaseFileInProject("file:./data/../payload/pip.db"),
    "путь с обходом через data/.. тоже распознаётся",
  );
  assert.equal(databaseFileInProject("libsql://db.turso.io"), null, "удалённая база не переносится");
  assert.equal(databaseFileInProject("file:/var/lib/pip.db"), null, "абсолютный путь вне проекта");

  const dev = read("scripts/dev.cjs");
  assert.match(dev, /Turbopack error occurred/, "предупреждение объясняет последствия");
  assert.match(dev, /data\/pip\.db/, "предупреждение подсказывает правильный путь");
});

test("есть команда переноса базы в data/", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.scripts["db:relocate"], "node scripts/db-relocate.cjs");

  const script = read("scripts/db-relocate.cjs");
  assert.match(script, /data/, "целевой каталог — data/");
  assert.match(script, /уже существует/, "существующая база не перезаписывается молча");
  assert.match(script, /DATABASE_URL="file:\.\/data\/pip\.db"/, "печатает строку для .env");
});

test("Next не предупреждает про scroll-behavior", () => {
  for (const layout of ["app/(site)/layout.tsx", "app/(admin)/admin/layout.tsx"]) {
    assert.match(
      read(layout),
      /data-scroll-behavior="smooth"/,
      `${layout}: нужен data-scroll-behavior, иначе Next пишет предупреждение в консоль`,
    );
  }
});
