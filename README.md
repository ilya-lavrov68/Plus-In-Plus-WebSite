# Plus In Plus — Web Platform

Официальная веб-платформа **Plus In Plus** объединяет два направления: существующую дизайн-практику и анонсируемые ИИ-технологии. На сайте — витрина дизайн-услуг с конфигуратором опций и корзиной, презентация ИИ-агентов Lumi Q1 и Kairo, двухшаговая форма брифа и заявок с прямой записью в БД, блог со статьями и галереями, личный кабинет клиента, рабочее место менеджера и полная админ-панель. Фирменный акцент интерфейса — `#FFFF01`.

**Стек текущей версии:**
`Next.js 15 (App Router)` · `React 18` · `TypeScript` · `Tailwind CSS 4` · `Shadcnblocks UI (палитра Hero 138)` · `Motion` · `Prisma 6 + libSQL / SQLite (Turso)` · `Auth.js v5` · `next-intl (RU / EN)` · `TipTap` · `Robokassa` · `Sharp (WebP)`

---

## Быстрый старт: Локально (VS Code) vs Сервер (Продакшен)

Ниже — параллельный гайд в **2 колонки**: слева запуск для локальной разработки через **VS Code**, справа — боевой деплой на **VPS-сервер (Linux)**.

<table width="100%">
<thead>
<tr>
<th width="50%" align="left">💻 Локально через VS Code</th>
<th width="50%" align="left">🚀 На сервере (Продакшен / VPS)</th>
</tr>
</thead>
<tbody>
<tr>
<td valign="top" width="50%">

### 1. Подготовка окружения

Установите:
- **Node.js `20.19+` или `22 LTS`** (`node -v`)
- **Git** и **VS Code**

Откройте проект в VS Code — редактор сам предложит поставить рекомендуемые расширения из `.vscode/extensions.json` (*Prisma*, *SQLTools + SQLite*, *DotENV*). Отдельный сервер БД ставить **не нужно** (работает локальный SQLite-файл).

</td>
<td valign="top" width="50%">

### 1. Подготовка сервера и БД

На Ubuntu / Debian VPS (`2 vCPU / 2 GB RAM`, открыты порты `22, 80, 443`):

```bash
sudo apt update && sudo apt install -y \
  git curl nginx certbot python3-certbot-nginx
curl -fsSL https://deb.nodesource.com/setup_22.x \
  | sudo -E bash -
sudo apt install -y nodejs && sudo npm i -g pm2
```

Создайте облачную БД **Turso** (или локальный `sqld` в спойлере ниже):

```bash
curl -sSfL https://get.tur.so/install.sh | bash
turso auth login
turso db create plus-in-plus
turso db show plus-in-plus --url
turso db tokens create plus-in-plus
```

</td>
</tr>
<tr>
<td valign="top" width="50%">

### 2. Клонирование и пакеты

