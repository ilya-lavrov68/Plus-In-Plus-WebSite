# Деплой Plus In Plus

Этот документ нужен для публикации сайта на сервере с доменом и HTTPS. Для обычного запуска на компьютере используйте пошаговую инструкцию в [`README.md`](README.md). Секреты храните в настройках хостинга или в серверном `.env`, **не в Git**.

### Короткий порядок

1. Установите Node.js `24.22.1+` и выполните `npm ci` в папке проекта.
2. Создайте базу Turso по разделу 2. Локальный `payload/pip.db` не подходит для сервера с временной файловой системой.
3. Заполните серверный `.env` по разделу 3. Главные значения: адрес и токен базы, два разных секрета и публичный HTTPS-адрес сайта.
4. Сделайте резервную копию существующей базы. Затем примените миграции по разделу 4 — они создают или обновляют таблицы.
5. Выполните `npm run build` и запустите сайт через PM2 по разделу 5. PM2 держит процесс запущенным и перезапускает его после сбоя.
6. Настройте Nginx и HTTPS по примерам в `README.md`. Nginx принимает запросы на домен и передаёт их локальному Node-процессу на порту 3000.
7. Проверьте `https://ваш-домен/api/health` и выполните сценарии из раздела 6.

Ниже те же шаги описаны подробно.

## 1. Что потребуется

- Node.js `24.22.1+`; та же major/minor линия закреплена в `.nvmrc` и CI.
- Код репозитория на сервере и установленные через `npm ci` пакеты.
- База Turso Cloud или свой совместимый libSQL/sqld-сервер.
- Nginx или другой HTTPS reverse proxy. Он должен заменять клиентские значения `Host`, `X-Forwarded-Host`, `X-Forwarded-Proto`, `X-Real-IP` и `X-Forwarded-For` значениями самого сервера, чтобы нельзя было подделать адрес сайта или посетителя.
- Постоянный диск для `public/uploads/`. Этих файлов нет в Git; на временном диске они исчезнут после пересоздания сервера.
- Для нескольких копий сайта — Upstash или аналогичное общее хранилище ограничений частоты запросов.

Сборка: `npm run build`. Запуск: `npm start`. Prisma и отдельный generated client больше не используются. Сама сборка не применяет схему к production: миграции запускаются только явной командой после backup и review.

## 2. Создание базы Turso

```bash
curl -sSfL https://get.tur.so/install.sh | bash
turso auth login
turso db create plus-in-plus
turso db show plus-in-plus --url
turso db tokens create plus-in-plus
```

Сохраните URL вида `libsql://plus-in-plus-<org>.turso.io` и token в secret manager. Для планируемой ротации можно выдавать token со сроком действия:

```bash
turso db tokens create plus-in-plus --expiration 90d
# Отзывает ВСЕ существующие tokens — выполнять только по approved runbook:
turso db tokens invalidate plus-in-plus -y
```

Windows: installer и shell-команды выполняйте в WSL или Git Bash.

## 3. Переменные окружения

| Переменная | Обязательность | Назначение |
| --- | --- | --- |
| `DATABASE_URL` | Да | Единый SQLite/libSQL target для сайта, auth, заказов и аналитики; в production обычно `libsql://…` |
| `PAYLOAD_DATABASE_AUTH_TOKEN` | Для Turso Cloud | Token доступа к единой БД |
| `AUTH_SECRET` | Да | Уникальный секрет не короче 32 символов |
| `AUTH_URL` | Да в production | Реальный HTTPS origin сайта |
| `NEXT_PUBLIC_SITE_URL` | Рекомендуется | Тот же публичный origin для SEO/sitemap |
| `WEBAUTHN_ORIGIN` | Для passkeys в production | Например, `https://www.example.com` |
| `WEBAUTHN_RP_ID` | Для passkeys в production | Hostname или родительский домен, например `example.com` |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Обе вместе для shared limits | Атомарные ограничения между инстансами |
| `PIP_CSP` | Нет | Пусто/`enforce` или `report-only`; production игнорирует `off` |
| `PIP_HIBP_CHECK` / `PIP_HIBP_REQUIRED` | Нет | Политика проверки скомпрометированных паролей |
| `ROBOKASSA_*` | Только для согласованной интеграции | Настройки платёжного provider |

`TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` поддерживаются только как aliases для существующего secret manager; вторую БД настраивать не нужно. Приоритет у canonical `PAYLOAD_*` переменных.

