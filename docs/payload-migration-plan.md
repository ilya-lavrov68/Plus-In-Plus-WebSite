# План перехода админ-панели Plus In Plus на Payload

## 1. Статус документа

**Реализован первый рабочий vertical slice, но полный переход ещё не выполнен.** Установлен Payload `3.92.1`; `/payload` и `/api/payload` работают через отдельный `(payload)` root layout, GraphQL выключен. Существующие страницы перенесены в `(site)` без изменения URL. Старые `/admin`, `/manager`, Auth.js, MFA/passkeys, RBAC, заказы и прикладные API сохранены.

Текущий срез включает:
- отдельные `PAYLOAD_SECRET` и `PAYLOAD_DATABASE_URL`; запрет совпадения с Prisma/Turso-БД, `push: false` и reviewed `payload/migrations/20261031_195142_initial.ts`;
- Auth.js custom strategy на `requireAdmin()` с effective role `min(token, DB)`: только `ADMIN` / `FOUNDER`, без Payload password login; shadow-запись содержит лишь Auth.js ID, email и effective role;
- изолированную RU/EN `posts` collection с Lexical, slug, excerpt и draft/published status. Она **не подключена** к публичному сайту и не является завершённой схемой блога из раздела 5;
- явный Auth.js logout из Payload и staff guard для `/payload`; REST не заменяет прикладные endpoint'ы;
- synthetic unit tests и успешное применение миграции к одноразовой SQLite-БД.

Production-данные не копировались, Prisma-схема не менялась. Перенос существующего контента, services/media/settings, orders/custom views, drafts/versions/preview, cutover публичных reads и retirement старой панели остаются следующими этапами с go/no-go проверками.

Дата проверки внешних требований: **31 октября 2026 года**. Перед реализацией каждого этапа версии и официальные требования нужно проверить повторно и зафиксировать точные версии в lockfile.

## 2. Цель и границы

### Цель

Заменить самописную staff-панель на Payload Admin, сохранив все нужные проекту функции:

- услуги, варианты конфигурации и правила заказа;
- блог, Markdown/HTML, Canva embeds, импорт-превью и медиа;
- RU/EN-контент, публикации, черновики, предпросмотр и историю;
- публичные настройки, SEO, социальные ссылки и landing story;
- пользователей, роли `USER` / `MANAGER` / `ADMIN` / `FOUNDER` и manager scope;
- заказы, корзину, согласование цены, блокировки, платежные записи и аналитику;
- существующие customer/staff auth, TOTP, recovery codes, passkeys и отзываемые сессии;
- аудит, retention, приватность, rate limits, CSP и серверную валидацию.

### Не входит в понятие «переход на Payload»

- редизайн публичного сайта или перенос всех текстов в универсальный page builder;
- включение Robokassa или появление новых платёжных возможностей;
- замена Lumi/Kairo на рабочие интеграции;
- отказ от Prisma или Auth.js только ради технологической чистоты;
- автоматическая конвертация авторского контента в Lexical с риском потери разметки;
- перенос production-секретов в дампы, Git, тесты или миграционные отчёты.

**Главный принцип:** Payload становится админ-панелью и CMS, но не получает неограниченный доступ ко всем таблицам и операциям. Прикладные денежные, auth- и security-правила остаются в отдельных серверных сервисах.

## 3. Подтверждённые исходные ограничения

### 3.1. Платформа

Сейчас в проекте:

- Next.js `16.4.3`, React/React DOM `19.3.1`;
- Node engine `>=24.22.1`, `.nvmrc` и CI используют Node `24.22.1`;
- Prisma `6.19.3`, SQLite/libSQL/Turso;
- Auth.js `5.0.0-beta.32`;
- Next config уже имеет ESM-формат `next.config.mjs`.