Откройте встроенный терминал VS Code (`` Ctrl+` ``) или используйте `Git: Clone`:

```bash
git clone https://github.com/ilialavrov227-prog/Plus-In-Plus-WebSite.git
cd Plus-In-Plus-WebSite
npm install
```

> В репозитории уже настроен `.npmrc` (`legacy-peer-deps=true`), а `postinstall` автоматически генерирует Prisma-клиент.

</td>
<td valign="top" width="50%">

### 2. Клонирование в `/opt` и пакеты

Клонируйте проект в рабочую директорию и установите зависимости (до сборки `NODE_ENV` не должен скрывать `devDependencies`):

```bash
sudo mkdir -p /opt/plus-in-plus
sudo chown "$USER":"$USER" /opt/plus-in-plus
git clone https://github.com/ilialavrov227-prog/Plus-In-Plus-WebSite.git \
  /opt/plus-in-plus
cd /opt/plus-in-plus
npm ci
```

</td>
</tr>
<tr>
<td valign="top" width="50%">

### 3. Файл `.env` для локалки

Скопируйте шаблон `.env.example` → `.env` и сгенерируйте `AUTH_SECRET` (≥ 32 символов):

**macOS / Linux / Git Bash:**
```bash
cp .env.example .env
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Windows PowerShell:**
```powershell
Copy-Item .env.example .env
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Вставьте ключ в `AUTH_SECRET="..."` внутри `.env`, а для базы оставьте:
```env
TURSO_DATABASE_URL="file:./prisma/dev.db"
```

</td>
<td valign="top" width="50%">

### 3. Боевой файл `.env`

Создайте `/opt/plus-in-plus/.env` из шаблона и сгенерируйте секрет:

```bash
cp .env.example .env
openssl rand -base64 32
nano .env
```

Обязательный минимум в `.env` на сервере плюс WebAuthn-настройки, если используются passkeys:
```env
TURSO_DATABASE_URL="libsql://plus-in-plus-org.turso.io"
TURSO_AUTH_TOKEN="ваш_токен_turso"
AUTH_SECRET="ваш_секрет_от_32_символов"
AUTH_URL="https://example.com"
NEXT_PUBLIC_SITE_URL="https://example.com"
WEBAUTHN_ORIGIN="https://example.com"
WEBAUTHN_RP_ID="example.com"
```

Для production passkeys обе `WEBAUTHN_*` настройки обязательны. RP ID записывается как ASCII hostname; для международного домена используйте его Punycode-форму. Подробности и остальные переменные — в `DEPLOYMENT.md` и `.env.example`.

</td>
</tr>
<tr>
<td valign="top" width="50%">

### 4. Схема БД и демо-данные

Создайте таблицы в `prisma/dev.db` и при необходимости залейте готовые демо-услуги, статьи и тестовые аккаунты:

```bash
npm run db:push
npm run db:seed-demo
npm run db:check
```

Локальные демо-аккаунты (`seed-demo`, служебные роли входят с включённым переключателем **«Режим администратора»**):
- **FOUNDER:** `founder@plusinplus.test` / `FounderPassphrase123`
- **ADMIN:** `admin@plusinplus.test` / `AdminPassphrase123`
- **MANAGER:** `manager@plusinplus.test` / `ManagerPassphrase123`
- **USER:** `user1@plusinplus.test` / `ClientPassphrase123`

</td>
<td valign="top" width="50%">

### 4. Применение схемы БД

**Сначала backup, review и проверка на non-production копии.** Текущее изменение additive, но `prisma db push` на SQLite может пересоздавать таблицы при других изменениях; не подтверждайте потерю данных автоматически. Реальная БД в ходе репозиторной работы не изменялась.

После согласования экспортируйте переменные `.env` в текущую сессию терминала и примените схему (`seed-demo` на продакшене **не используется**):

```bash
set -a; source .env; set +a
npm run db:push
npm run db:check
```

После запуска сайта зарегистрируйте свой личный аккаунт через `/signup` и выдайте ему роль основателя (`FOUNDER` — полный доступ, включая настройки оплаты и финансы; из админки эту роль выдать нельзя):

```bash
set -a; source .env; set +a
npm run db:promote-admin -- you@domain.ru --founder
```

После повторного staff login настройте TOTP или passkey в профиле, сохраните backup codes и снова войдите уже со вторым фактором. Пока MFA не настроена, staff-доступ не выдаётся. `/api/health` для актуальной схемы должен сообщать `tables: 17`.

</td>
</tr>
<tr>
<td valign="top" width="50%">

### 5. Запуск и отладка

Запустите dev-сервер:

```bash
npm run dev
```

Если `node_modules` устарел после `git pull` (обычный симптом — `Module not found: Can't resolve '…'`
и 500 на всех страницах), `npm run dev` сам это заметит, назовёт недостающие пакеты и выполнит
`npm install`. Отключить автоустановку: `PIP_NO_AUTO_INSTALL=1 npm run dev`.

Полная проверка окружения (пакеты, lock-файл, Prisma-клиент, БД, `AUTH_SECRET`, версия Node):

```bash
npm run doctor
```