Генерация `AUTH_SECRET` (повторите отдельно для `PAYLOAD_SECRET`):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

`WEBAUTHN_ORIGIN` обязан использовать HTTPS в production. `WEBAUTHN_RP_ID` должен совпадать с hostname origin или быть его родительским доменом. Неверная пара значений должна блокировать passkey-операцию, а не silently ослаблять проверку.

`AUTH_SECRET` участвует и в Auth.js, и в выводе отдельного MFA encryption key через HKDF. Его ротация завершает существующие сессии и делает сохранённые TOTP secrets нечитаемыми: заранее подготовьте recovery и повторную настройку MFA.

Access/refresh durations и concurrent-session limit не дублируются в env. Их единственный источник — `lib/session-policy.ts`.

## 4. Backup и применение схемы

**Не запускайте миграции против реальной БД без review, проверенного backup и согласования.** Единая база содержит контент, аккаунты, auth-сессии, заказы, платежи и аналитику. Автоматический schema `push` отключён (`push: false`); старые Prisma/PostgreSQL-миграции не описывают текущую схему и не используются.

Порядок:

1. Сделать и проверить наличие backup БД и `public/uploads/`; для критичного окружения выполнить restore drill на isolated copy.
2. Проверить diff `db/schema.sql`, применить его к non-production копии и выполнить smoke tests.
3. Убедиться, что код и `db/schema.sql` соответствуют одному commit.
4. Проверить pending status и только после approval применить migrations к целевой БД:

```bash
set -a; source .env; set +a
npm run db:migrate
npm run db:check
```

PowerShell:

```powershell
$env:PAYLOAD_DATABASE_URL="libsql://plus-in-plus-<org>.turso.io"
$env:PAYLOAD_DATABASE_AUTH_TOKEN="<token>"
npm run db:migrate
npm run db:check
```

`db:check` только читает БД и проверяет обязательные прикладные таблицы. Не используйте демо-seed и не создавайте аккаунты с известными паролями в production. При последующих изменениях схемы правьте `db/schema.sql`, проверяйте diff и повторяйте весь процесс.

## 5. Сборка, запуск и HTTPS

```bash
npm ci
npm run build
pm2 start npm --name plus-in-plus -- start
pm2 save
pm2 startup
```

Node слушает только внутренний интерфейс за reverse proxy. Наружу открываются HTTP для redirect и HTTPS; порт Node не публикуется напрямую. Готовые примеры Nginx/Apache находятся в `README.md`.

Перед включением HSTS `includeSubDomains` проверьте HTTPS на всех поддоменах. Preload не настраивается. Production должен перенаправлять HTTP на HTTPS, выставлять secure cookies и сохранять enforcing nonce CSP. Внешние Security Headers и SSL Labs проверки выполняются отдельно на реальном endpoint; их оценки нельзя вывести из исходников.

## 6. Проверка deployment

```bash
npm run deploy:verify -- https://your-domain.example
curl -fsS https://your-domain.example/api/health
```

Ожидаемый health при актуальной схеме:

```json
{"status":"ok","database":{"driver":"libsql","remote":true,"tables":16}}
```

- `503 schema-out-of-date` и `missingTables`: схема не применена к этой БД.
- `503 unavailable`: endpoint/token/доступность БД требуют проверки; ответ не содержит connection string.
- Health не доказывает корректность MFA, платежей, RBAC или restore — нужны отдельные сценарии.

Ручной smoke после первого запуска:

1. Регистрация создаёт только `USER`.
2. Неверный пароль даёт generic credential error без раскрытия наличия аккаунта.
3. Гость и обычный клиент не попадают в `/admin`; manager видит разрешённые заказы, но не Accounts/customers и carts.
4. Upload перекодируется в WebP и доступен после restart при persistent storage.
5. RU/EN, keyboard, responsive и основные client flows проверяются в браузере по `docs/ui-ux-pro-max.md`.

## 7. Создание сотрудника и включение MFA

Регистрация всегда создаёт `USER`. После создания личного аккаунта:

```bash
set -a; source .env; set +a
npm run db:promote-admin -- you@example.com --founder
```

Для `ADMIN` или `MANAGER` используйте соответствующий флаг скрипта. `FOUNDER` нельзя назначить через админку.

Далее:

