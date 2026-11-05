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

test("пакет содержит запасной запуск без Turbopack", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.scripts.dev, "node scripts/dev.cjs");
  assert.equal(pkg.scripts["dev:webpack"], "node scripts/dev.cjs --webpack");
});