- Сайт: `http://localhost:3000`
- Админка: войдите на `/login` с включённым тумблером **«Режим администратора»**. При уже настроенной MFA откроется `/admin/dashboard`; без второго фактора staff получит только клиентскую сессию и будет направлен на `/profile?mfa=required` для настройки
- Просмотр БД в браузере: `npx prisma studio` (`http://localhost:5555`)

</td>
<td valign="top" width="50%">

### 5. Сборка, PM2 и HTTPS

Соберите production-бандл и запустите через **PM2** на `127.0.0.1:3000`:

```bash
npm run build
pm2 start npm --name plus-in-plus -- start
pm2 save
pm2 startup
```

Подключите Nginx или Apache + SSL Certbot (готовые конфиги в спойлере ниже) для проксирования `443 → http://127.0.0.1:3000`.

</td>
</tr>
<tr>
<td valign="top" width="50%">

### 6. Проверка перед коммитом

Единая проверка кода, типов, тестов и сборки:

```bash
npm run security:audit
npm run security:dependencies
npm run lint
npx tsc --noEmit
npm test
npm run build
```

</td>
<td valign="top" width="50%">

### 6. Обновление версии на сервере

Деплой свежих изменений без потери БД и `public/uploads/`:

```bash
cd /opt/plus-in-plus
git pull --ff-only && npm ci && npm run build
# Только если схема изменилась и уже есть backup + approval:
set -a; source .env; set +a
npm run db:push
npm run db:check
pm2 restart plus-in-plus
npm run deploy:verify -- https://example.com
```

</td>
</tr>
</tbody>
</table>

---

## Готовые конфиги для сервера (спойлеры)

<details>
<summary><b>🌐 Конфиг Nginx + SSL Certbot (рекомендуемый вариант)</b></summary>

Создайте `/etc/nginx/sites-available/plus-in-plus` (замените `example.com` на ваш домен):

```nginx
server {
    listen 80;
    server_name example.com;

    client_max_body_size 10m;

    proxy_set_header Host              $host;
    proxy_set_header X-Forwarded-Host  $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_read_timeout 300s;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Активируйте сайт и выпустите бесплатный HTTPS-сертификат:

```bash
sudo ln -s /etc/nginx/sites-available/plus-in-plus /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d example.com
```

</details>

<details>
<summary><b>🪶 Конфиг Apache Reverse Proxy + SSL Certbot</b></summary>

Включите модули проксирования:

```bash
sudo a2enmod proxy proxy_http headers rewrite
```

Создайте `/etc/apache2/sites-available/plus-in-plus.conf`:

```apache
<VirtualHost *:80>
    ServerName example.com

    ProxyRequests Off
    ProxyPreserveHost On
    ProxyTimeout 300
    LimitRequestBody 10485760

    RequestHeader set X-Forwarded-Proto "http"
    RequestHeader set X-Forwarded-Host "example.com"
    RequestHeader set X-Real-IP "%{REMOTE_ADDR}s"
    RequestHeader unset X-Forwarded-For

    ProxyPass / http://127.0.0.1:3000/
    ProxyPassReverse / http://127.0.0.1:3000/
</VirtualHost>
```

Включите конфиг и выпустите SSL:

```bash
sudo a2ensite plus-in-plus && sudo a2dissite 000-default
sudo systemctl reload apache2
sudo certbot --apache -d example.com
```

> **Важно:** после работы Certbot проверьте в созданном `/etc/apache2/sites-available/plus-in-plus-le-ssl.conf` (`<VirtualHost *:443>`), чтобы стояло `RequestHeader set X-Forwarded-Proto "https"`, и выполните `sudo systemctl reload apache2` — иначе Auth.js не выставит защищённую `https`-cookie сессии.

</details>

<details>
<summary><b>🗄️ Свой libSQL-сервер (Docker sqld) вместо Turso Cloud и бэкапы</b></summary>

Если база должна крутиться прямо на вашем VPS без облака Turso:

```bash
mkdir -p ~/sqld-data
docker run -d --name sqld --restart unless-stopped \
  -e SQLD_NODE=primary \
  -p 127.0.0.1:8080:8080 \
  -v "$HOME/sqld-data:/var/lib/sqld" \
  ghcr.io/tursodatabase/libsql-server:latest
