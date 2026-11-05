// Граница ошибок: у сайта должен быть экран ошибки на каждом уровне,
// а страница профиля не имеет права падать из-за одного неудачного запроса к БД.
//
// Проверки статические: они читают исходники, а не запускают Next. Этого
// достаточно, чтобы поймать регрессии, которые ломали жалобу «вылетает ошибка
// и сайт выключается»: удалённый global-error, экран ошибки с зависимостью от
// провайдеров, склеенные JSX-атрибуты и `Promise.all` вокруг чтения профиля.
const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const exists = (relative) => fs.existsSync(path.join(root, relative));

test("есть последний перехватчик ошибок для корневого layout", () => {
  assert.ok(exists("app/global-error.tsx"), "app/global-error.tsx отсутствует");

  const source = read("app/global-error.tsx");
  assert.match(source, /^"use client";/, "global-error должен быть клиентским компонентом");
  // Он подменяет документ целиком, поэтому обязан отдать html и body сам.
  assert.match(source, /<html[\s>]/, "global-error должен рендерить <html>");
  assert.match(source, /<body[\s>]/, "global-error должен рендерить <body>");
  // Никаких провайдеров и next-intl: именно их падение сюда и попадает.
  assert.doesNotMatch(source, /from\s+"next-intl"/, "global-error не должен зависеть от next-intl");
  assert.doesNotMatch(source, /from\s+"@\/app\/providers"/, "global-error не должен зависеть от провайдеров");
  assert.doesNotMatch(source, /SessionProvider|useTranslations|useLocale/, "global-error рендерится без контекста приложения");
  // Код ошибки нужен, чтобы инцидент можно было найти в логах сервера.
  assert.match(source, /error\.digest/, "global-error должен показывать digest");
});

test("экран ошибки сайта ловит сбой и предлагает повтор", () => {
  const source = read("app/(site)/error.tsx");
  assert.match(source, /^"use client";/, "error.tsx должен быть клиентским компонентом");
  assert.match(source, /reset/, "error.tsx должен принимать reset");
  assert.match(source, /onClick=\{reset\}/, "error.tsx должен вызывать reset по кнопке");
  assert.match(source, /useEffect\(/, "ошибку нужно записывать в консоль в useEffect");
});

test("в JSX нет склеенных атрибутов вида className=\"mt-8\"asChild", () => {
  const files = [
    "app/(site)/error.tsx",
    "app/(site)/not-found.tsx",
    "components/site/profile-form.tsx",
    "app/global-error.tsx",
  ];
  const glued = /"[a-zA-Z]*=[{"]/;

  for (const file of files) {
    for (const line of read(file).split("\n")) {
      assert.doesNotMatch(line, glued, `${file}: склеенные атрибуты → ${line.trim()}`);
    }
  }
});

test("страница профиля переживает ошибку чтения данных", () => {
  const source = read("app/(site)/profile/page.tsx");
  // Именно Promise.all превращал любую ошибку БД в аварию всего маршрута.
  assert.doesNotMatch(
    source,
    /Promise\.all\(\s*\[\s*findAccountById/,
    "чтение профиля не должно идти через Promise.all",
  );
  assert.match(source, /Promise\.allSettled/, "каждый запрос профиля разрешается отдельно");
  assert.match(source, /console\.error/, "сбой чтения должен попадать в лог");
  assert.match(source, /dbUser\?\.isBlocked/, "проверка блокировки остаётся в силе");
  assert.match(source, /redirect\("\/login"\)/, "без сессии профиль по-прежнему уводит на вход");
});

test("тексты экрана ошибки есть в обеих локалях", () => {
  const ru = JSON.parse(read("messages/ru.json"));
  const en = JSON.parse(read("messages/en.json"));

  for (const key of ["serverError", "tryAgain", "retryButton", "errorCode"]) {
    assert.equal(typeof ru.errors[key], "string", `ru.errors.${key} отсутствует`);
    assert.equal(typeof en.errors[key], "string", `en.errors.${key} отсутствует`);
  }
});
