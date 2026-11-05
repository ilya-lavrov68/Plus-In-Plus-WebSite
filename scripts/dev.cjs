// Запуск Next.js после проверки зависимостей и read-only диагностики Payload БД.
const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { loadDatabaseModule } = require("./lib/database-module.cjs");
const { checkSchema } = require("./lib/schema-check.cjs");
const { checkDependencies, formatReport, needsInstall, npmCommand } = require("./lib/dependency-check.cjs");

const rootDir = path.join(__dirname, "..");
const nextBin =
  process.env.PIP_NEXT_BIN ?? path.join(rootDir, "node_modules", "next", "dist", "bin", "next");

function runNpmInstall() {
  console.log("[dev] Running npm install to repair the install…");
  const install = spawnSync(npmCommand(), ["install", "--no-audit", "--no-fund"], {
    cwd: rootDir,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  return install.status === 0;
}

/**
 * `next build` и `next dev` делят каталог `.next`. Если dev стартует поверх
 * прод-артефактов (`.next/BUILD_ID`), Turbopack падает с «An unexpected
 * Turbopack error occurred», а браузер получает битые чанки. Поэтому перед
 * запуском dev прод-кэш удаляется — dev собирает собственный.
 */
function resetProductionBuildCache() {
  const nextDir = path.join(rootDir, ".next");
  if (!fs.existsSync(path.join(nextDir, "BUILD_ID"))) return;
  if (process.env.PIP_KEEP_BUILD_CACHE === "1") {
    console.warn("[dev] .next holds a production build; Turbopack may fail. Delete .next or unset PIP_KEEP_BUILD_CACHE.");
    return;
  }
  console.log("[dev] Production build found in .next — removing it before dev starts.");
  fs.rmSync(nextDir, { recursive: true, force: true });
}

/**
 * Жёстко завершённый dev-процесс (SIGKILL, падение контейнера) оставляет в
 * `.next/dev` Turbopack-кэш и lock-файл. Следующий запуск поднимает сервер с
 * повреждённым кэшем и отдаёт на отдельных страницах «An unexpected Turbopack
 * error occurred». Поэтому устаревший dev-кэш удаляется: живой сервер узнаётся
 * по pid из lock-файла. Принудительная очистка — PIP_FRESH_DEV_CACHE=1.
 */
function resetStaleDevCache() {
  const devDir = path.join(rootDir, ".next", "dev");
  if (!fs.existsSync(devDir)) return;

  if (process.env.PIP_FRESH_DEV_CACHE === "1") {
    console.log("[dev] PIP_FRESH_DEV_CACHE=1 — clearing .next/dev.");
    fs.rmSync(devDir, { recursive: true, force: true });
    return;
  }

  const lockPath = path.join(devDir, "lock");
  if (!fs.existsSync(lockPath)) return;

  let pid = null;
  try {
    pid = JSON.parse(fs.readFileSync(lockPath, "utf8")).pid;
  } catch {
    pid = null;
  }

  const alive =
    typeof pid === "number" && pid > 0 ? isProcessAlive(pid) && isDevServerProcess(pid) : false;
  if (alive) {
    console.warn("[dev] Another dev server looks alive (lock pid " + pid + "); keeping .next/dev.");
    return;
  }
  console.log("[dev] Stale dev cache found — clearing .next/dev before start.");
  fs.rmSync(devDir, { recursive: true, force: true });
}

/**
 * Строки, которыми Turbopack сообщает о внутренней ошибке. Такое сообщение
 * видит пользователь как «An unexpected Turbopack error occurred»; причиной
 * обычно оказывается кэш, оставшийся от убитого процесса, или прод-сборка,
 * попавшая в `.next` во время работы dev-сервера.
 */
const TURBOPACK_FAILURE =
  /TurbopackInternalError|An unexpected Turbopack error occurred|Next\.js package not found/i;

/**
 * Нехватка памяти — вторая причина, по которой dev-сервер завершается сам:
 * Turbopack собирает страницы в том же процессе, и на тяжёлых маршрутах
 * (`/profile`, `/services`, админка) Node упирается в лимит кучи и печатает
 * «JavaScript heap out of memory»/«Reached heap limit».
 */
const OUT_OF_MEMORY =
  /heap out of memory|Reached heap limit|Allocation failed|FATAL ERROR: \w+ Allocation failed/i;

const MAX_RESTARTS = 2;
/** Падения самого dev-сервера: поднимаем чаще, чем внутренние ошибки Turbopack. */
const MAX_CRASH_RESTARTS = 3;
/** Сколько памяти просить у Node после падения по OOM. */
const HEAP_LIMIT_MB = 4096;
/** После стольких миллисекунд работы счётчик падений обнуляется. */
const STABLE_RUN_MS = 60_000;

/**
 * pid из lock-файла мог достаться другому процессу (перезапуск контейнера
 * переиспользует номера). Сверяем командную строку: кэш принадлежит живому
 * dev-серверу только тогда, когда это действительно `next dev`.
 */
function isDevServerProcess(pid) {
  try {
    const command = fs.readFileSync(`/proc/${pid}/cmdline`, "utf8");
    return /next/.test(command) && /dev/.test(command);
  } catch {
    // Не Linux или нет доступа: считаем, что сервер жив, и кэш не трогаем.
    return true;
  }
}

function clearDevCache() {
  const nextDir = path.join(rootDir, ".next");
  for (const relative of ["dev", "cache"]) {
    const target = path.join(nextDir, relative);
    if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
  }
}

/**
 * Поднимает лимит кучи в NODE_OPTIONS, не затирая остальные флаги. Уже заданный
 * больший лимит остаётся как есть: чужой выбор памяти не перебиваем.
 */
function withLargerHeap(nodeOptions = "") {
  const options = nodeOptions.trim();
  const match = options.match(/--max-old-space-size=(\d+)/);
  if (match) {
    if (Number(match[1]) >= HEAP_LIMIT_MB) return options;
    return options.replace(/--max-old-space-size=\d+/, `--max-old-space-size=${HEAP_LIMIT_MB}`);
  }
  return `${options} --max-old-space-size=${HEAP_LIMIT_MB}`.trim();
}

/**
 * Локальная база внутри проекта — источник паники Turbopack на Windows.
 *
 * SQLite держит `*.db-shm` и `*.db-wal` открытыми и залоченными, пока сервер
 * работает. Сборщик CSS обходит каталог проекта, пытается прочитать такой файл
 * и получает `os error 33` («файл занят другим процессом»); Turbopack на этом
 * падает с «An unexpected Turbopack error occurred». Базу держим в `data/`,
 * куда не смотрит ни один сборщик, — но предупредим, если она оказалась в
 * проекте (типичный случай — legacy-путь `payload/pip.db` из старой версии).
 */
function databaseFileInProject(url) {
  if (!url || !url.startsWith("file:")) return null;

  // Конфиг отдаёт не только `file:./data/x.db`, но и абсолютный `file:///…`,
  // поэтому путь сначала приводим к абсолютному, а потом проверяем вложение.
  let raw = url.slice("file:".length).replace(/^\/\//, "/");
  try {
    raw = decodeURIComponent(raw);
  } catch {
    // Некодируемая строка: работаем с исходным значением.
  }
  if (/^\/[a-zA-Z]:[\\/]/.test(raw)) raw = raw.slice(1); // Windows: /D:/path
  const absolute = path.resolve(raw);

  const projectDir = path.resolve(rootDir) + path.sep;
  if (!absolute.startsWith(projectDir)) return null;
  if (absolute.startsWith(path.join(path.resolve(rootDir), "data") + path.sep)) return null;
  return { absolute, url };
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error && error.code === "EPERM";
  }
}

function ensureInstall() {
  const autoInstall = process.env.PIP_NO_AUTO_INSTALL !== "1";
  let result = checkDependencies();
  let report = formatReport(result);
  if (report.length === 0 && fs.existsSync(nextBin)) return;
  for (const line of report) console.warn(line);
  if (!autoInstall || !needsInstall(result)) {
    if (!fs.existsSync(nextBin)) {
      console.error("[dev] Next.js is not installed — run npm install first.");
      process.exit(1);
    }
    return;
  }
  if (!runNpmInstall()) console.warn("[dev] npm install reported an error.");
  result = checkDependencies();
  report = formatReport(result);
  for (const line of report) console.warn(line);
  if (!fs.existsSync(nextBin)) process.exit(1);
}

async function main() {
  ensureInstall();
  resetProductionBuildCache();
  resetStaleDevCache();
  const env = { ...process.env };
  try {
    const { resolveDatabaseConfig, describeDatabaseUrl, unsupportedDatabaseUrlMessage } = loadDatabaseModule();
    const warning = unsupportedDatabaseUrlMessage();
    if (warning) console.warn(`[dev] ${warning}`);
    const config = resolveDatabaseConfig({ allowDevelopmentFallback: true });
    if (config) {
      env.DATABASE_URL = config.url;
      console.log(`[dev] Database: ${describeDatabaseUrl(config.url)} (${config.remote ? "remote libSQL" : "local file"})`);
      if (!config.remote) {
        const inProject = databaseFileInProject(config.url);
        if (inProject) {
          console.warn(
            `[dev] База лежит внутри проекта: ${inProject.absolute}\n` +
              "[dev] Пока сервер работает, рядом с ней есть залоченные файлы *.db-shm и *.db-wal.\n" +
              "[dev] Сборщик стилей читает такие файлы и на Windows падает с «An unexpected Turbopack error occurred» (os error 33).\n" +
              '[dev] Перенесите базу в data/ и укажите в .env: DATABASE_URL="file:./data/pip.db" (см. .env.example).',
          );
        }
      }
      try {
        const status = await checkSchema(config);
        if (status.ok) console.log("[dev] Schema is up to date.");
        else console.warn(`[dev] Missing tables: ${status.missingTables.join(", ")}. Run npm run db:migrate before using the admin panel.`);
      } catch (error) {
        console.warn(`[dev] Database check failed: ${error.message}`);
      }
    }
  } catch (error) {
    console.warn(`[dev] ${error.message}`);
  }

  const args = process.argv.slice(2);
  let restarts = 0;
  let crashes = 0;
  let recovering = false;
  /** Пользователь сам остановил dev (Ctrl+C) — перезапускать нечего. */
  let stopping = false;
  let outOfMemory = false;
  let child = null;
  /** Момент старта текущего dev-процесса: долгая работа сбрасывает счётчик падений. */
  let startedAt = 0;
  /** Таймер отложенного перезапуска — держит процесс живым до старта. */
  let restartTimer = null;

  /**
   * Dev-сервер, упавший с внутренней ошибкой Turbopack, поднимается заново с
   * чистым кэшем: файлы страниц при этом не меняются, поэтому пользователь
   * вместо экрана ошибки получает рабочий сайт после одного автоперезапуска.
   */
  // Вывод дочернего процесса идёт через pipe (нужен для супервизора), поэтому
  // цветной вывод Next включаем явно — иначе логи станут блёклыми.
  if (process.stdout.isTTY && !process.env.FORCE_COLOR) env.FORCE_COLOR = "1";

  const startServer = () => {
    startedAt = Date.now();
    child = spawn(process.execPath, [nextBin, "dev", ...args], {
      cwd: rootDir,
      stdio: ["inherit", "pipe", "pipe"],
      env,
      // Своя группа процессов: `next dev` поднимает HTTP-сервер отдельным
      // процессом, и без группы он переживает падение родителя. Именно так
      // порт 3000 остаётся занятым, а следующий запуск падает с EADDRINUSE.
      detached: process.platform !== "win32",
    });

    const inspect = (stream, target) => {
      stream.on("data", (chunk) => {
        const text = chunk.toString();
        target.write(chunk);
        if (OUT_OF_MEMORY.test(text)) outOfMemory = true;
        if (recovering || !TURBOPACK_FAILURE.test(text)) return;
        if (process.env.PIP_NO_DEV_SUPERVISOR === "1") return;
        if (restarts >= MAX_RESTARTS) {
          console.error(
            "[dev] Turbopack повторил внутреннюю ошибку — автоперезапуск остановлен. " +
              "Удалите .next (rm -rf .next) или запустите npm run dev:webpack.",
          );
          return;
        }
        restarts += 1;
        recovering = true;
        console.warn(
          `[dev] Turbopack сообщил о внутренней ошибке — перезапускаю dev с чистым кэшем (${restarts}/${MAX_RESTARTS}).`,
        );
        killChild("SIGTERM");
        const force = setTimeout(() => killChild("SIGKILL"), 4000);
        force.unref?.();
      });
    };
    inspect(child.stdout, process.stdout);
    inspect(child.stderr, process.stderr);

    child.on("exit", (code, signal) => {
      // Остановка по нашей команде: сначала шаг восстановления, затем выход.
      if (recovering) {
        recovering = false;
        clearDevCache();
        startServer();
        return;
      }
      if (stopping) {
        process.exit(0);
        return;
      }

      // Стабильная работа дольше минуты — серия падений закончилась.
      if (startedAt > 0 && Date.now() - startedAt > STABLE_RUN_MS) crashes = 0;

      // Код 0 после падения тоже считается падением: Next перезапускает себя
      // сам и выходит, если ему не понравилось состояние каталога `.next`.
      const crashed = signal !== null || (code !== null && code !== 0) || crashes > 0;
      if (!crashed) {
        process.exit(code ?? 0);
        return;
      }

      const reason = signal ?? `код ${code}`;
      if (process.env.PIP_NO_DEV_SUPERVISOR === "1") {
        console.error(`[dev] dev-сервер завершился (${reason}); автоперезапуск выключен (PIP_NO_DEV_SUPERVISOR=1).`);
        process.exit(code ?? 1);
      }
      if (crashes >= MAX_CRASH_RESTARTS) {
        console.error(
          `[dev] dev-сервер упал ${crashes} раз подряд (последний — ${reason}) — автоперезапуск остановлен. ` +
            "Проверьте причину выше: чаще всего это нехватка памяти (NODE_OPTIONS=--max-old-space-size=4096) " +
            "или занятый порт; запасной запуск — npm run dev:webpack.",
        );
        process.exit(code ?? 1);
      }

      crashes += 1;
      const pause = 1000 * crashes;
      if (outOfMemory) {
        env.NODE_OPTIONS = withLargerHeap(env.NODE_OPTIONS);
        console.warn(
          `[dev] Похоже, dev-серверу не хватило памяти. Поднимаю заново с NODE_OPTIONS="${env.NODE_OPTIONS}" ` +
            `(${crashes}/${MAX_CRASH_RESTARTS}).`,
        );
      } else {
        console.warn(
          `[dev] dev-сервер завершился (${reason}) — поднимаю заново через ${pause / 1000} с ` +
            `(${crashes}/${MAX_CRASH_RESTARTS}).`,
        );
      }
      outOfMemory = false;
      // HTTP-процесс `next dev` умеет пережить своего родителя и продолжает
      // держать порт — тогда перезапуск падает с EADDRINUSE. Добиваем остатки
      // группы перед новым стартом.
      killChild("SIGKILL");
      // Кэш здесь не чистим: Turbopack считает удаление `.next/dev` на старте
      // повреждением и перезапускается сам. Внутренние ошибки Turbopack
      // по-прежнему лечатся чистым кэшем — это отдельная ветка выше.
      // Без unref: таймер должен удерживать event loop, иначе Node завершится
      // раньше перезапуска и «автоподъём» не случится.
      restartTimer = setTimeout(() => {
        restartTimer = null;
        startServer();
      }, pause);
    });
  };

  /**
   * Завершает dev-сервер вместе с его HTTP-процессом. На POSIX бьём по группе
   * (`-pid`), иначе потомки остаются жить и держат порт.
   */
  const killChild = (signal) => {
    if (!child?.pid) return;
    try {
      if (process.platform === "win32") child.kill(signal);
      else process.kill(-child.pid, signal);
    } catch {
      // Группы уже нет — пробуем хотя бы сам процесс.
      try {
        child.kill(signal);
      } catch {
        // Процесс уже завершился: это нормальный исход остановки.
      }
    }
  };

  const stop = (signal) => {
    stopping = true;
    if (restartTimer) {
      clearTimeout(restartTimer);
      restartTimer = null;
    }
    killChild(signal);
  };
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => stop(signal));
  startServer();
}

// Запуск только при прямом вызове: так помощники можно проверять тестами.
if (require.main === module) {
  main().catch((error) => {
    console.error(`[dev] ${error.message}`);
    process.exit(1);
  });
} else {
  module.exports = { databaseFileInProject, withLargerHeap };
}