```

В `.env` на сервере укажите `TURSO_DATABASE_URL="http://127.0.0.1:8080"` и оставьте `TURSO_AUTH_TOKEN=""`.

**Ежедневный бэкап базы и загруженных картинок (`public/uploads`):**

```bash
mkdir -p /opt/plus-in-plus/backup && cd /opt/plus-in-plus
set -a; source .env; set +a
turso db shell plus-in-plus .dump > backup/db-$(date +%F).sql
tar czf backup/uploads-$(date +%F).tar.gz public/uploads
```

> Никогда не запускайте `git clean -fdx` на сервере — пользовательские аватары и обложки хранятся в `public/uploads/` вне Git.

</details>

<details>
<summary><b>💳 Подключение оплаты Robokassa</b></summary>

Сейчас реальные платежи через Robokassa в проекте не принимаются; включение требует подтверждения цен manager/founder и отдельной live-проверки. Без ключей сайт полностью работоспособен: клиент отправляет заявку, а менеджер согласует стоимость и выставляет счёт в БД без кнопки онлайн-оплаты. Для согласованного тестирования платёжных ссылок заполните в `.env`:

```env
ROBOKASSA_MERCHANT_LOGIN="ваш_логин"
ROBOKASSA_PASSWORD1="пароль_1"
ROBOKASSA_PASSWORD2="пароль_2"
ROBOKASSA_TEST_MODE=""       # "1" для тестов, пусто для боевых оплат
ROBOKASSA_HASH_ALGO="md5"
```

В личном кабинете Robokassa укажите:
- **Result URL:** `https://<домен>/api/payments/robokassa/result`
- **Success URL:** `https://<домен>/payment/success`
- **Fail URL:** `https://<домен>/payment/fail`

</details>

<details>
<summary><b>🛠️ Частые проблемы и быстрые решения</b></summary>

| Симптом | Причина и решение |
| --- | --- |
| `502 Bad Gateway` | Приложение не запущено на `:3000` → проверьте `pm2 status`, `pm2 logs plus-in-plus` и `curl http://127.0.0.1:3000/api/health`. |
| Staff не попадает в `/admin/dashboard` | Проверьте, что включён **«Режим администратора»** и пройден второй фактор. Если открыт `/profile?mfa=required`, сначала настройте TOTP/passkey, сохраните backup codes и повторите вход. |
| Google Authenticator отклоняет код при первичной привязке | Создайте текущий QR, удалите прежнюю запись Plus In Plus для аккаунта в приложении и отсканируйте QR заново. Включите автоматические дату и время на телефоне; если отказ сохраняется, проверьте `date -u`/NTP на сервере и только redacted event `auth.mfa.failed`. Не расширяйте TOTP window и не отправляйте QR/secret/code в тикет. |
| Вход/регистрация пишут «временно недоступны» | На сервере не задан `TURSO_DATABASE_URL` или `AUTH_SECRET` короче 32 символов → заполните `.env` и выполните `pm2 restart plus-in-plus`. |
| `npm run db:push` пишет в локальный `dev.db` вместо Turso | Скрипты `db:*` читают переменные окружения шелла → перед запуском выполните `set -a; source .env; set +a`. |
| `JavaScript heap out of memory` при `npm run build` | На VPS с 1 ГБ RAM добавьте swap 2 ГБ: `sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile`. |

</details>

---

## Безопасность

- Проверки репозитория: `npm run security:audit` и `npm run security:dependencies` (полный `npm audit`, также запускается в существующем CI).
- MFA включает TOTP, WebAuthn/passkeys и одноразовые hashed backup codes. Staff без второго фактора получает только клиентскую сессию и обязан сначала настроить MFA.
- Access/refresh sessions, rotation/reuse detection, device binding и лимит трёх сессий описаны в `DEPLOYMENT.md`; значения берутся из `lib/session-policy.ts`.
- Оценка OWASP/NIST CSF 2.0/MITRE ATT&CK, результаты проверок, оставшиеся риски и план: [`docs/security/README.md`](docs/security/README.md).
- Runbooks: [реагирование на инциденты](docs/security/incident-response.md), [GDPR и приватность](docs/security/gdpr.md), [backup/DR/ransomware](docs/security/disaster-recovery.md).
- Приватное сообщение об уязвимости: [`SECURITY.md`](SECURITY.md).