1. Выйти и войти с включённым **«Режимом администратора»**.
2. Если у staff-аккаунта ещё нет TOTP/passkey, он получает только customer-level session и направляется на `/profile?mfa=required`.
3. В профиле настроить TOTP или passkey и сохранить новые backup codes в защищённом менеджере.
4. Выйти и повторить staff login, подтвердив второй фактор.
5. Проверить отдельно обычный customer login: он не исчезает и не даёт staff-доступ.
6. На тестовом аккаунте дополнительно проверить совмещённый сценарий: зарегистрировать passkey, затем добавить TOTP, выйти и войти каждым фактором по очереди. Повторное использование уже завершённого pending login должно отклоняться.

TOTP setup переиспользует действующий pending enrollment между вкладками и атомарно выбирает один секрет. Форма подтверждения привязана к timestamp этого enrollment. Истёкший или заменённый QR возвращает отдельное `stale-setup` recovery: создать текущий QR и отсканировать его заново. Такой отказ не следует принимать за неверный код и не следует «исправлять» расширением TOTP window.

Если TOTP setup не начинается на реальной площадке, сначала выполнить `npm run db:check` и проверить redacted server event `auth.mfa.setup_failed`. Для нескольких инстансов `AUTH_SECRET` обязан быть одинаковым и не меняться между созданием QR и подтверждением кода: иначе pending/enabled secret невозможно расшифровать. Не отправлять в лог или тикет сам `AUTH_SECRET`, QR, otpauth URI, secret или введённый код. Passkey error после этого deploy не следует «исправлять» отключением origin/RP ID/challenge/UV/replay checks.

Если текущий QR успешно отсканирован, но Google Authenticator или другое совместимое приложение выдаёт неподходящий код:

1. Удалить прежние записи Plus In Plus для этого аккаунта в authenticator, ещё раз отсканировать именно текущий QR и ввести новый 6-значный код.
2. Включить автоматические дату и время на устройстве с authenticator.
3. На сервере проверить `date -u` и состояние NTP (`timedatectl` при наличии systemd): расхождение больше допустимого соседнего 30-секундного шага требует исправления времени, а не расширения `window: 1`.
4. Сопоставить время отказа только с redacted event `auth.mfa.failed`. Не добавлять в диагностику аккаунт, secret, QR или коды.

TOTP secret хранится зашифрованным; backup codes — только как hashes и принимаются однократно. Pending login живёт пять минут и имеет пять попыток; setup challenges — десять минут. Staff не может удалить свой последний второй фактор. При регенерации backup codes старые коды заменяются после подтверждения владельца.

Это поведение кода. Для operational MFA нужно реально включить факторы у каждого `FOUNDER`/`ADMIN`/`MANAGER`, проверить recovery и вести учёт; наличие колонок в БД не означает, что сотрудники уже защищены.

## 8. Сессии и отзыв доступа

Значения из `lib/session-policy.ts`:

- access session — 15 минут;
- refresh session — 7 дней с исходной absolute expiry;
- максимум три активные сессии на аккаунт; более старые отзываются при создании новой.

Refresh token хранится в БД только как hash, привязан к device hash и ротируется через same-origin `POST /api/auth/refresh`. Повторное использование старого token или race с уже изменённым hash отзывает активные сессии аккаунта. Неверное устройство не принимается. Production refresh/device cookies используют `__Secure-` prefix; marker `pip-refresh-present` не содержит секрета.

Проверить на staging с тестовыми аккаунтами:

- automatic refresh восстанавливает access session без недельного sliding JWT;
- старый refresh token после ротации отклоняется;
- logout отзывает текущую серверную сессию;
- смена пароля отзывает все активные сессии и требует нового входа;
- блокировка и понижение роли действуют без ожидания старого JWT expiry; понижение сохраняется в AuthSession, поэтому позднее повышение роли не восстанавливает staff mode без нового входа;
- четвёртая сессия оставляет не более трёх активных;
- cross-origin POST к refresh/payment получает `403`.

Unit tests с in-memory doubles не заменяют этот staging test и не доказывают distributed concurrency на реальной БД.

## 9. Платежи

Сейчас Robokassa не используется проектом для приёма реальных платежей. Цены и включение provider требуют подтверждения manager/founder и отдельной live-проверки.

Создание ссылки выполняется только через `POST /api/payment/create` с `application/x-www-form-urlencoded`, same-origin evidence, authenticated session и throttling. State-changing GET удалён. Клиент не назначает цену: заказ должен принадлежать ему (либо вызывающий имеет действующий staff session), иметь согласованную положительную сумму и статус `awaiting_payment`.

