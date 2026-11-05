// `npm run db:relocate` — переносит локальную SQLite-базу в `data/`.
//
// Зачем: файлы `*.db-shm` и `*.db-wal` существуют, пока база открыта, и на
// Windows залочены работающим сервером. Любой инструмент, который обходит
// каталог проекта (Turbopack, Tailwind, антивирус, индексатор), может на них
// споткнуться: сборщик падает с «An unexpected Turbopack error occurred»
// (os error 33 — файл занят другим процессом).
//
// Скрипт копирует базу в `data/pip.db`, проверяет размер копии и печатает
// строку для `.env`. Исходный файл остаётся на месте: удалять данные без
// явного согласия разработчика нельзя.
const fs = require("node:fs");
const path = require("node:path");

const { loadDatabaseModule } = require("./lib/database-module.cjs");

const rootDir = path.join(__dirname, "..");
const targetDir = path.join(rootDir, "data");
const targetFile = path.join(targetDir, "pip.db");
const TARGET_URL = 'DATABASE_URL="file:./data/pip.db"';

/** Абсолютный путь локального файла базы или null для удалённой/отсутствующей. */
function localDatabasePath(url) {
  if (!url || !url.startsWith("file:")) return null;
  let raw = url.slice("file:".length);
  try {
    raw = decodeURIComponent(raw);
  } catch {
    // Некодируемая строка: работаем с исходным значением.
  }
  return /^\/|^[a-zA-Z]:[\\/]/.test(raw) ? path.resolve(raw) : path.resolve(rootDir, raw);
}

function siblings(file) {
  return [`${file}-wal`, `${file}-shm`].filter((candidate) => fs.existsSync(candidate));
}

function copyDatabase(source) {
  fs.mkdirSync(targetDir, { recursive: true });
  if (fs.existsSync(targetFile)) {
    // Не перезаписываем существующую базу молча: это чьи-то данные.
    throw new Error(
      `${path.relative(rootDir, targetFile)} уже существует. ` +
        "Перенесите базу вручную или удалите этот файл, если он не нужен.",
    );
  }
  fs.copyFileSync(source, targetFile);
  // Служебные файлы WAL/SHM принадлежат живому соединению — их не копируем:
  // при первом открытии SQLite создаст новые.
  return fs.statSync(targetFile).size;
}

function main() {
  const { resolveDatabaseConfig, describeDatabaseUrl } = loadDatabaseModule();
  const config = resolveDatabaseConfig({ allowDevelopmentFallback: true });
  if (!config) throw new Error("Set DATABASE_URL (см. .env.example).");
  if (config.remote) {
    console.log(`[db:relocate] База удалённая (${describeDatabaseUrl(config.url)}) — переносить нечего.`);
    return;
  }

  const source = localDatabasePath(config.url);
  if (!source || !fs.existsSync(source)) {
    console.error(`[db:relocate] Файл базы не найден: ${source ?? describeDatabaseUrl(config.url)}`);
    process.exitCode = 1;
    return;
  }

  if (source === targetFile) {
    console.log(`[db:relocate] База уже лежит в ${path.relative(rootDir, targetFile)} — ничего делать не нужно.`);
    console.log(`[db:relocate] Проверьте, что в .env указано: ${TARGET_URL}`);
    return;
  }

  const size = copyDatabase(source);
  const originalSize = fs.statSync(source).size;
  if (size !== originalSize) {
    fs.rmSync(targetFile, { force: true });
    throw new Error(`Копия получилась неполной (${size} из ${originalSize} байт) — файл удалён.`);
  }

  console.log(`[db:relocate] Скопировано: ${path.relative(rootDir, source) || source} → data/pip.db (${size} байт).`);
  console.log(`[db:relocate] Теперь поменяйте строку в .env: ${TARGET_URL}`);
  console.log(`[db:relocate] Исходная база не удалена: ${source}`);
  if (siblings(source).length > 0) {
    console.log("[db:relocate] Рядом остались служебные файлы (‑wal/‑shm) — после остановки сервера они не нужны.");
  }
  console.log("[db:relocate] Затем перезапустите npm run dev.");
}

try {
  main();
} catch (error) {
  // Без стектрейса: это пользовательская команда, а не падение программы.
  console.error(`[db:relocate] ${error.message}`);
  process.exitCode = 1;
}