Для production обязательны HTTPS-only reverse proxy, проверенные secure cookies, `WEBAUTHN_*` для passkeys, `UPSTASH_*` для общего rate limiting при нескольких инстансах и внешние проверки TLS/заголовков. Production отправляет HSTS `includeSubDomains`, поэтому до запуска необходимо проверить HTTPS на всех поддоменах; preload-лист не используется. Документы и тесты не заменяют penetration test, restore drill или инфраструктурный аудит.

### Обязательный UI/UX-документ

Перед изменением интерфейса читайте [`docs/ui-ux-pro-max.md`](docs/ui-ux-pro-max.md): постоянный стандарт доступности, адаптивности, микроанимаций, производительности и browser evidence, закреплённый также в `AGENTS.md`.

### ИИ-направление и shader-визуализации

- `/ai` — презентация анонса, а не запущенный AI-сервис. До отдельной интеграции на странице нет чата, выполнения кода или отправки юридических запросов. Lumi Q1 позиционируется как кодирующий агент; Kairo — как информационный помощник по праву РФ, не заменяющий юриста.
- Собственные GLSL shaders находятся в `lib/agent-shaders.ts`, управление воспроизведением — в `components/ai/agent-shader-player.tsx`, статичный fallback — в `components/ai/agent-diagram.tsx`. Внешние текстуры, новые runtime-зависимости и сетевые запросы не используются.
- Одна последовательность длится 8,4 секунды и завершается. Есть pause/resume/replay, остановка вне viewport/скрытой вкладки, reduced-motion и no-WebGL fallback. Правила и browser-чек-лист зафиксированы в `AGENTS.md`.
- Установщик `illos@0.1.1` требует отдельную лицензию Illos Pro и `ILLOS_KEY`; текущая реализация создана без Illos с явного разрешения пользователя. Не выдавайте её за результат Illos и не сохраняйте лицензионный ключ в репозитории.

### Комплексная разработка и оптимизация

Перед любой разработкой или проверкой применяйте [`docs/agent-workflow.md`](docs/agent-workflow.md): он требует завершать не только UI, но и связанные server/data/auth/mutation/error/revalidation слои с end-to-end доказательствами. Для оптимизации дополнительно используйте [`docs/next-forge-optimization.md`](docs/next-forge-optimization.md): там отделены изученные практики `vercel/next-forge` от решений PIP и обозначены будущие измеримые этапы без автоматической смены архитектуры.

Воспроизводимые baselines, результаты последовательных пакетов и границы доказанности находятся в [`docs/performance-baseline.md`](docs/performance-baseline.md). Для новой bundle-карты выполните `npm run analyze`: это отдельная production-сборка с reports в `.next/analyze/`; analyzer не включается в обычный runtime.

## Что внутри текущей версии сайта

