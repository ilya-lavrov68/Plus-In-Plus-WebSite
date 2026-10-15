# Plus In Plus — сайт

Репозиторий сайта **Plus In Plus**: витрина услуг с конфигуратором и заявками, блог,
личный кабинет клиента, кабинет менеджера и полная админ-панель.

**Стек:** Next.js 15 (App Router) · React 18 · TypeScript · Tailwind CSS 4 ·
Prisma 6 + libSQL/SQLite (Turso) · Auth.js v5 (`next-auth` beta) · next-intl (ru/en) ·
Zod · TipTap · Robokassa · Sharp.

**Где работает:**
- **разработка** — локально, база просто лежит файлом `prisma/dev.db`, ничего ставить не нужно;
- **продакшен** — на вашем собственном сервере: **Apache принимает HTTPS-трафик и
  проксирует его на Node.js-приложение**, база — Turso Cloud (рекомендуется) или
  libSQL-сервер на том же сервере. Подробно: [Продакшен: свой сервер с Apache](#продакшен-свой-сервер-с-apache).

> Дополнительный пошаговый док по Turso и хостингам — [DEPLOYMENT.md](DEPLOYMENT.md)
> (на английском). Все переменные окружения описаны в [.env.example](.env.example).

## Содержание

1. [Что умеет сайт](#что-умеет-сайт)
2. [Требования](#требования)
3. [Локальная разработка — быстрый старт](#локальная-разработка--быстрый-старт)
4. [Команды](#команды)
5. [Переменные окружения](#переменные-окружения)
6. [Роли и доступы](#роли-и-доступы)
7. [База данных](#база-данных)
8. [Файлы загрузок (uploads)](#файлы-загрузок-uploads)
9. [Языки (ru / en)](#языки-ru--en)
10. [Проверка качества: линт, типы, тесты, CI](#проверка-качества-линт-типы-тесты-ci)
11. [Продакшен: свой сервер с Apache](#продакшен-свой-сервер-с-apache)
12. [Проверка деплоя](#проверка-деплоя)
13. [Частые проблемы](#частые-проблемы)
14. [Безопасность — чек-лист](#безопасность--чек-лист)
15. [Дизайн-макеты и другие документы](#дизайн-макеты-и-другие-документы)

---

## Что умеет сайт

| Раздел | Адрес | Описание |
| --- | --- | --- |
| Главная | `/` (переадресация на `/ru` или `/en`) | лендинг, новости, партнёры, CTA |
| Магазин | `/shop`, `/shop/[slug]` | каталог услуг; на странице услуги — конфигуратор опций и отправка заявки |
| Блог | `/blog`, `/blog/[slug]` | статьи с обложками и галереями, избранная статья |
| Контакты | `/contact` | страница контактов (форма-заглушка, отправка не подключена) |
| Личный кабинет | `/orders` | вход обязателен: свои заявки, счета, статусы, профиль |
| Кабинет менеджера | `/manager/orders`, `/manager/orders/[id]` | согласование цены, выставление счёта, смена статусов |
| Админ-панель | `/admin/…` | `dashboard` (счётчики и журнал действий), `services`, `blog`, `orders`, `users`, `analytics`, `settings` |
| Оплата | `/payment/success`, `/payment/fail` | страницы редиректа после Робокассы |

**Жизненный цикл заказа:** `quote_requested` (клиент собрал услугу и отправил заявку) →
`negotiating` (менеджер уточняет ТЗ) → `awaiting_payment` (цена согласована, выставлен
счёт) → `paid` → `in_progress` → `completed`; возможны `cancelled` и `refunded`.
Сумма заявки рассчитывается конфигуратором (`estimatedAmount`), к оплате годится только
`total`, выставленный менеджером.

**Прочее:** счётчик посещений (`page_views` + `/api/page-view`), настройки сайта в
админке (`SiteSetting`), стратегия поисковых ботов (`robots.ts`, `sitemap.ts`),
санитизация HTML статей перед сохранением и при рендере, локальные аватары/обложки
через Sharp (PNG/JPEG/WebP/GIF/AVIF → статический WebP).

**Структура репозитория:**

| Путь | Что внутри |
| --- | --- |
| `app/` | маршруты App Router: страницы, `api/`, server actions (`app/actions/`) |
| `components/` | UI: `site/` (публичная часть), `admin/`, `manager/`, `orders/`, `ui/`, `spectrumui/` |
| `lib/` | бизнес-логика: доступы, валидация, БД, оплата, загрузки, i18n |
| `prisma/schema.prisma` | единственный источник схемы базы |
| `messages/en.json`, `messages/ru.json` | все тексты интерфейса |
| `scripts/` | утилиты: `dev`, `db:*`, `deploy:verify`, seed и др. |
| `tests/` | автотесты (`node --test`) |
| `.github/workflows/ci.yml` | CI: линт, типы, тесты, схема, сборка, smoke-тест |
| `public/uploads/` | загрузы пользователей (аватары, обложки) — в Git не попадают |
| `docs/`, `*.png/*.pdf/*.svg` в корне | внутренние заметки и дизайн-макеты страниц |

---

## Требования

- **Node.js 20.19+ или 22 LTS** (`node -v`; в `package.json` стоит `engines.node >= 20.19.0`)
- **npm** (идёт с Node)
- Git
- Счёт в Turso — только для продакшена (можно и без него, см. базу данных ниже)

Базу, сервер БД и драйверы ставить не нужно: локально работает обычный SQLite-файл.

---

## Локальная разработка — быстрый старт

```bash
# 1. Клонирование
git clone https://github.com/ilialavrov227-prog/Plus-In-Plus-WebSite.git
cd Plus-In-Plus-WebSite

# 2. Файл окружения (PowerShell: Copy-Item .env.example .env)
cp .env.example .env

# 3. Секрет для сессий — ≥32 символов:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
#    вставьте результат в AUTH_SECRET внутри .env
#    (TURSO_DATABASE_URL оставьте пустым — локально используется prisma/dev.db)

# 4. Зависимости (сам постскрипт сгенерирует Prisma-клиент, база не нужна)
npm install

# 5. Поднять схему базы (создаст prisma/dev.db со всеми таблицами)
npm run db:push
npm run db:check          # проверка: все таблицы и колонки на месте

# 6. Запуск dev-сервера (сначала сам сверяет схему и синхронизирует её при необходимости)
npm run dev               # http://localhost:3000
```

Опционально — демо-контент (услуги, статьи, заказы и тестовые аккаунты):

```bash
npm run db:seed-demo
```

Демо-аккаунты **только для локальной разработки** (пароли лежат в `scripts/seed-demo.cjs`):

| Email | Пароль | Роль |
| --- | --- | --- |
| `admin@plusinplus.test` | `Admin12345` | ADMIN |
| `manager@plusinplus.test` | `Manager12345` | MANAGER |
| `user1@plusinplus.test` | `User12345` | USER |
| `user2@plusinplus.test` | `User12345` | USER (заблокирован) |

На удалённую (Turso) базу этот скрипт **не работает** — он удаляет строки перед
вставкой и предназначен только для одноразового локального файла.

Схема, код и команды `npm run db:push` одинаковы локально и в продакшене: переключается
только `TURSO_DATABASE_URL`. Prisma-клиент лежит в `lib/generated/prisma/` и в Git не
попадает — `npm install` генерирует его автоматически (`npm run prisma:generate` — вручную).

Сервер разработки по умолчанию слушает только localhost. Чтобы открыть его в локальной
сети: `npm run dev -- --hostname 0.0.0.0`.

---

## Команды

| Команда | Что делает |
| --- | --- |
| `npm run dev` | dev-сервер Next (с автосинхронизацией схемы БД) |
| `npm run build` | production-сборка |
| `npm start` | запуск production-сборки (`next start`) |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | проверка типов |
| `npm test` | автотесты (`node --test tests/*.test.cjs`) |
| `npm run db:push` | применить `prisma/schema.prisma` к базе (создать/добавить таблицы и колонки) |
| `npm run db:check` | проверить соединение и наличие всех таблиц/колонок (код выхода 1, если чего-то нет) |
| `npm run db:promote-admin` | список аккаунтов / выдать или отобрать роль ADMIN |
| `npm run db:seed-demo` | залить демо-контент **только** в локальную базу |
| `npm run db:load-dump` | загрузить дамп (например, продакшеновый) в текущую базу |
| `npm run db:migrate-from-postgres` | разовый перенос данных из старой PostgreSQL |
| `npm run deploy:verify -- https://домен` | внешняя проверка уже задеплоенного сайта |
| `npm run prisma:generate` | перегенерировать Prisma-клиент |

> Важно: скрипты `db:*` читают переменные из **окружения процесса**, а не из `.env`
> сами по себе. Перед ними в том же шелле выполните:
> `set -a; source .env; set +a` (Windows PowerShell: задайте переменные через `$env:…`).
> Сам `next dev` / `next build` / `next start` читает `.env` автоматически.

---

## Переменные окружения

Файл `.env` создаётся из `.env.example`. **`.env` никогда не попадает в Git.**

| Переменная | Обязательна | Назначение |
| --- | --- | --- |
| `TURSO_DATABASE_URL` | да (в продакшене обязана) | `libsql://…turso.io` (Turso), `http://…` (свой sqld), `file:./prisma/dev.db` (локально, это же — дефолт) |
| `TURSO_AUTH_TOKEN` | для Turso Cloud | токен БД: `turso db tokens create <db>` |
| `AUTH_SECRET` | да | секрет сессий, **минимум 32 символа**, уникален для каждого окружения |
| `AUTH_URL` | да в продакшене | публичный HTTPS-адрес сайта, например `https://example.com` |
| `NEXT_PUBLIC_SITE_URL` | рекомендуется | тот же адрес — для SEO-метаданных и `sitemap.xml` |
| `ROBOKASSA_MERCHANT_LOGIN` | нет | логин мерчанта Робокассы |
| `ROBOKASSA_PASSWORD1` | нет | пароль №1 — подпись исходящих запросов (форма оплаты) |
| `ROBOKASSA_PASSWORD2` | нет | пароль №2 — проверка входящих уведомлений (Result URL) |
| `ROBOKASSA_TEST_MODE` | нет | `"1"` — тестовый режим, реальных денег нет; для боевых платежей пусто |
| `ROBOKASSA_HASH_ALGO` | нет | `md5` (дефолт) \| `ripemd160` \| `sha256` \| `sha512` — как в настройках магазина |

Генерация секрета:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"   # или: openssl rand -base64 32
```

Без `TURSO_DATABASE_URL` и/или длинного `AUTH_SECRET` в продакшене всё не падает, а
**честно отключается**: публичные разделы показывают пустые состояния, вход и
регистрация отвечают «временно недоступны». Старые переменные v4
(`NEXTAUTH_SECRET`, `NEXTAUTH_URL`) поддерживаются на переходный период, новые
настройки — только на имена v5. Левая `DATABASE_URL` (PostgreSQL) игнорируется с
предупреждением в логе.

**Робокасса:** без трёх переменных сайт работает, но платёжная ссылка не формируется —
менеджер всё равно согласует цену и записывает счёт. Для боевой оплаты зарегистрируйте
в кабинете Робокассы:

| Поле | URL |
| --- | --- |
| Result URL (серверный, по нему идут деньги) | `https://<домен>/api/payments/robokassa/result` |
| Success URL (браузер клиента) | `https://<домен>/payment/success` |
| Fail URL (браузер клиента) | `https://<домен>/payment/fail` |

**Заголовки прокси.** Auth.js доверяет заголовкам обратного прокси. Ваш прокси
(Apache) обязан **перезаписывать** `Host`, `X-Forwarded-Host`, `X-Forwarded-Proto`,
`X-Real-IP` и `X-Forwarded-For` — не пропускать клиентские значения. Готовый конфиг
Apache — в разделе про продакшен. Браузерный код работает только с относительными
URL, поэтому localhost в запросах из браузера нигде не появляется.

---

## Роли и доступы

| Роль | Куда входит | Права |
| --- | --- | --- |
| `USER` | публичный сайт + `/orders` | заявки, оплата, свой профиль — и только свои данные |
| `MANAGER` | `/manager/orders` | согласование цены, выставление счёта, статусы заявок; управление сайтом недоступно |
| `ADMIN` | `/admin/…` и `/manager` | весь контент, пользователи, роли, настройки, аналитика, журнал |

- **Регистрация всегда создаёт `USER`.** Первого администратора «по умолчанию» нет,
  сид-скрипт аккаунты в продакшен не пишет.
- **Служебные части — явный opt-in.** В диалоге входа есть переключатель
  **«Режим администратора»** (по умолчанию выключен). С выключенным переключателем
  даже у администратора создаётся обычная `USER`-сессия. Включённый переключатель требует
  пароль и роль `ADMIN`/`MANAGER` в базе; при успехе админ уходит на
  `/admin/dashboard`, менеджер — на `/manager/orders`.
- Middleware редиректит гостей и `USER` со всех `/admin/*` и `/manager/*`; страницы,
  server actions и запросы данных **дополнительно проверяют роль из базы**, поэтому
  блокировка/понижение роли действует даже при живой JWT-сессии (до перелогина в
  служебную часть).
- Вход, регистрация и смена профиля ограничены по частоте (внутри процесса).
- Пароли: от 12 символов до 72 UTF-8 байт (лимит bcrypt), хеш — bcrypt cost 12.
  Email нормализуется в нижний регистр, имена — до 80 символов.
- Сессия живёт 7 дней; после смены роли существующая сессия **не повышается сама** —
  нужно выйти и войти заново с переключателем.

### Создать администратора

```bash
# 1. Зарегистрировать свой реальный аккаунт на сайте (роль будет USER).
# 2. Повысить его (чтения .env нет — переменные экспортируем сами):
set -a; source .env; set +a
npm run db:promote-admin                          # список аккаунтов
npm run db:promote-admin -- you@example.com       # → ADMIN
npm run db:promote-admin -- you@example.com --revoke   # → снова USER

# Для Turso с другого компьютера:
TURSO_DATABASE_URL="libsql://…" TURSO_AUTH_TOKEN="…" npm run db:promote-admin -- you@example.com
```

3. Выйти, открыть **Вход**, включить **Режим администратора**, войти снова.

### Создать менеджера

Скрипт `db:promote-admin` переключает только `ADMIN`/`USER`. Роль `MANAGER` ставится
напрямую в базе (Prisma Studio или SQL) и действует со следующего входа:

```bash
set -a; source .env; set +a
# Turso:
turso db shell plus-in-plus "update users set role = 'MANAGER' where email = 'you@example.com';"
# или свой sqld:
turso db shell http://127.0.0.1:8080 "update users set role = 'MANAGER' where email = 'you@example.com';"
```

Проверить роли: `npm run db:promote-admin` (без аргументов печатает `id, email, role`).

---

## База данных

Одна схема — `prisma/schema.prisma`, провайдер `sqlite` (протокол libSQL). Никаких
файлов миграций: применяет `prisma db push` (идемпотентно), локально и в продакшене —
одной и той же командой.

| | Разработка | Продакшен |
| --- | --- | --- |
| `TURSO_DATABASE_URL` | пусто → `prisma/dev.db` (или `file:./prisma/dev.db`) | `libsql://plus-in-plus-<org>.turso.io` или `http://127.0.0.1:8080` (свой sqld) |
| `TURSO_AUTH_TOKEN` | не нужен | обязателен для Turso Cloud |
| Применение схемы | `npm run db:push` | `npm run db:push` (с переменными продакшена) |
| Драйвер | `@prisma/adapter-libsql` | тот же |

**Почему не PostgreSQL:** Turso/libSQL говорит на протоколе SQLite, поэтому
`provider = "sqlite"` — `libsql://` это *не* PostgreSQL-сервер. Отсюда правила:

- `User.role` — это `String` (`USER` | `MANAGER` | `ADMIN`), который контролирует
  приложение, а не база (в SQLite нет enum);
- `Service.includes`, `Service.shapes`, опции в корзине/заказах — JSON **строки**,
  читаются/пишутся через `lib/db-helpers.ts` (`parseJsonArray` / `toJsonArray`);
- имена таблиц явные через `@@map`: `users`, `services`, `posts`, `activity_logs`,
  `orders`, `order_items`, `payments`, `cart_items`, `page_views`, …

### Локальная база без аккаунтов

Пустой `TURSO_DATABASE_URL` — и всё работает: `npm run dev` сам создаёт
`prisma/dev.db`, сверяет схему и запускает Next. Файлы `prisma/dev.db*` в `.gitignore`,
каждый клон стартует чисто.

### Добавить колонку или таблицу

```bash
# 1. Отредактировать prisma/schema.prisma, например в model User:
#      phone String?          → nullable, безопасно при уже существующих строках
#      visits Int @default(0) → обязательная, но безопасная из-за default
# 2. Применить:
npm run db:push
# 3. Проверить:
npm run db:check
```

`db:push` заодно перегенерирует Prisma-клиент, после чего новое поле сразу
типизируется. Дальше — провести поле через приложение: Zod-схема в
`lib/validators.ts`, server action в `app/actions/*.ts`, форма в админке.

Правила:

- обязательная колонка **без default** к таблице со строками отклоняется (Prisma
  сама напишет, сколько строк в таблице) — сделайте `@default(…)` или `String?`;
- удаление колонки с данными требует явного флага: `npm run db:push -- --accept-data-loss`,
  полностью пересоздать БД: `npm run db:push -- --force-reset` (все данные потеряются);
- **в продакшен перед изменением схемы — обязательно дамп** (`db push` без отмены).

Автоматика, которую обычно не нужно трогать руками:

| Ситуация | Что происходит |
| --- | --- |
| `npm install` | `postinstall` → `prisma generate` (без подключения к базе) |
| `npm run dev` | сравнивает схему с базой и запускает `db push` **только** если чего-то не хватает |
| CI (`.github/workflows/ci.yml`) | на каждом push: `db:push` + `db:check` на одноразовом `file:./prisma/ci.db` |
| `GET /api/health` | сообщает базу и наличие всех обязательных таблиц |

### Инспекция базы

```bash
npx prisma studio                                     # http://localhost:5555
npx prisma studio --hostname 0.0.0.0 --port 5555 --browser none   # удалённый хост
turso db shell plus-in-plus ".tables"
turso db shell plus-in-plus "select email, role from users order by createdAt;"
turso db shell plus-in-plus "select action, entityType, title, createdAt from activity_logs order by createdAt desc limit 20;"
```

Studio ходит в базу тем же драйвером, что и сайт (см. `prisma.config.ts`), но пишет
**минуя** валидацию и журнал действий приложения. Допустимые ручные правки:

- `users.passwordHash` — только настоящий bcrypt; сгенерируйте его:
  `node -e "console.log(require('bcryptjs').hashSync('new-passphrase-2026', 12))"`
- `users.avatar` — строго `/uploads/avatars/<uuid>.webp`, иначе приложение рисует инициалы;
- `users.role` — повышение/понижение (см. выше), действует со следующего входа;
- ручные правки не появляются в журнале действий дашборда (туда пишутся только
  действия через приложение).

Для сырых SQL в локальной базе — расширение **SQLTools** + SQLite driver
(см. `.vscode/extensions.json`) или `sqlite3 prisma/dev.db`.

### Схема в продакшене

Изменения применяются **после деплоя**, из каталога проекта на сервере:

```bash
set -a; source .env; set +a
npm run db:push
npm run db:check
curl https://<домен>/api/health     # {"status":"ok",…,"tables":4}
```

---

## Файлы загрузок (uploads)

| Каталог | Поле в базе | Лимит входа |
| --- | --- | --- |
| `public/uploads/avatars/` | `User.avatar`: `/uploads/avatars/<uuid>.webp` | 2 МБ |
| `public/uploads/services/` | `Service.coverImage`: `/uploads/services/<uuid>.webp` | 8 МБ |
| `public/uploads/blog/` | `Post.coverImage`: `/uploads/blog/<uuid>.webp` | 8 МБ |

Принимаются PNG, JPEG, WebP, GIF, AVIF (проверяются расширение, MIME, подпись и
реальное декодирование, до 25 мегапикселей). Sharp перекодирует в **статический
WebP** без метаданных: аватары до 256×256, обложки до 2400×2400, с сохранением
пропорций. SVG, удалённые URL, произвольные имена и пути с обходом — отклоняются.

Особенности:

- имя файла — UUID (нет коллизий и проблем с кешем);
- при ошибке транзакции новый файл удаляется, старый — только после успешного
  коммита;
- `app/uploads/[kind]/[filename]/route.ts` отдаёт файлы, созданные **после**
  старта процесса (включая `next start`), разрешает только известные каталоги и
  сгенерированные имена, запрещает симлинки, отдаёт картинки с `nosniff`;
- загрузки в `.gitignore` — каталоги `public/uploads/…` должны быть **доступны на
  запись и переживать редеплой** (постоянный диск, никакой очистки при деплое).
  Хранить их надо вместе с бэкапами базы — картинки лежат на диске, не в SQLite.

Статические брендовые ассеты отдельно: `public/assets/logos/`, `public/assets/gradients/`.

---

## Языки (ru / en)

- Два языка: `ru` и `en` (дефолт — `en`). Все тексты интерфейса — в
  `messages/ru.json` и `messages/en.json` (одинаковый набор ключей).
- Маршруты получают префикс: `/ru/blog`, `/en/blog`. Middleware внутренне
  переписывает их на `/blog`, поэтому URL и выбор языка переживают клиентскую навигацию
  без дублирования страниц.
- Язык выбирается по cookie `pip-locale` (её ставит переключатель) или по
  `Accept-Language`; служебные адреса (`/api/*`, `/_next/*`, `/uploads/*`) языкового
  редиректа не получают.
- `/admin` и `/manager` существуют без языкового префикса; из `/ru/admin…`
  middleware уводит на `/admin…`.
- Server actions переводятся через `lib/action-i18n.ts` — новый текст ошибки
  добавляйте в оба файла `messages/*.json`.

---

## Проверка качества: линт, типы, тесты, CI

```bash
npm run lint          # ESLint
npx tsc --noEmit      # типы
npm test              # node --test tests/*.test.cjs
```

Тесты покрывают: режимы авторизации и прав ролей, инъекцию роли при регистрации,
владение профилем, подделку claims сессии, защиту админ-действий, CRUD и журнал
действий в одной транзакции, загрузку файлов, санитизацию, валидацию Zod,
разрешение цели БД, JSON-хелперы, а также допущение, что схема остаётся
libSQL/SQLite. Сценарии ролей идут на **замоканных репозиториях**, без реальных
аккаунтов и сидов.

CI (`.github/workflows/ci.yml`) на каждый push и PR, **без каких-либо секретов**:
lint → `tsc --noEmit` → `npm test` → `db:push` + `db:check` на одноразовом SQLite →
`npm run build` → smoke-тест `next start` (`/api/health` + публичные страницы).

---

## Продакшен: свой сервер с Apache

### Как всё устроено

Сайт — это Node.js-приложение (Next.js), поэтому «просто закинуть файлы в
Apache/PHP-каталог» не работает. На вашем сервере:

```
Браузер ──HTTPS──▶ Apache (443, SSL-сертификат)          ◀── обновления: git pull + build
                      │  reverse proxy (mod_proxy)       ◀── статика и SSR отдаёт Node
                      ▼
                Node.js приложение  (127.0.0.1:3000, PM2/systemd, next start)
                      │
                      ▼
                База: Turso Cloud (libsql://…)  или  свой sqld на 127.0.0.1:8080
                + постоянный диск каталога public/uploads/ (аватары, обложки)
```

- Apache — единственная точка входа: принимает 80/443, выпускает сертификат
  (Certbot), проксирует **все** запросы (`/`, `/_next/*`, `/api/*`, `/uploads/*`)
  на `127.0.0.1:3000`.
- Порт 3000 наружу **не открывается** (он слушает только localhost / закрыт файрволом).
- Если на сервере уже стоит какая-то панель (ISPmanager, VestaCP, «Apache+PHP» и т.
  п.) — она не мешает: Apache остаётся точкой входа, а сайт работает как
  Node-приложение за его reverse-proxy.
- Если вместо Apache ожидается Nginx — идея ровно та же, пример конфига в
  [Приложение: Nginx](#приложение-вариант-с-nginx).

### Шаг 0. Подготовка сервера

- Ubuntu/Debian-подобный VPS (хватает 2 vCPU / 2 ГБ RAM; на 1 ГБ добавьте swap),
  sudo, домен, чья A-запись указывает на IP сервера.
- Пакеты и Node.js 22:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl apache2 ufw certbot python3-certbot-apache

# Node.js 22.x (репозиторий NodeSource)
sudo apt install -y ca-certificates gnupg
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
  | sudo gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" \
  | sudo tee /etc/apt/sources.list.d/nodesource.list
sudo apt update && sudo apt install -y nodejs
node -v          # v22.x (любая версия ≥ 20.19 подходит)
```

- Файрвол (порт 3000 не открываем):

```bash
sudo ufw allow OpenSSH && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp
sudo ufw enable
```

- Если сборка падает «Out of memory» — добавьте swap:

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### Шаг 1. База данных

**Вариант А — Turso Cloud (рекомендуется, есть бесплатный уровень):**

```bash
curl -sSfL https://get.tur.so/install.sh | bash    # Turso CLI (нужен и для бэкапов)
turso auth signup                                  # или: turso auth login
turso db create plus-in-plus
turso db show plus-in-plus --url                   # → TURSO_DATABASE_URL
turso db tokens create plus-in-plus                # → TURSO_AUTH_TOKEN
```

**Вариант Б — свой libSQL-сервер (sqld) на этом же сервере:**

```bash
mkdir -p ~/sqld-data
docker run -d --name sqld --restart unless-stopped \
  -e SQLD_NODE=primary \
  -p 127.0.0.1:8080:8080 \
  -v "$HOME/sqld-data:/var/lib/sqld" \
  ghcr.io/tursodatabase/libsql-server:latest
docker ps   # контейнер sqld должен быть Up
```

Тогда в `.env`: `TURSO_DATABASE_URL="http://127.0.0.1:8080"`, `TURSO_AUTH_TOKEN`
пустой. Порт 8080 проброшен только на localhost — наружу он не виден.
(Для дампов всё равно поставьте Turso CLI — `turso db shell <url> .dump` работает
и без аккаунта.)

### Шаг 2. Код и окружение

```bash
sudo mkdir -p /opt/plus-in-plus
sudo chown "$USER":"$USER" /opt/plus-in-plus

# Приватный репозиторий? Выпустите deploy-ключ (read-only) и клонируйте по SSH:
#   ssh-keygen -t ed25519 -C deploy@plus-in-plus -f ~/.ssh/plusinplus_deploy
#   cat ~/.ssh/plusinplus_deploy.pub  → GitHub → репозиторий → Settings → Deploy keys → Add
#   git clone git@github.com:ilialavrov227-prog/Plus-In-Plus-WebSite.git /opt/plus-in-plus
git clone https://github.com/ilialavrov227-prog/Plus-In-Plus-WebSite.git /opt/plus-in-plus
cd /opt/plus-in-plus

cp .env.example .env
nano .env        # см. таблицу переменных; обязательно:
                 #   TURSO_DATABASE_URL, TURSO_AUTH_TOKEN (для Turso),
                 #   AUTH_SECRET (≥32 символов), AUTH_URL="https://example.com",
                 #   NEXT_PUBLIC_SITE_URL="https://example.com"
```

Каталог `public/uploads/` — единственный изменяемый в рантайме: он переживает
`git pull` (загрузки в `.gitignore`, Git их не трогает). **Не запускайте
`git clean -fdx` на сервере** — он сотрёт загруженные картинки.

### Шаг 3. Зависимости и сборка

```bash
npm ci                # postinstall сам сгенерирует Prisma-клиент (база не нужна)
npm run build
```

Сборка идёт на сервере — убедитесь, что в этом шелле **не** экспортирован
`NODE_ENV=production` перед `npm ci` (иначе не встанут dev-зависимости: prisma,
typescript, tailwind — они нужны и для сборки, и для `db:push`).

### Шаг 4. Схема базы и проверка

```bash
set -a; source .env; set +a          # экспортировать переменные для npm-скриптов
npm run db:push                      # idempotent: создаст недостающие таблицы/колонки
npm run db:check                     # должна пройти без ошибок
```

Проверку `/api/health` сделаем после запуска приложения на шаге 5.

`TURSO_DATABASE_URL` в продакшене **обязана** быть задана: без неё приложение
намеренно откажется работать с локальным файлом — контент будет пустым, вход
отключён.

### Шаг 5. Запуск приложения (PM2)

```bash
sudo npm i -g pm2
cd /opt/plus-in-plus
pm2 start npm --name plus-in-plus -- start     # next start, читает .env сам
pm2 save                                      # сохранить список
pm2 startup                                   # и выполнить напечатанную от root команду
                                              # → автозапуск после перезагрузки сервера
pm2 logs plus-in-plus                         # логи; pm2 restart plus-in-plus — перезапуск
```

Альтернатива без PM2 — systemd-юнит `/etc/systemd/system/plus-in-plus.service`:

```ini
[Unit]
Description=Plus In Plus (Next.js)
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/plus-in-plus
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now plus-in-plus
sudo systemctl restart plus-in-plus
```

Если запускаете от `www-data`, отдайте ему каталог загрузок (иначе аватары и
обложки не будут записываться):

```bash
sudo chown -R www-data:www-data /opt/plus-in-plus/public/uploads
```

Проверьте локально: `curl -s http://127.0.0.1:3000/api/health` → `200`.

### Шаг 6. Apache как reverse proxy + HTTPS

```bash
sudo a2enmod proxy proxy_http headers rewrite
```

Конфиг сайта (замените `example.com` на свой домен):

```apache
# /etc/apache2/sites-available/plus-in-plus.conf
<VirtualHost *:80>
    ServerName example.com

    ProxyRequests Off
    ProxyPreserveHost On
    ProxyTimeout 300

    # Перезаписываем заголовки доверенного прокси — клиентские значения не пропускаем.
    # После Certbot в -le-ssl.conf этот же блок должен стоять с "https".
    RequestHeader set X-Forwarded-Proto "http"
    RequestHeader set X-Forwarded-Host "example.com"
    RequestHeader set X-Real-IP "%{REMOTE_ADDR}s"
    RequestHeader unset X-Forwarded-For

    ProxyPass / http://127.0.0.1:3000/
    ProxyPassReverse / http://127.0.0.1:3000/
</VirtualHost>
```

```bash
sudo a2ensite plus-in-plus
sudo a2dissite 000-default
sudo systemctl reload apache2

# Проверка по HTTP до выпуска сертификата:
curl -s http://example.com/api/health
```

Выпуск сертификата (автопродление включится автоматически):

```bash
sudo certbot --apache -d example.com
```

Certbot клонирует ваш виртуальный хост в `…-le-ssl.conf` для порта 443 и
настраивает редирект HTTP → HTTPS. **Откройте этот файл и в блоке
`<VirtualHost *:443>` замените (или добавьте, если скопировалось не всё) строку**

```apache
RequestHeader set X-Forwarded-Proto "http"
```

**на**

```apache
RequestHeader set X-Forwarded-Proto "https"
```

и `sudo systemctl reload apache2`. Без этого Auth.js увидит «http» и не будет
ставить защищённую cookie сессии.

Опционально, если когда-нибудь понадобится проксировать dev-сервер с HMR:

```apache
# RewriteEngine On
# RewriteCond %{HTTP:Upgrade} =websocket [NC]
# RewriteRule ^(.*)$ ws://127.0.0.1:3000/$1 [P]
```

### Шаг 7. Финальная проверка и первый админ

Смотрите [Проверка деплоя](#проверка-деплоя). Дальше — регистрация на сайте и
[создание администратора](#создать-администратора) прямо на сервере
(`set -a; source .env; set +a; npm run db:promote-admin -- you@example.com`).

### Шаг 8. Робокасса (когда будут боевые платежи)

Заполните `ROBOKASSA_*` в `/opt/plus-in-plus/.env`, перезапустите приложение
(`pm2 restart plus-in-plus`) и зарегистрируйте три URL из раздела
[Переменные окружения](#переменные-окружения) в кабинете Робокассы.
До этого сайт работает без платёжных ссылок — цена всё равно согласуется менеджером.

### Обновление версии

```bash
cd /opt/plus-in-plus
git pull --ff-only
npm ci
npm run build
pm2 restart plus-in-plus          # или: sudo systemctl restart plus-in-plus

# Если менялась схема БД (prisma/schema.prisma):
set -a; source .env; set +a
npm run db:push && npm run db:check

# Всегда в конце:
npm run deploy:verify -- https://example.com
```

Деплой не трогает базу и не трогает `public/uploads/`: схема применяется только
явной командой `db:push`, загрузки лежат на диске.

### Бэкапы

Бэкапить нужно **две вещи**: базу и картинки.

```bash
mkdir -p /opt/plus-in-plus/backup && cd /opt/plus-in-plus
set -a; source .env; set +a

# База — Turso Cloud:
turso db shell plus-in-plus .dump > backup/db-$(date +%F).sql
# База — свой sqld:
turso db shell http://127.0.0.1:8080 .dump > backup/db-$(date +%F).sql

# Картинки:
tar czf backup/uploads-$(date +%F).tar.gz public/uploads
```

Пример cron (ежедневно в 03:00, хранить 14 дней):

```cron
0 3 * * * cd /opt/plus-in-plus && mkdir -p backup && set -a && . ./.env && set +a && turso db shell plus-in-plus .dump > backup/db-$(date +\%F).sql 2>/dev/null
30 3 * * * cd /opt/plus-in-plus && tar czf backup/uploads-$(date +\%F).tar.gz public/uploads && find backup -name '*.sql' -mtime +14 -delete && find backup -name 'uploads-*.tar.gz' -mtime +14 -delete
```

Восстановление в чистую базу:

```bash
turso db create plus-in-plus-restore
turso db shell plus-in-plus-restore < backup/db-2026-10-15.sql
```

У Turso есть и point-in-time restore в пределах тарифа
(`turso db create new-db --from-db plus-in-plus --timestamp 2026-10-15T10:00:00Z`).
Своим sqld снимайте ещё и том Docker-контейнера (`~/sqld-data`).

---

## Проверка деплоя

```bash
# из каталога репозитория (любого компьютера):
npm run deploy:verify -- https://example.com
```

Ожидаемый вывод:

```text
[verify] /api/health → 200 {"status":"ok","database":{"driver":"libsql","remote":true,"tables":4}}
[verify] /            → 200
[verify] /shop        → 200
[verify] /blog        → 200
[verify] /sitemap.xml → 200
[verify] All checks passed.
```

Без репозитория достаточно: `curl https://example.com/api/health`.

- `200` + `status: ok` — база доступна, все 4 обязательные таблицы на месте;
- `503` + `schema-out-of-date` с `missingTables` — не выполнен `db:push` против этой базы;
- `503` + `unavailable` — неверные/отсутствующие `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN`
  или недоступная база.

Эндпоинт отдаёт только булевы значения (доступность, драйвер) — ни URL, ни токена,
ни данных; его можно держать открытым.

Ручной сценарий после первого деплоя:

1. Зарегистрироваться в шапке — вернулись на сайт залогиненным.
2. Войти с неверным паролем — `Invalid email or password.`
3. Зайти на `/admin/dashboard` не залогиненным — редирект на `/`.
4. Загрузить обложку услуги в `/admin/services/new` (после создания админа).

---

## Частые проблемы

| Симптом | Причина / решение |
| --- | --- |
| `502 Bad Gateway` от Apache | приложение не запущено или слушает не тот порт: `pm2 status`, `pm2 logs plus-in-plus`, `curl http://127.0.0.1:3000/api/health`, проверьте `ProxyPass` в конфиге |
| Сайт открывается, но вход/регистрация — «временно недоступны» | не задан `TURSO_DATABASE_URL` или `AUTH_SECRET` короче 32 символов в `.env` на сервере → пополнить и `pm2 restart plus-in-plus` |
| Форма отправляется, сессии нет, ошибки нет | база недоступна или не накачана схема: `set -a; source .env; set +a; npm run db:push; npm run db:check`, затем `curl <url>/api/health` |
| `table does not exist` (или пустой сайт после деплоя) | `db:push` не выполнялся против этой базы или `TURSO_DATABASE_URL` указывает не туда — применить схему продакшена и перепроверить `/api/health` |
| `/api/health` → `503 schema-out-of-date` с `missingTables` | выполнить `npm run db:push` с переменными продакшена |
| `npm run db:push` пишет «local file», хотя `.env` с Turso | скрипты читают окружение процесса: `set -a; source .env; set +a` **до** запуска команды |
| `Admin account not found. Please log in as a regular user.` | включен «Режим администратора», но в базе нет строки `ADMIN`/`MANAGER` — повысить роль (см. раздел ролей) |
| Вошли, но `/admin/*` кидает на `/` | сессия создана без переключателя — выйти, включить **Режим администратора**, войти снова |
| Понижение/блокировка админа «не работает» | действующая сессия не пересоздаётся сама: перелогиниться; права на сервере всё равно проверяются по базе |
| `Login is unavailable right now` после редактирования `.env` | не перезапущено приложение: `pm2 restart plus-in-plus` |
| Осталась `DATABASE_URL` и лог ругается | приложение больше не работает с PostgreSQL — удалите её, нужна только `TURSO_DATABASE_URL` |
| Аватар/обложка не отображается | файла нет в `public/uploads/…` или каталог недоступен на запись; при деплое каталог затёрли — восстановить из бэкапа |
| Пропали загруженные картинки после «очистки» | на сервере выполнили `git clean -fdx` / робот очистки — загрузки в `.gitignore`, Git сам их не удаляет; восстанавливайте из бэкапа и больше не чистите этот каталог |
| Первая страница после сборки грузится дольше | холодный старт/compile; на своём сервере нормализуется после прогрева (`curl` несколько страниц) |
| Сборка падает `JavaScript heap out of memory` | мало RAM — добавьте swap (шаг 0) |
| Apache отдаёт `413` / обложка не загрузилась | проверьте, что тело доходит до Node (`bodySizeLimit: 9mb` в `next.config.mjs`); в Apache `LimitRequestBody` не должен быть меньше 10 МБ |

---

## Безопасность — чек-лист

- `AUTH_SECRET` — уникален для окружения, ≥32 символов, никогда не в Git; при
  некорректном секрете авторизация **закрывается**, а не работает вполсилы.
- `.env*`, `prisma/dev.db*`, `lib/generated/`, `dump.sql`/`backup-*.sql`/`*.dump` —
  в `.gitignore`; проверяйте `git status` перед коммитом.
- Утечка токена БД: `turso db tokens invalidate <db> -y`, выпустить новый, обновить
  `.env` на сервере, перезапустить.
- Apache — единственная открытая точка входа (80/443); порт 3000 закрыт файрволом;
  заголовки `X-Forwarded-*`/`X-Real-IP` перезаписываются прокси.
- Продакшен отдаёт `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy`, `Permissions-Policy`; при HTTPS-`AUTH_URL` — ещё и HSTS.
- HTML статей санитизируется по allowlist перед сохранением и при публичном рендере.
- Лимиты на вход/регистрацию/смену профиля — внутри процесса (при нескольких
  инстансах добавьте общий лимит на прокси).
- Роли: регистрация никогда не создаёт `ADMIN`; мутации контента и запись журнала
  действий идут в одной транзакции.

---

## Дизайн-макеты и другие документы

- [DEPLOYMENT.md](DEPLOYMENT.md) — пошаговый док по Turso и окружению (англ.).
- Макеты страниц в корне репозитория: `Plus in Plus Site — Landing/Blog/Shop/…`
  (`.pdf`, `.png`, `.svg`).
- `docs/spectrum-ui-migration/` — заметки по миграции UI-кита.
- `.vscode/extensions.json` — рекомендуемые расширения (Prisma, SQLTools + SQLite).

### Краткие примечания по вёрстке

- **Шапка:** разделы `FOR PLAY`, `SHOP`, `ABOUT PIP`, `SOCNET` открывают выпадающее
  меню по наведению — чистый CSS (`group-hover`), шеврон поворачивается на 180°, панель
  задерживается ~200 мс после ухода курсора (чтобы успеть переехать через зазор).
  Клавиатурный доступ — через `group-focus-within`. На тач-раскладках — бургер-меню
  со всеми ссылками без выпадашек. Ссылки выпадашек: `/shop`-секции и реальные
  профили студии — константа `SOCIAL_LINKS` в начале `components/site/header.tsx`
  (заглушки заменить на настоящие аккаунты).
- **Подвал:** `components/site/footer.tsx` — серверный компонент на светло-синем
  брендовом фоне; клиентский только `footer-subscribe-form.tsx`. Блоки: CTA с
  кнопками → форма подписки + пять колонок ссылок (`FOOTER_COLUMNS`) → юридическая
  строка (`FOOTER_LEGAL_LINKS`, `© 2026 Plus In Plus.`) → крупный водяной знак
  «Plus in Plus» (`aria-hidden`, не ссылка). Ссылки с `href: "#"` — заглушки под
  несуществующие страницы (`/privacy-policy`, `/user-agreement`, `/offer`,
  `/terms-of-use`).
- **Формы-заглушки:** подписка в подвале и форма на `/contact` на клиенте
  сообщают, что отправка пока не подключена — подключите их к реальному endpoint,
  когда он появится.

---

## Приложение: вариант с Nginx

Если точкой входа окажется Nginx вместо Apache — идея и заголовки те же:

```nginx
# /etc/nginx/sites-available/plus-in-plus
server {
    listen 80;
    server_name example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name example.com;

    ssl_certificate     /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

    client_max_body_size 10m;          # обложки до 8 МБ + запас на multipart

    proxy_set_header Host              $host;
    proxy_set_header X-Forwarded-Host  $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_read_timeout 300s;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;    # WebSocket (нужен dev-серверу)
        proxy_set_header Connection "upgrade";
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/plus-in-plus /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d example.com     # если сертификат ещё не выпущен
```

Требования те же: `Host`/`X-Forwarded-Host` — публичный домен, `X-Forwarded-Proto` —
фактическая схема (`https` на 443), порт 3000 наружу не открывается.
