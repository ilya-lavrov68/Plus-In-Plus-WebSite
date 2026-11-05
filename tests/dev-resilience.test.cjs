const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

/**
 * «An unexpected Turbopack error occurred» и ChunkLoadError — одна и та же
 * ситуация: клиент держит ссылки на файлы прошлой сборки. Проверяем, что
 * страница сама перезагружается, а dev-сервер не поднимается на повреждённом
 * кэше умершего процесса.
 */

test("клиент восстанавливается после смены сборки", () => {
  const recovery = read("components/site/chunk-recovery.tsx");
  assert.match(recovery, /ChunkLoadError/, "ловится ошибка загрузки чанка");
  assert.match(recovery, /unexpected Turbopack error/i, "ловится внутренняя ошибка dev-сервера");
  assert.match(recovery, /Failed to fetch dynamically imported module/, "ловится неудавшийся dynamic import");
  assert.match(recovery, /sessionStorage/, "перезагрузка не зацикливается");
  assert.match(recovery, /location\.reload/, "страница перезагружается сама");

  for (const layout of ["app/(site)/layout.tsx", "app/(admin)/admin/layout.tsx"]) {
    assert.match(read(layout), /<ChunkRecovery \/>/, `${layout} подключает восстановление`);
  }
});

test("dev-сервер не стартует на кэше завершённого процесса", () => {
  const dev = read("scripts/dev.cjs");
  assert.match(dev, /resetStaleDevCache/, "есть проверка устаревшего dev-кэша");
  assert.match(dev, /\.next["'],\s*"dev"/, "чистится именно .next/dev");
  assert.match(dev, /lock/, "состояние живого сервера читается из lock-файла");
  assert.match(dev, /PIP_FRESH_DEV_CACHE/, "есть принудительная очистка");
  assert.match(dev, /resetProductionBuildCache/, "прод-артефакты по-прежнему удаляются");
  assert.match(dev, /BUILD_ID/, "прод-сборка распознаётся по BUILD_ID");
});

test("упавший Turbopack перезапускается с чистым кэшем", () => {
  const dev = read("scripts/dev.cjs");
  assert.match(
    dev,
    /An unexpected Turbopack error occurred/,
    "супервизор распознаёт сообщение об ошибке Turbopack",
  );
  assert.match(dev, /TurbopackInternalError/, "ловится и внутреннее имя ошибки");
  assert.match(dev, /MAX_RESTARTS/, "число попыток ограничено");
  assert.match(dev, /clearDevCache/, "перед перезапуском кэш чистится");
  assert.match(dev, /SIGKILL/, "зависший dev-процесс добивается");
  assert.match(dev, /PIP_NO_DEV_SUPERVISOR/, "есть выключатель автоперезапуска");
  assert.match(dev, /dev:webpack/, "сообщение подсказывает запасной запуск");
  assert.match(
    dev,
    /isDevServerProcess/,
    "pid из lock-файла сверяется с командной строкой процесса",
  );
});

test("упавший dev-сервер поднимается сам, а порт не остаётся занятым", () => {
  const dev = read("scripts/dev.cjs");

  // Раньше выход дочернего процесса просто завершал супервизор — со стороны это
  // выглядело как «сайт выключился».
  assert.match(dev, /dev-сервер завершился/, "сообщение о падении dev-сервера");
  assert.match(dev, /MAX_CRASH_RESTARTS/, "число автоподъёмов ограничено");
  assert.match(dev, /поднимаю заново/, "супервизор перезапускает сервер");
  assert.match(dev, /STABLE_RUN_MS/, "после стабильной работы счётчик сбрасывается");
  assert.match(dev, /restartTimer/, "таймер перезапуска сохраняется и отменяется");
  assert.doesNotMatch(
    dev,
    /restartTimer[\s\S]{0,120}unref/,
    "таймер перезапуска не должен быть unref: иначе Node выйдет раньше старта",
  );

  // HTTP-процесс `next dev` переживает родителя и держит порт — отсюда EADDRINUSE.
  assert.match(dev, /detached: process\.platform !== "win32"/, "dev-процесс стартует в своей группе");
  assert.match(dev, /process\.kill\(-child\.pid/, "завершается вся группа процессов");
  assert.match(dev, /killChild\("SIGKILL"\)/, "остатки группы добиваются перед перезапуском");

  // Ctrl+C — намеренная остановка, а не падение.
  assert.match(dev, /stopping = true/, "остановка пользователем помечается");
});

test("падение по нехватке памяти лечится увеличением кучи", () => {
  const dev = read("scripts/dev.cjs");
  assert.match(dev, /heap out of memory/i, "распознаётся сообщение OOM");
  assert.match(dev, /Reached heap limit/, "распознаётся лимит кучи V8");
  assert.match(dev, /withLargerHeap/, "лимит кучи поднимается");
  assert.match(dev, /--max-old-space-size/, "используется флаг Node");
  assert.match(dev, /HEAP_LIMIT_MB/, "размер лимита задан константой");
});

test("пакет содержит запасной запуск без Turbopack", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.scripts.dev, "node scripts/dev.cjs");
  assert.equal(pkg.scripts["dev:webpack"], "node scripts/dev.cjs --webpack");
});