| Маршрут | Блок UI / Модуль | Назначение |
| --- | --- | --- |
| `/` (`/[locale]`) | `Navbar 10` · `Hero 138` · `BrandDirections` · `Feature 314` · `Community 3` · `Blog 11` · `CTA 13` · `Footer 7` | Главная в тёмной палитре с фирменным акцентом `#FFFF01`: два равноправных направления — ИИ и дизайн, партнёры, статьи блога и призыв к действию |
| `/ai` | `AiPageView` · `AgentShaderPlayer` · `AgentDiagram` | Анонс Lumi Q1 и Kairo с текстовыми сценариями и конечными WebGL-визуализациями; рабочие чат, код и юридические запросы не имитируются |
| `/services` | `ServicesCatalogView` · `ServiceCard` | Каталог активных опубликованных услуг из БД с переходом к конфигуратору и добавлением в корзину |
| `/shop` | `ShopCatalogView` | Каталог активных товаров; пока товаров нет, показывает локализованную заглушку и остаётся `noindex` |
| `/shop/[slug]` | `Product Detail 1` + конфигуратор | Карточка услуги из БД с расчётом опций, добавлением в корзину и быстрой заявкой |
| `/contact` | `ContactOrderForm` + `createOrder` | Выбор нескольких услуг и отправка брифа в БД; legacy `POST /api/support` доступен только авторизованному клиенту |
| `/blog`, `/blog/[slug]` | `Blog 11` · `Blogpost 11` | Публикации с фильтрацией по категориям, обложками, цитатами и санитизированной вёрсткой |
| `/cart` | Единая корзина и заказы `Order` / `OrderItem` + `OrderCard` | Корзина и список заказов на одной странице: услуги и товары с серверной проверкой цены и остатков, отправка одной заявки на согласование, статусы и счета по отправленным заказам, отмена своего неоплаченного заказа |
| `/login`, `/register`, `/signup` | `SignUp 10` + `AccountModal` | Локализованные вход и регистрация с отдельным режимом служебного входа |
| `/orders` | Редирект на `/cart` | Отдельной страницы заказов больше нет: корзина и заказы объединены на `/cart`. Маршрут сохранён для старых ссылок и возврата с оплаты |
| `/profile` | `ProfileForm` · `SecuritySettings` · `SessionRefresh` | Профиль, аватар, смена пароля с отзывом старых сессий, TOTP/passkeys, backup codes и refresh короткой access session |
| `/manager/orders/*` | Кабинет `MANAGER` | Обработка заявок клиентов, согласование итоговой цены, выставление счёта, фиксация цены с блокировкой заказа и смена статусов |
| `/admin/*` | Панель `ADMIN` / `FOUNDER` | Дашборд и журнал аудита, CRUD услуг и статей (с загрузкой WebP через Sharp), заказы, роли пользователей, аналитика просмотров. Вкладка **Settings** (ключи Робокассы, токены) и блок **финансов** в аналитике — только для `FOUNDER` |

### Архитектура каталогов

| Путь | Содержимое |
| --- | --- |
| `app/` | Маршруты Next.js App Router, API-хендлеры (`app/api/*`) и серверные экшены (`app/actions/*`) |
| `components/blocks/` | Базовые секции на базе **Shadcnblocks** (`navbar10`, `hero138`, `feature314`, `community3`, `blog11`, `blogpost11`, `services11`, `product-detail1`, `contact29`, `signup10`, `cta13`, `footer7`) |
| `components/site/`, `admin/`, `orders/`, `ui/`, `spectrumui/` | Обёртки секций с данными БД, админ-таблицы/формы, UI-примитивы и графики |
| `components/ai/` | Презентация ИИ-направления, WebGL-плеер и статичные схемы агентов без интеграционных API |
| `public/assets/logos/` | Официальная векторная айдентика: полный логотип `npip.svg` (шапка и футер), знак `lnpip.svg` и логотип партнёра `ts-connect.svg` |
| `public/uploads/` | Локальное хранилище перекодированных в `.webp` аватаров и обложек (вне Git) |
| `lib/` | Работа с БД (`libSQL`/Prisma), Auth.js и RBAC-проверки, валидация Zod, санитизация HTML, загрузка изображений, Robokassa, i18n |
| `prisma/schema.prisma` | Единая схема БД (`sqlite` / `libSQL`) без файлов миграций |
| `messages/{ru,en}.json` | Полная двуязычная локализация интерфейса (`ru` / `en`) |
| `scripts/` и `tests/` | CLI-скрипты обслуживания БД/деплоя и полный набор автотестов на `node --test` |

---

## Справочник команд и доступов