Result callback остаётся `/api/payments/robokassa/result` (алиас `/api/payment/result`). Не включайте публичный demo merchant в production. Unit tests и mocked invoices не являются evidence live payment.

## 10. Audit retention и приватность

CLI `db:audit-retention` по умолчанию выполняет dry-run для записей старше 365 дней:

```bash
set -a; source .env; set +a
npm run db:audit-retention -- --older-than-days=365
```

После утверждения политики, backup и проверки legal/incident holds apply требует отдельный ключ и явное подтверждение:

```bash
set -a; source .env; set +a
export AUDIT_PSEUDONYM_KEY="<отдельный-секрет-не-короче-32-символов>"
npm run db:audit-retention -- --older-than-days=365 --apply --confirm=PSEUDONYMIZE
```

Job снимает прямую `actorId`-связь, записывает HMAC-псевдоним и заменяет обнаруженные email/IPv4 в старых titles. Это псевдонимизация, а не гарантированная анонимизация или универсальное удаление по GDPR. Не меняйте ключ между запусками без отдельного плана: корреляция псевдонимов изменится. Не запускайте во время incident/legal hold без approval.

Автоматический production schedule не настроен этим репозиторным изменением. Политика retention, мониторинг job и удаление/псевдонимизация других data classes остаются эксплуатационными задачами.

## 11. Backup и восстановление

Пример export:

```bash
turso db shell plus-in-plus .dump > backup-$(date +%F).sql
tar czf uploads-$(date +%F).tar.gz public/uploads
```

Не храните archives в public web root или Git. Восстановление сначала выполняется в новой изолированной БД и директории:

```bash
turso db create plus-in-plus-restore
turso db shell plus-in-plus-restore < backup-YYYY-MM-DD.sql
```

Полная процедура, RPO/RTO и ransomware controls: `docs/security/disaster-recovery.md`. Наличие dump не доказывает восстановление; нужен изолированный restore drill.

## 12. CI и обновления

Существующий `.github/workflows/ci.yml` уже выполняет без реальных секретов:

1. `npm ci` и `npm run doctor`;
2. repository security audit и полный `npm audit`;
3. ESLint и TypeScript;
4. полный `npm test`;
5. `db:migrate` и read-only `db:check` на disposable SQLite;
6. production build;
7. HTTP smoke с health и ключевыми страницами;
8. отдельная проверка на `windows-latest` дополнительно выполняет `db:migrate` и `db:check`, чтобы эти команды продолжали работать с Windows-путями.

CI не подключается к staging/production и не применяет там схему. Не создавайте второй дублирующий workflow для тех же проверок.

Обновление VPS:

```bash
cd /opt/plus-in-plus
git pull --ff-only
npm ci
npm run build
# Если схема изменилась — сначала отдельный approved шаг из раздела 4.
pm2 restart plus-in-plus
npm run deploy:verify -- https://your-domain.example
```

Перед commit убедитесь, что реальные `.env`, dumps, локальные `payload/*.db`, `public/uploads/` и временные профили не попали в Git; `.env.example` с пустыми значениями должен оставаться. При утечке token сначала отзовите/ротируйте его у provider; удаление строки из Git не отзывает секрет.

## Диагностика

| Симптом | Проверка |
| --- | --- |
| `502 Bad Gateway` | `pm2 status`, `pm2 logs plus-in-plus`, внутренний `/api/health` |
| Staff получает `/profile?mfa=required` | Это ожидаемый enforcement: настроить MFA, затем повторить staff login |
| Привязка TOTP отклоняет код | Использовать текущий QR, удалить старую запись authenticator, включить автоматическое время; проверить `date -u`, NTP и redacted `auth.mfa.failed`. Не расширять TOTP window |
| Passkeys не работают в production | Проверить HTTPS, `WEBAUTHN_ORIGIN`, `WEBAUTHN_RP_ID` и соответствие hostname |
| Сессии исчезают после смены пароля | Ожидаемый глобальный отзыв; войти заново |
| Refresh возвращает `401` | Проверить refresh/device cookies, absolute expiry и revocation; не логировать tokens |
| POST payment/refresh возвращает `403` | Проверить same-origin origin и корректную перезапись forwarded headers proxy |
| Таблица отсутствует | Применить согласованную схему к нужной БД и повторить `db:check` |
| Uploads исчезают после deploy | Подключить persistent storage и отдельный backup |