Официальные [требования установки Payload](https://payloadcms.com/docs/getting-started/installation) на дату проверки:

- Node `^22.23.4 || >=24.22.1`;
- Next `15.2.9–15.2.x`, `15.3.9–15.3.x`, `15.4.11–15.4.x` или `16.2.6+`;
- Payload полностью ESM, существующее приложение подключается через `withPayload` и `app/(payload)`.

Актуальный `@payloadcms/next@3.92.1` дополнительно фиксирует в `peerDependencies` Next `>=16.3.3 <17` для линейки 16, поэтому выбранная `16.4.3` удовлетворяет не только общему installation guide, но и фактическому ограничению пакета.

**Платформенная несовместимость устранена.** Payload `3.92.1` и его Next/SQLite/Lexical/UI-пакеты зафиксированы в lockfile. `cacheComponents` не включать до отдельной проверки: документация Payload пока не гарантирует полную совместимость.

### 3.2. База данных

[SQLite adapter Payload](https://payloadcms.com/docs/database/sqlite) использует Drizzle/libSQL и умеет migrations, но он **не преобразует автоматически Prisma models и существующие строки** в Payload collections.

Обязательные правила:

- `push: false` и только явные reviewed migrations во всех общих средах;
- отдельный `migrationDir`, резервная копия и dry-run до применения;
- не запускать автоматическое удаление/пересоздание текущей схемы;
- не считать `beforeSchemaInit` автоматической миграцией данных;
- отдельно доказать поддержку существующих строковых CUID, timestamps, уникальных индексов и relations;
- если сохранение ID невозможно, использовать защищённую `legacyId → payloadId` mapping-таблицу и перестраивать все relations в одной управляемой миграции.

### 3.3. Маршруты

По умолчанию Payload занимает `/admin` и `/api`, которые уже используются проектом. На время coexistence:

- Payload Admin: `/payload`;
- Payload REST: `/api/payload`;
- GraphQL и GraphQL Playground: не публиковать;
- существующие `/admin`, `/manager`, `/api/auth`, `/api/cart`, `/api/support`, `/api/payment`: без изменений.

[Root routes Payload](https://payloadcms.com/docs/admin/overview#root-level-routes) требуют согласованного изменения и config, и структуры каталогов. После parity-проверок рекомендуется вернуть Payload Admin на `/admin`, а старые staff-ссылки заменить явными redirects. `/api/payload` оставить отдельным, чтобы не смешивать автоматический REST CMS с прикладными API.

## 4. Целевая архитектура

```text
Публичный Next.js сайт
  ├─ существующие RU/EN страницы и design system
  ├─ server-only read adapters → Payload Local API
  └─ customer auth / cart / support → прикладные серверные сервисы

Payload Admin (/payload на переходный период, затем /admin)
  ├─ collections и globals
  ├─ custom views для заказов и аналитики
  ├─ RBAC + field/document access на каждой операции
  └─ custom auth strategy → существующая проверенная staff session

Тот же Next.js server
  ├─ Payload Local API с явным overrideAccess: false там, где нужен user context
  ├─ Auth.js / MFA / WebAuthn / AuthSession без ослабления
  ├─ доменные операции заказов в транзакциях
  └─ Turso/libSQL + постоянное media-хранилище
```

### Почему не два независимых логина

Предпочтительный вариант — сохранить Auth.js как authentication layer и подключить Payload через [custom authentication strategy](https://payloadcms.com/docs/authentication/custom-strategies). Payload получает уже проверенную staff identity; customer password, TOTP, passkeys и session revocation не дублируются во вторую систему.

Встроенные cookies/JWT/sessions/lockout Payload полезны, но сами по себе не доказывают parity с текущими MFA/passkeys/effective-role правилами. Поэтому **не включать параллельный Payload password login и не отключать Auth.js, пока не принят отдельный auth ADR с полным набором тестов**.

До реализации нужен PoC одной auth-enabled `users` collection с существующими строковыми ID и `access.admin` только для staff. Если адаптер без дублирования пользователей невозможен, остановиться на architecture gate и рассмотреть отдельную `staff` collection с явной связью `authUserId`; не создавать две несинхронизированные роли молча.

### Local API не является автоматическим guard

По [документации Access Control](https://payloadcms.com/docs/access-control/overview), Local API по умолчанию пропускает access checks. Поэтому:

- публичные read adapters используют узкие server-only функции и явные `where` для published content;
- пользовательские операции выполняются с `req` и `overrideAccess: false`, либо остаются в существующих защищённых сервисах;
- custom endpoints считаются неаутентифицированными, пока не доказано обратное;
- автоматический REST не открывает публичный CRUD для users, orders, payments, audit или settings.

## 5. Модель данных и функции

### 5.1. Collections и globals

| Объект | Назначение и обязательные поля/функции |
|---|---|
| `posts` | `title`, `slug`, `excerpt`, `content`, `contentFormat`, `cover`, `images`, `readTime`, `source`, `sourceUrl`, `isFeatured`, `publishedAt`, SEO, автор; drafts/versions, scheduled publication, preview, RU/EN |
| `services` | Локализуемые title/descriptions/includes/shapes/result, `slug`, category, cover, sort, active/published; цена в копейках, `fixed/from/quote`, currency, `isOrderable`; вложенные option groups/options с delta/factor/default/required/sort |
| `products` | Сохранить существующую merch-модель: name, slug, description, price, cover, category, active, stock; скрытие раздела не означает удаление данных |
| `media` | Публичные cover/album images: file, alt, kind, dimensions, MIME, size, checksum, focal point, thumbnails; author-controlled usage |
| `private-media` | Аватары и другие непубличные файлы с отдельными access rules; не смешивать с публичной библиотекой |
| `users` | Профиль, email, role, blocked state, avatar relation; секреты MFA/password/refresh не показывать в Admin и не возвращать через API |
| `orders` | Customer, order number, cart key, status, currency, deadline, notes, manager, agreed price, lock metadata, timestamps; snapshots и totals не редактируются свободно |
| `order-items` | Service/product relation, item type, title/options snapshot, quantity, estimated/unit/total prices; историческая цена не меняется после редактирования каталога |
| `payments` | Provider, external ID, status, amount, currency, payment URL, timestamps; raw payload доступен только минимальному server-коду и не выводится в Admin |
| `activity-logs` | Append-only действие, entity, actor/pseudonym, timestamp; отдельный security audit, не заменяется versions |
| `page-views` | Consent-aware analytics, path, pseudonymous IDs, referrer/UTM, device, duration, createdAt; агрегаты в custom dashboard, retention без утечки PII |
| Global `site-settings` | Только публичные studio/contact/social/SEO-настройки с существующими лимитами и URL validation |
| Global `landing-story` | Heading, description и до 20 событий с уникальными стабильными ID; drafts/versions/preview, никаких выдуманных milestones |
| Global `integration-status` | Только вычисляемые server-side признаки «настроено/не настроено»; секретные значения не хранятся и не читаются в браузере |

Названия коллекций — проектные и уточняются на schema review. Существующие модели `PendingLogin`, `AuthSession`, `MfaBackupCode`, `WebAuthnCredential` остаются в auth-хранилище и **не становятся обычными редактируемыми Payload collections**.

### 5.2. Локализация RU/EN

Использовать [field-level localization](https://payloadcms.com/docs/configuration/localization) с `defaultLocale: "ru"` и явно заданным fallback только там, где он соответствует текущему UX.

До миграции:

1. Определить язык каждой существующей записи, не назначать всё автоматически русским или английским.
2. Перенести DB-версии услуг и `RU_SERVICE_COPY` из `lib/service-localization.ts` в согласованные locale-поля.
3. Сохранить slug/URL и существующие canonical/SEO-правила.
4. Не выполнять незаметный machine translation; отсутствующий перевод помечать в Admin.
5. Проверить fallback и пустые переводы: Payload предупреждает, что изменение `localized` у существующего поля меняет форму данных и требует отдельной миграции.

### 5.3. Блог и авторский редактор

Не конвертировать существующий контент в Lexical автоматически. Новая изолированная `posts` collection первого среза использует Lexical только для новых записей и не подключена к публичным статьям. Для существующих HTML/TipTap и Markdown при реальном cutover нужен custom Payload field component:

- `contentFormat` различает HTML и Markdown;
- текущий `renderPostContent` и sanitizer остаются серверной границей;
- local images, tables, footnotes и Canva embeds проходят round-trip без потери;
- Canva остаётся author-controlled, URL нормализуется, CSP/frame allowlist не расширяется для произвольных сайтов;
- source import создаёт/заполняет только черновик и никогда не публикует автоматически;
- SSRF guard, same-origin, rate limit, body limits и разрешённые VK/Telegram/YouTube источники сохраняются.

Lexical можно оценить позже отдельным решением после доказанного round-trip всех существующих статей; это не блокер перехода на Payload Admin.

### 5.4. Drafts, versions, preview и revalidation

Для `posts`, `services`, `landing-story` и публичных globals включить [Versions/Drafts](https://payloadcms.com/docs/versions/overview):

- черновик не попадает в публичные queries, sitemap, featured post, RSS/metadata или preview без авторизации;
- scheduled publication учитывает `publishedAt` и часовой пояс;
- autosave не изменяет опубликованную версию;
- restore версии проходит те же validations/access hooks;
- preview использует защищённый token с коротким сроком, конкретный маршрут и выход из preview;
- после publish/update/unpublish явно инвалидируются затронутые страницы, индексы, metadata, sitemap и связанные карточки;
- история версий не дублирует секреты и не заменяет append-only ActivityLog.

### 5.5. Медиа

[Upload collection](https://payloadcms.com/docs/upload/overview) даёт библиотеку и image sizes, но текущие ограничения остаются обязательными:

- avatars — до 2 MiB; covers — до 8 MiB, до 25 мегапикселей на входе и 2400 px на максимальной стороне после обработки;
- PNG/JPEG/WebP/GIF/AVIF только после проверки содержимого, не одного расширения;
- UUID/filename policy, авторские alt/подписи, корректные 4:3 recommendations без принудительного crop существующих работ;
- приватные avatars не отдаются публичным static route;
- remote URL upload отключён либо ограничен тем же SSRF/allowlist-подходом;
- production storage должно быть постоянным и резервироваться вместе с БД; ephemeral local disk недопустим;
- перенос файлов проверяется по размеру и cryptographic checksum, сами production-файлы не попадают в Git.

## 6. RBAC и security parity

### 6.1. Матрица доступа

| Роль | Итоговые возможности |
|---|---|
| `USER` | Нет Payload Admin; только собственный профиль, корзина, заказы и account-linked support |
| `MANAGER` | Только разрешённые operational orders и связанный ограниченный customer context; нет управления сайтом, ролями, секретами и founder-only действий |
| `ADMIN` | Услуги, блог, media, пользователи в текущем объёме и заказы; нет founder-only Settings, финансов и снятия блокировок |
| `FOUNDER` | Полный staff access, включая Settings, финансы, разблокировку заказов и управление ролями с защитой от самопонижения последнего основателя |

Матрица уточняется не по названиям экранов, а по существующим `requireStaff`, `requireAdmin`, `requireFounder`, order guards и тестам. Manager scope нельзя случайно расширить до общего списка пользователей или всех полей заказа.

### 6.2. Что должно совпасть поведение к поведению

- effective role остаётся минимальной между ролью в подписанном token и актуальной ролью в БД;
- понижение роли, блокировка и revoked session прекращают доступ без ожидания естественного истечения token;
- TOTP window, throttling, pending login expiry, backup-code single use и WebAuthn challenge/origin/RP/UV/replay правила не меняются;
- password hashes, MFA secrets, backup hashes, refresh hashes и provider secrets никогда не попадают в Admin DTO, versions, logs или REST;
- каждый collection/field/global access проверяется прямыми запросами, а не только скрытием кнопки;
- последний `FOUNDER` не может быть удалён или понижен без безопасной процедуры восстановления;
- actions, hooks и custom endpoints повторно проверяют права у операции;
- production остаётся HTTPS; CSP, nonce, frame-ancestors, HSTS и остальные security headers не ослабляются ради Admin UI.

### 6.3. Секреты и настройки интеграций

Сейчас часть integration secrets находится в `SiteSetting`. Целевое состояние — secret manager/environment, а не редактируемая CMS-запись:

1. Значения переносятся вручную через защищённый infrastructure channel, без миграционного дампа.
2. Admin показывает только boolean status и безопасную инструкцию, не значение.
3. После подтверждения работы секретные DB-поля удаляются отдельной reviewed миграцией с резервной процедурой.
4. Robokassa остаётся непринимающей платежи; перенос конфигурации не активирует provider.
5. Логи, ошибки и migration reports содержат только counts/status, не секреты и не PII.

## 7. Заказы, корзина, поддержка и платежи

Payload UI не заменяет доменную логику. Для этих операций создаются custom views/actions поверх серверных сервисов:

- quote request доступен для active + published услуги;
- самостоятельное добавление в корзину — только для active + published + `isOrderable` + не-`quote` услуги;
- options принадлежат выбранной услуге, required/default правила и расчёт цены выполняются на сервере;
- quantity ограничена, stock проверяется в транзакции, client totals не доверяются;
- order items сохраняют snapshots названий, опций и цен;
- переходы `cart → pending/quote_requested/negotiating → priced/awaiting_payment → paid/in_progress → completed/cancelled/refunded` проверяются state machine, а не свободным select;
- назначение менеджера, согласование цены, invoice regeneration, cancellation и founder-only unlock повторяют текущие guards;
- параллельные submit/webhook не создают дубли: сохраняются idempotency и уникальные `cartKey`, `orderNumber`, внешние идентификаторы;
- payment result не считается успешным по redirect пользователя; сохраняются server-side signature/state/amount/order проверки;
- `/api/support` остаётся authenticated-only и account-linked, без публичной Payload create-формы;
- клиент видит только собственные заказы; manager/admin/founder — строго свой scope;
- финансовые суммы в копейках, старый `finalPrice Float` не используется как новый источник истины без отдельного плана нормализации и сверки.

## 8. Поэтапная дорожная карта

Каждый этап — отдельный PR или серия небольших PR с независимым rollback. Переход к следующему возможен только после выполнения exit criteria.

### Этап 0. ADR, inventory и воспроизводимый baseline

**Работы:**

- зафиксировать целевые маршруты, identity strategy, media storage и список managed collections;
- выгрузить структурную inventory-схему без production-значений;
- записать текущие role/order/content/auth тесты и browser baseline;
- на synthetic data проверить CUID, relations, SQLite transactions, existing tables и Payload migrations;
- проверить стоимость/доступность persistent media storage и Turso backup/restore.

**Выход:** approved ADR, threat model, field mapping, список несовместимостей и go/no-go по identity/IDs.

### Этап 1. Platform upgrade без Payload

**Работы:**

- обновить Next до поддерживаемого `16.2.6+`, Node engine/CI и совместимые React-пакеты;
- адаптировать `next-intl`, Auth.js, Next config, lint/build scripts и тесты;
- не включать `cacheComponents`; не делать одновременно DB migration;
- повторить полный regression, security headers, auth и browser review.

**Выход:** production-parity staging на новой платформе, ноль новых функциональных изменений, понятный rollback.

### Этап 2. Пустой Payload shell и staff auth

**Работы:**

- добавить `payload`, `@payloadcms/next`, `@payloadcms/db-sqlite` фиксированных совместимых версий;
- обернуть config в `withPayload`, сохранить `withNextIntl`, CSP и analyzer;
- создать изолированный `app/(payload)` layout и маршруты `/payload`, `/api/payload`;
- удалить GraphQL routes, настроить `PAYLOAD_SECRET` через environment;
- подключить custom strategy к существующей staff session и `access.admin`;
- оформить PIP theme без теней, с 60/30/10 и доступными outlines.

**Выход:** сотрудник с валидной MFA/session видит пустую панель по роли; customer/blocked/revoked пользователь не видит; прямые API-тесты подтверждают deny-by-default.

### Этап 3. Контент, медиа и редакторы

**Работы:**

- реализовать `media`, `private-media`, `posts`, `services`, option arrays и globals;
- добавить RU/EN, drafts/versions/preview, custom TipTap/Markdown field и source import;
- перенести public queries за узкие read adapters с feature-controlled переключением;
- добавить revalidation и защиту draft/secret полей;
- провести editor UAT на реальных сценариях, но synthetic/staging данных.

**Выход:** весь текущий content workflow работает в `/payload`; старый Admin ещё доступен для rollback, двойной записи нет.

### Этап 4. Репетиция и переключение контента

**Работы:**

- сделать read-only snapshot, backup и restore rehearsal;
- запустить idempotent migration в staging, затем dry-run на защищённой production-копии;
- сверить counts, IDs/slugs, relations, timestamps, published states, locale samples, HTML/Markdown round-trip и media checksums;
- на коротком write freeze переключить reads/writes одного домена за раз: posts → services → globals;
- старые формы сделать read-only и затем удалить после наблюдения.

**Выход:** публичный сайт читает Payload, редакторы работают только в нём, нет расхождений и потери draft/published состояний.

### Этап 5. Заказы, пользователи, поддержка и аналитика

**Работы:**

- перенести orders/items/payments и связанные reads через отдельные reviewed migrations;
- реализовать custom order views, state actions, manager scope, customer directory и founder-only finance/unlock;
- переключить cart/checkout/support только после contract- и concurrency-тестов;
- перенести ActivityLog/PageView либо оставить их в существующем хранилище за custom dashboard — решение фиксируется по измеренной сложности, без потери retention;
- репетировать rollback на денежных и связанных записях отдельно от контента.

**Выход:** полный order lifecycle и support parity, согласованные суммы/relations, отсутствие cross-customer доступа и duplicate operations.

### Этап 6. Финальный cutover и удаление старой панели

**Работы:**

- перенести Payload Admin на `/admin`, добавить redirects из старых collection/manager URLs;
- удалить старые `/admin`/`/manager` формы только после периода наблюдения и подтверждённого rollback-плана;
- оставить публичные `/login`, `/profile`, `/cart` и прикладные API;
- обновить README, DEPLOYMENT, SECURITY, runbooks, CI и инструкции редакторов;
- выполнить полный release review и зафиксировать версии/backup/restore evidence.

**Выход:** одна staff-панель Payload, нет параллельных источников истины и неиспользуемых privileged routes.

## 9. Миграция данных и rollback

### 9.1. Обязательный формат миграции

1. **Backup:** snapshot Turso + media + текущий commit/config; проверить возможность восстановления, а не только наличие файла.
2. **Dry-run:** read-only source, временная target БД, никаких production secrets в отчёте.
3. **Manifest:** source ID, target ID, entity type, content/file checksum и статус; защищённый артефакт вне Git.
4. **Batches:** ограниченные транзакции, повторный запуск не создаёт дубликаты, ошибка останавливает затронутый batch.
5. **Validation:** количество записей плюс бизнес-инварианты и выборочное содержимое.
6. **Freeze/switch:** короткая остановка записи только для переключаемого домена, затем одно атомарное с точки зрения приложения переключение.
7. **Observe:** ошибки, latency, failed jobs, revalidation и пользовательские сценарии без логирования PII.

### 9.2. Инварианты сверки

- уникальные email, slug, order number, cart key и external payment ID сохранены;
- нет orphan order/items/options/relations;
- totals и payment amounts совпадают до копейки, агрегированные суммы контрольной выборки совпадают;
- statuses, manager/lock/agreed/published timestamps не изменили смысл;
- опубликованное осталось опубликованным, черновик не стал публичным;
- RU/EN и source content проходят одинаковый sanitized render;
- файлы открываются, размеры и checksums совпадают;
- auth secrets не сравниваются через вывод значений: проверяются только безопасные counts и synthetic login proofs.

### 9.3. Rollback без потери новых данных

- До появления новых записей допустимо переключить read/write adapter обратно на прежний источник.
- После появления новых записей нельзя просто вернуть старую БД: сначала экспортировать и подтвердить delta либо выполнить обратную миграцию.
- При повреждении миграции остановить запись, восстановить согласованный snapshot БД + media и повторить auth/order smoke tests.
- Rollback не должен требовать ослабления auth, отключения CSP или публикации секретов.

## 10. Проверки и критерии готовности

### Автоматические проверки

- TypeScript, ESLint, production build, весь существующий test suite и новые Payload tests;
- access matrix для каждой collection/global/field и прямых REST/Local API вызовов;
- denied cases для customer, blocked user, revoked session и чужого order;
- auth parity: TOTP, backup codes, passkeys, pending expiry, throttling, role downgrade;
- order state machine, quote/orderable rules, snapshots, totals, stock, concurrent checkout и webhook idempotency;
- drafts/preview/publish/unpublish/schedule, RU/EN fallback, revalidation и sitemap;
- sanitizer, Canva allowlist, Markdown/HTML round-trip, SSRF/rate/body limits;
- upload limits, MIME/signature, private media и checksums;
- migrations повторяемы на synthetic snapshot, restore rehearsal проходит;
- `npm audit` и security review обязательны; не применять `npm audit fix --force` и не скрывать новые advisories.

### Browser/UAT

- `USER`, `MANAGER`, `ADMIN`, `FOUNDER` проходят свои разрешённые и запрещённые сценарии;
- редактор создаёт RU/EN черновик, добавляет media/Canva, делает preview, публикует, восстанавливает версию и снимает публикацию;
- менеджер проводит заказ от quote до согласованной цены без доступа к founder-only функциям;
- клиент видит только свои заказы и использует account-linked support;
- клавиатура, focus, RU/EN, длинный контент, mobile/desktop, reduced motion и отсутствие horizontal overflow;
- PIP-оформление Admin соблюдает 60/30/10 и не использует тени/ring-as-shadow;
- console/network не содержат секретов, PII, необработанных provider payloads и новых ошибок.

### Финальный go/no-go

Переход завершён только если:

- нет двух активных источников записи для одной сущности;
- все текущие staff-функции имеют работающий эквивалент или явно утверждённое исключение;
- auth/RBAC/MFA/manager scope и order/payment boundaries доказаны тестами;
- backup и restore реально проверены;
- rollback после новых записей имеет исполнимую delta-процедуру;
- production-наблюдение стабильно, документация и редакторские инструкции обновлены.

## 11. Решения первого среза и оставшиеся gates

1. Platform upgrade на Next 16 и новый Node engine как обязательный первый этап.
2. Сохранение Auth.js/MFA через custom Payload strategy вместо второго password login.
3. Финальный адрес `/admin` с временным `/payload` и постоянным `/api/payload`.
4. Постоянное production media-хранилище и процедура его резервного копирования.
5. Перенос integration secrets из CMS в environment/secret manager.
6. Сохранение TipTap/Markdown вместо немедленной конвертации в Lexical.
7. Последовательность cutover: контент раньше заказов, без необоснованного big bang.

Пункты 1–3 реализованы в изолированном vertical slice. Остальные решения и любой production cutover по-прежнему требуют отдельного утверждения, backup/restore и parity-доказательств; текущая реализация не разрешает перенос production-данных или отключение старой панели.

## 12. Официальные источники

- [Payload Installation](https://payloadcms.com/docs/getting-started/installation) — Node/Next requirements, ESM, `withPayload`, `app/(payload)`.
- [Payload SQLite](https://payloadcms.com/docs/database/sqlite) — Drizzle/libSQL, migrations, `push`, transactions и schema hooks.
- [Payload Authentication](https://payloadcms.com/docs/authentication/overview) и [Custom Strategies](https://payloadcms.com/docs/authentication/custom-strategies) — built-in auth и границы пользовательской интеграции.
- [Payload Access Control](https://payloadcms.com/docs/access-control/overview) — collection/global/field rules и поведение Local API.
- [Payload Versions](https://payloadcms.com/docs/versions/overview) — versions, drafts, autosave и история.
- [Payload Localization](https://payloadcms.com/docs/configuration/localization) — field-level RU/EN и миграционные последствия localized fields.
- [Payload Uploads](https://payloadcms.com/docs/upload/overview) — media collection, image sizes, MIME и file access.
- [Payload Admin routes](https://payloadcms.com/docs/admin/overview#root-level-routes) и [REST API](https://payloadcms.com/docs/rest-api/overview) — разделение маршрутов и custom endpoints.