| Команда | Описание |
| --- | --- |
| `npm run dev` | Запуск локального сервера разработки с автопроверкой схемы БД |
| `npm run build` / `npm start` | Production-сборка и запуск сервера (`next start`) |
| `npm run analyze` | Opt-in production bundle analysis с HTML reports в `.next/analyze/`; не заменяет обычную проверку `npm run build` |
| `npm run lint` / `npx tsc --noEmit` | Проверка ESLint и строгой типизации TypeScript |
| `npm test` | Запуск полного набора автотестов (`tests/*.test.cjs`) |
| `npm run security:audit` / `npm run security:dependencies` | Проверка security-политик исходников и полный аудит зависимостей |
| `npm run db:push` / `npm run db:check` | Согласованная синхронизация `prisma/schema.prisma` с БД и проверка всех таблиц; перед реальной БД обязательны backup/review |
| `npm run db:audit-retention -- --older-than-days=365` | Dry-run псевдонимизации старых ActivityLog; apply требует отдельный ключ и `--apply --confirm=PSEUDONYMIZE` |
| `npm run db:seed-demo` | Заполнение **локальной** SQLite-базы демо-данными и тестовыми ролями |
| `npm run db:promote-admin -- <email>` | Выдача служебной роли: по умолчанию `ADMIN`, `--founder` — `FOUNDER`, `--manager` — `MANAGER`, `--revoke` возвращает роль `USER`; без аргументов — список аккаунтов |
| `npm run deploy:verify -- https://domain` | Внешний smoke-тест боевого домена (`/api/health` и ключевые страницы) |

### Система ролей

Иерархия: `USER` → `MANAGER` → `ADMIN` → `FOUNDER`.

- **Регистрация (`/signup`)** всегда создаёт обычного клиента с ролью `USER`.
- **Разделение сессий:** даже если у аккаунта в БД служебная роль, вход **без** включённого тумблера **«Режим администратора»** создаёт обычную клиентскую сессию. Чтобы попасть в `/admin/dashboard` или `/manager/orders`, включите тумблер и пройдите MFA.
- **MFA для staff:** при отсутствии TOTP/passkeys служебный режим выдаёт только `USER` session и направляет на `/profile?mfa=required`. Pending login одноразовый, backup codes одноразовые, удаление последнего staff-фактора запрещено.
- **Access/refresh:** access session действует 15 минут, refresh — 7 дней с ротацией и device binding; одновременно не более трёх сессий. Повтор старого refresh token отзывает активные сессии аккаунта. Понижение роли сохраняется в серверной сессии; позднее повышение не восстанавливает staff mode без нового входа. Единый источник чисел — `lib/session-policy.ts`.
- **`USER`** — клиент: создаёт заявки и видит только свои.
- **`MANAGER`** — только заявки: согласовывает цену, выставляет счёт и может **зафиксировать цену и заблокировать заказ** (`isLocked`). Заблокированный заказ не редактируется никем, кроме основателя; снять блокировку может только `FOUNDER`.
- **`ADMIN`** — управление сайтом и пользователями: назначает менеджеров на странице `/admin/users` (селект роли `USER → MANAGER → ADMIN`). **Не** видит вкладку **Settings** и блок финансов в аналитике, **не** может редактировать заблокированные заказы и аккаунт основателя.
- **`FOUNDER`** — основатель: полный доступ, включая **Settings** (ключи Робокассы, токен Telegram — хранятся в таблице `site_settings` и имеют приоритет над `.env`), финансы и редактирование заблокированных заказов. **Защищён в админке:** его нельзя понизить, заблокировать или сбросить ему пароль через пользовательские management actions (ошибка `Action denied. Founder is invulnerable.`).
- **Выдача роли `FOUNDER`** — только скриптом с доступом к БД: `npm run db:promote-admin -- you@domain.ru --founder`. Через интерфейс основателя ни создать, ни изменить нельзя.
- **Оплата (Робокасса):** ключи берутся по приоритету — вкладка **Settings** (БД) → переменные `ROBOKASSA_*` в `.env` → демо-магазин `TestMerchant` (только вне production либо при явном `ROBOKASSA_DEMO_MODE=1`; публичный demo-пароль делает production demo небезопасным). Ссылку создаёт только same-origin authenticated `POST /api/payment/create` с form field `orderId`, после согласования цены. Уведомления принимает `/api/payments/robokassa/result` (алиас `/api/payment/result`). Реальные платежи сейчас не принимаются; mocked tests не заменяют live verification.
