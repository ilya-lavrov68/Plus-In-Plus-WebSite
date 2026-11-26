# Plus In Plus — Web Platform

Официальная веб-платформа **Plus In Plus** — сайт дизайн-студии: айдентика, цифровые макеты, вывески и наружная реклама, витрина дизайн-услуг с конфигуратором опций и корзиной, двухшаговая форма брифа и заявок с прямой записью в БД, блог со статьями и галереями, личный кабинет клиента, рабочее место менеджера и полная админ-панель. Отдельный раздел — flagship-продукт студии **Line Launcher**, Minecraft-лаунчер для игровых проектов. Палитра утверждена владельцем: тёмные поверхности `#110F10` / `#2B292A`, светлый акцент `#EEEEEE`, оранжевое действие `#FF5F01` с текстом `#0E1015`.

**Стек текущей версии:**
`Next.js 16 (App Router)` · `React 19` · `TypeScript` · `Tailwind CSS 4` · `Shadcnblocks UI (палитра Hero 138)` · `Motion` · `SQLite/libSQL (Turso) без CMS` · `Auth.js v5` · `next-intl (RU / EN)` · `TipTap` · `Robokassa` · `Sharp (WebP)`

---

## Запуск проекта: пошаговая инструкция

### Что нужно установить

- **Node.js `24.22.1` или новее.** Версия `24.14.1` не подходит: проект использует более новые возможности Node.
- **Git**.

Для локальной разработки не нужны Turso, PM2, Nginx или отдельный сервер базы данных. Сайт хранит данные в файле `data/pip.db` внутри проекта.

Проверьте версии перед продолжением:

```bash
node -v
npm -v
```

Если используете nvm for Windows, нужную версию можно выбрать так:

```powershell
nvm install 24.22.1
nvm use 24.22.1
node -v
```

### 1. Локальная разработка на Windows

Откройте **PowerShell**. Если проект уже скачан, сразу перейдите в его папку и пропустите первые две команды.

```powershell
git clone https://github.com/ilialavrov227-prog/Plus-In-Plus-WebSite.git
cd Plus-In-Plus-WebSite
npm ci
Copy-Item .env.example .env
```

Создайте секретный ключ сессий. Это случайная строка для защиты входа и админ-панели, а не пароль от сайта.

1. Выполните команду и скопируйте результат в `AUTH_SECRET`:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```

2. Откройте файл командой `notepad .env` и вставьте значение. Начало файла должно выглядеть примерно так:

   ```env
   DATABASE_URL="file:./data/pip.db"
   DATABASE_AUTH_TOKEN=""
   AUTH_SECRET="результат_генератора"
   ```

Остальные значения для обычной локальной разработки менять не нужно. Файл `.env` содержит секреты и не должен попадать в Git.

Теперь создайте таблицы базы данных и проверьте их:

```powershell
npm run db:migrate
npm run db:check
```

Первая команда создаёт файл `data/pip.db` и все таблицы из `db/schema.sql`. Повторный запуск безопасен: уже существующие объекты не пересоздаются.

Если нужны начальные услуги в каталоге, выполните необязательную команду:

```powershell
npm run db:seed:services
```

Запустите сайт:

```powershell
npm run dev
```

Откройте:

- сайт: <http://localhost:3000>;
- вход: <http://localhost:3000/login>;
- админ-панель после настройки сотрудника: <http://localhost:3000/admin>.

Остановить сервер можно клавишами `Ctrl+C`. При изменении кода страница в dev-режиме обновляется автоматически.

### 2. Локальная разработка на macOS или Linux

Порядок тот же. Установка пакетов и создание `.env`:

```bash
git clone https://github.com/ilialavrov227-prog/Plus-In-Plus-WebSite.git
cd Plus-In-Plus-WebSite
npm ci
cp .env.example .env
```

Выполните генератор и вставьте результат в `AUTH_SECRET` внутри `.env`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
nano .env
```

Затем:

```bash
npm run db:migrate
npm run db:check
npm run dev
```

Начальные услуги добавляются необязательной командой `npm run db:seed:services`.

### 3. Как создать первого администратора

1. Запустите `npm run dev` и зарегистрируйте свой аккаунт на <http://localhost:3000/signup>.
2. Во втором окне терминала, из папки проекта, выполните команду со своим email:

   ```bash
   npm run db:promote-admin -- you@example.com --founder
   ```

3. Выйдите из аккаунта и снова откройте `/login`. Включите **«Режим администратора»**.
4. При первом служебном входе сайт попросит настроить второй фактор в профиле: код из приложения authenticator (TOTP) или passkey. После настройки выйдите и войдите ещё раз с этим вторым фактором.

Роль `FOUNDER` назначается только этой командой. Для обычного администратора используйте ту же команду без `--founder`, для менеджера — с `--manager`.

### 4. Production-режим на своём компьютере

Этот режим проверяет оптимизированную сборку. Он не публикует сайт в интернет и не заменяет HTTPS-сервер.

Используйте тот же `.env`, затем выполните:

```bash
npm run db:migrate
npm run build
npm start
```

Сайт снова будет доступен на <http://localhost:3000>. Остановка — `Ctrl+C`. В отличие от `npm run dev`, здесь нет автоматической пересборки при изменении файлов: после изменения кода нужно повторить `npm run build`.

### 5. Production на публичном сервере

Для публичного сайта нужны:

- Linux-сервер с Node.js `24.22.1+`;
- домен и HTTPS-сертификат;
- облачная база Turso или совместимый постоянный libSQL-сервер;
- Nginx или другой HTTPS reverse proxy, который принимает запросы на домен и передаёт их Node-процессу;
- PM2, который перезапускает сайт после сбоя или перезагрузки сервера.

В серверном `.env` обязательно укажите свои значения:

```env
DATABASE_URL="libsql://адрес-вашей-базы"
DATABASE_AUTH_TOKEN="токен-базы"
AUTH_SECRET="случайный_секрет"
AUTH_URL="https://your-domain.example"
NEXT_PUBLIC_SITE_URL="https://your-domain.example"
WEBAUTHN_ORIGIN="https://your-domain.example"
WEBAUTHN_RP_ID="your-domain.example"
```

`AUTH_URL` и `NEXT_PUBLIC_SITE_URL` — это публичный адрес сайта. `WEBAUTHN_RP_ID` — домен без `https://`. Не используйте production-секреты в локальных тестах.

Перед применением миграций на сервере сделайте резервную копию базы. Основной порядок запуска:

```bash
cd /opt/plus-in-plus
npm ci
set -a; source .env; set +a
npm run db:migrate
npm run db:check
npm run build
pm2 start npm --name plus-in-plus -- start
pm2 save
```

Проверка:

```bash
curl -fsS https://your-domain.example/api/health
npm run deploy:verify -- https://your-domain.example
```

Настройка Turso, Nginx, HTTPS, резервных копий и обновлений без сокращений описана в [`DEPLOYMENT.md`](DEPLOYMENT.md).

### Если команда не запускается

| Сообщение | Что сделать |
| --- | --- |
| `ERR_UNSUPPORTED_ESM_URL_SCHEME` и путь начинается с `D:` | Повторите команду на Node `24.22.1+`: Windows-путь преобразуется в корректный `file://` URL. |
| Node `24.14.1` или другая старая версия | Установите Node `24.22.1+` и проверьте `node -v` в новом окне терминала. |
| `AUTH_SECRET must be configured...` | Проверьте, что существует `.env` и `AUTH_SECRET` заполнен строкой длиной не менее 32 символов. |
| `Missing tables` | Выполните `npm run db:migrate`, затем `npm run db:check`. |
| `An unexpected Turbopack error occurred`, в логе `os error 33` и `pip.db-shm` | База лежит внутри проекта (например, старый путь `payload/pip.db`) и залочена работающим сервером — на Windows сборщик не может её прочитать. Перенесите базу в `data/`: `npm run db:relocate`, затем в `.env` укажите `DATABASE_URL="file:./data/pip.db"` и перезапустите `npm run dev`. |
| Порт `3000` уже занят | Запустите dev-сервер на другом порту: `npm run dev -- -p 3001`. |
| Нужна общая диагностика | Выполните `npm run doctor`: команда проверит Node, пакеты, `db/schema.sql`, админ-панель, базу и наличие секретов, не печатая их значения. |

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
| Staff не попадает в `/admin` | Проверьте, что включён **«Режим администратора»** и пройден второй фактор. Если открыт `/profile?mfa=required`, сначала настройте TOTP/passkey, сохраните backup codes и повторите вход. |
| Google Authenticator отклоняет код при первичной привязке | Создайте текущий QR, удалите прежнюю запись Plus In Plus для аккаунта в приложении и отсканируйте QR заново. Включите автоматические дату и время на телефоне; если отказ сохраняется, проверьте `date -u`/NTP на сервере и только redacted event `auth.mfa.failed`. Не расширяйте TOTP window и не отправляйте QR/secret/code в тикет. |
| Вход/регистрация пишут «временно недоступны» | На сервере не задан `DATABASE_URL` или `AUTH_SECRET` короче 32 символов → заполните `.env` и выполните `pm2 restart plus-in-plus`. |
| `npm run db:migrate` применяется не к той базе | Скрипт читает переменные окружения шелла → проверьте `DATABASE_URL` и перед запуском выполните `set -a; source .env; set +a`. |
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

Перед изменением интерфейса читайте [`docs/ui-ux-pro-max.md`](docs/ui-ux-pro-max.md): постоянный стандарт доступности, адаптивности, микроанимаций, производительности и browser evidence, закреплённый также в `AGENTS.md`. Композиция следует 60/30/10: тёмная основа `#110F10` и приподнятая поверхность `#2B292A`, светлый акцент `#EEEEEE`, оранжевое действие `#FF5F01` с текстом `#0E1015`. Акцентная заливка живёт только у кнопок и действий, радиусы заданы иерархией с расчётом вложенных углов, тени и ring-as-shadow запрещены, keyboard focus строится на outline.

Пиксельный sprite дизайн-практики (24 кадра, цикл 2,4 с) воспроизводится командой `npm run sprites:directions`. Генератор и палитра находятся в `scripts/generate-direction-sprites.cjs`, готовый лист — в `public/assets/pixels/direction-design.png`, проверки — в `tests/direction-sprites.test.cjs`. ИИ-спрайт удалён вместе с направлением.

### Line Launcher — flagship-продукт

- `/line-launcher` — полноценная страница продукта: назначение, платформы (Windows · macOS · Linux), стек (Tauri 2.12 · Rust · React 19), основа Obsy Launcher, возможности из README, статус «в разработке · 0.15.4» и восемь реальных скриншотов. Источник фактов и ассетов — публичный репозиторий [`ilya-lavrov68/Line-Launcher`](https://github.com/ilya-lavrov68/Line-Launcher); происхождение файлов записано в [`docs/redesign/line-launcher-assets.md`](docs/redesign/line-launcher-assets.md).
- Публичных релизов у продукта нет, поэтому на странице нет кнопки «Скачать» и обещаний даты: вместо них — заявка в студию и ссылка на репозиторий с честным примечанием о статусе.
- Фоновая графика блока — Hazeglow (`hazeglow@0.6.1`, режим `ascii`, палитра бренда) с фолбэком без WebGL и статичным кадром при `prefers-reduced-motion`. Одинаковая текстура на все карточки не раскладывается.
- Скриншоты сконвертированы в WebP 1600 px (188 КБ вместо 6,3 МБ исходных PNG), ниже первого экрана грузятся лениво, у каждого есть предметный alt.

### Комплексная разработка и оптимизация

Перед любой разработкой или проверкой применяйте [`docs/agent-workflow.md`](docs/agent-workflow.md): он требует завершать не только UI, но и связанные server/data/auth/mutation/error/revalidation слои с end-to-end доказательствами. Для оптимизации дополнительно используйте [`docs/next-forge-optimization.md`](docs/next-forge-optimization.md): там отделены изученные практики `vercel/next-forge` от решений PIP и обозначены будущие измеримые этапы без автоматической смены архитектуры.

CMS-слоя в проекте больше нет: Payload удалён вместе с его админкой, REST API и хуками. Контент, услуги, медиа, настройки, аккаунты, сессии с MFA, заказы, корзина, платежи, аналитика и audit-записи хранятся в обычных таблицах SQLite/libSQL; приложение читает и пишет их собственным параметризованным SQL через `lib/db.ts`. Схема — `db/schema.sql`, применяется `npm run db:migrate` и проверяется `npm run db:check`; правила жизненного цикла заказа живут в `lib/order-rules.ts`, а не в хуках CMS. Staff-доступ проверяют серверные guards (`requireStaff` / `requireAdmin` / `requireFounder`), панель `/admin` построена на shadcn-компонентах, manager видит только разрешённые заказы без customers и carts. Runbook и проверки описаны в `DEPLOYMENT.md`.

Панель `/admin` закрывает то, что раньше умела CMS, без CMS: услуги, товары и материалы блога можно создавать и редактировать прямо в браузере, обложки загружаются файлом (проверка сигнатуры, пережатие в WebP, строка в `media`), блок «история» правит таблицы `story`/`story_events`, а платёжные ключи, SEO и контакты доступны только основателю в `/admin/settings` (секреты write-only — пустое поле не стирает сохранённое значение). Бизнес-правила вынесены из хуков в модули `lib/service-rules.ts`, `lib/post-rules.ts`, `lib/product-rules.ts`, `lib/story-editor.ts`, `lib/site-settings-write.ts` и `lib/cover-images.ts`; каждое изменение пишется в журнал `activity_logs`, а не только в таблицу контента.

Админ-панель собрана из собственных компонентов Plus In Plus: фирменный SVG без рамки и подложки, укрупнённый базовый текст, щедрые touch/focus-цели и содержательные иконки разделов; панель остаётся нейтральным графитом, акцент бренда в ней не используется. Публичный сайт держит утверждённую палитру, иерархию радиусов и отсутствие теней.

Воспроизводимые baselines, результаты последовательных пакетов и границы доказанности находятся в [`docs/performance-baseline.md`](docs/performance-baseline.md). Для новой bundle-карты выполните `npm run analyze`: это отдельная production-сборка с reports в `.next/analyze/`; analyzer не включается в обычный runtime.

## Что внутри текущей версии сайта

| Маршрут | Блок UI / Модуль | Назначение |
| --- | --- | --- |
| `/` (`/[locale]`) | `Navbar 10` · `Hero 138` · `BrandDirections` · `Feature 314` · `Community 3` · `Blog 11` · `CTA 13` · `Footer 7` | Главная дизайн-студии: hero о практике, два направления (дизайн и Line Launcher), история, услуги, партнёры, журнал и контакт |
| `/line-launcher` | `LineLauncherView` · `HazeglowField` | Страница flagship-продукта: реальные факты, статус без обещаний, скриншоты из репозитория, ссылка на GitHub и заявка в студию |
| `/services` | `ServicesCatalogView` · `ServiceCard` | Каталог активных опубликованных услуг из БД с переходом к конфигуратору и добавлением в корзину |
| `/services/[slug]` | `Product Detail 1` + конфигуратор | Карточка услуги из БД с расчётом опций, добавлением в корзину и быстрой заявкой; старые адреса `/shop/…` отдают 308 на этот маршрут |
| `/contact` | `ContactOrderForm` + `createOrder` | Выбор нескольких услуг и отправка брифа в БД; legacy `POST /api/support` доступен только авторизованному клиенту |
| `/blog`, `/blog/[slug]` | `Blog 11` · `Blogpost 11` | Публикации с фильтрацией по категориям, обложками, цитатами и санитизированной вёрсткой |
| `/cart` | Единая корзина и заказы `Order` / `OrderItem` + `OrderCard` | Корзина и список заказов на одной странице: услуги и товары с серверной проверкой цены и остатков, отправка одной заявки на согласование, статусы и счета по отправленным заказам, отмена своего неоплаченного заказа |
| `/login`, `/register`, `/signup` | `SignUp 10` в композиции `login5` + `AccountModal` | Локализованные вход и регистрация без OAuth-кнопок, с отдельным режимом служебного входа и сохранёнными MFA/passkeys |
| `/admin` | shadcn admin-панель + серверные guards | Единая staff-панель с графиками; manager видит только разрешённые заказы, без customers/carts. ADMIN/FOUNDER создают и правят услуги, товары, материалы и историю, загружают обложки; `/admin/settings` — только основатель |
| `/orders` | Редирект на `/cart` | Отдельной страницы заказов больше нет: корзина и заказы объединены на `/cart`. Маршрут сохранён для старых ссылок и возврата с оплаты |
| `/profile` | `ProfileForm` · `SecuritySettings` · `SessionRefresh` | Профиль, аватар, смена пароля с отзывом старых сессий, TOTP/passkeys, backup codes и refresh короткой access session |

### Архитектура каталогов

| Путь | Содержимое |
| --- | --- |
| `app/(site)/`, `app/(admin)/` | Публичный сайт и staff-панель `/admin`, каждый со своим layout |
| `app/actions/`, `app/api/`, `app/uploads/` | Существующие server actions и прикладные route handlers на прежних путях |
| `components/blocks/` | Базовые секции на базе **Shadcnblocks** (`navbar10`, `hero138`, `feature314`, `community3`, `blog11`, `blogpost11`, `services11`, `product-detail1`, `contact29`, `signup10`, `cta13`, `footer7`) |
| `components/site/`, `admin/`, `ui/`, `spectrumui/` | Обёртки секций с данными из SQL, админ-панель, UI-примитивы и графики |
| `components/site/line-launcher-view.tsx`, `hazeglow-field.tsx` | Страница продукта и клиентский слой Hazeglow (ascii/dither, фолбэк без WebGL, reduced motion) |
| `public/assets/logos/` | Официальная векторная айдентика: полный логотип `npip.svg` (шапка и футер), знак `lnpip.svg` и логотип партнёра `ts-connect.svg` |
| `public/uploads/` | Локальное хранилище перекодированных в `.webp` аватаров и обложек (вне Git) |
| `lib/` | Слой SQL (`db.ts`, `data.ts`, `commerce-data.ts`, `accounts.ts`), правила заказов, Auth.js и RBAC-проверки, валидация, санитизация HTML, загрузка изображений, Robokassa, i18n |
| `db/`, `data/pip.db` | `schema.sql` — источник правды по таблицам и индексам; локальный файл базы остаётся вне Git |
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
| `npm run db:migrate` | Применяет `db/schema.sql` к базе из `DATABASE_URL`; повторный запуск безопасен |
| `npm run changelog:sync` | Перечитывает `CHANGELOG.md`, теги и релизы Line Launcher на GitHub и обновляет `content/line-launcher-changelog.json` для страницы `/line-launcher/changelog` (см. `docs/line-launcher-changelog.md`) |
| `npm run changelog:check` | Проверяет, что файл истории версий совпадает с репозиторием продукта, ничего не записывая |
| `npm run db:check` | Read-only проверка подключения ко всем обязательным таблицам схемы |
| `npm run db:audit-retention -- --older-than-days=365` | Dry-run псевдонимизации старых ActivityLog; apply требует отдельный ключ и `--apply --confirm=PSEUDONYMIZE` |
| `npm run db:seed:services` | Идемпотентное добавление базовых услуг в локальную/test БД; тестовые аккаунты с известными паролями не создаются |
| `npm run db:promote-admin -- <email>` | Выдача служебной роли: по умолчанию `ADMIN`, `--founder` — `FOUNDER`, `--manager` — `MANAGER`, `--revoke` возвращает роль `USER`; без аргументов — список аккаунтов |
| `npm run deploy:verify -- https://domain` | Внешний smoke-тест боевого домена (`/api/health` и ключевые страницы) |

### Система ролей

Иерархия: `USER` → `MANAGER` → `ADMIN` → `FOUNDER`.

- **Регистрация (`/signup`)** всегда создаёт обычного клиента с ролью `USER`.
- **Разделение сессий:** даже если у аккаунта в БД служебная роль, вход **без** включённого тумблера **«Режим администратора»** создаёт обычную клиентскую сессию. Чтобы попасть в `/admin`, включите тумблер и пройдите MFA. Manager получает только разрешённый раздел заказов, без customers и carts.
- **MFA для staff:** при отсутствии TOTP/passkeys служебный режим выдаёт только `USER` session и направляет на `/profile?mfa=required`. Pending login одноразовый, backup codes одноразовые, удаление последнего staff-фактора запрещено.
- **Access/refresh:** access session действует 15 минут, refresh — 7 дней с ротацией и device binding; одновременно не более трёх сессий. Повтор старого refresh token отзывает активные сессии аккаунта. Понижение роли сохраняется в серверной сессии; позднее повышение не восстанавливает staff mode без нового входа. Единый источник чисел — `lib/session-policy.ts`.
- **`USER`** — клиент: создаёт заявки и видит только свои.
- **`MANAGER`** — только заявки: согласовывает цену, выставляет счёт и может **зафиксировать цену и заблокировать заказ** (`isLocked`). Заблокированный заказ не редактируется никем, кроме основателя; снять блокировку может только `FOUNDER`.
- **`ADMIN`** — управление сайтом и пользователями через панель `/admin`, включая назначение ролей `USER → MANAGER → ADMIN`. **Не** видит защищённые платёжные настройки и блок финансов в аналитике, **не** может редактировать заблокированные заказы и аккаунт основателя.
- **`FOUNDER`** — основатель: полный доступ, включая **Settings** (ключи Робокассы, токен Telegram — хранятся в таблице `site_settings` и имеют приоритет над `.env`), финансы и редактирование заблокированных заказов. **Защищён в админке:** его нельзя понизить, заблокировать или сбросить ему пароль через пользовательские management actions (ошибка `Action denied. Founder is invulnerable.`).
- **Выдача роли `FOUNDER`** — только server CLI (SQL-обновление + отзыв сессий): `npm run db:promote-admin -- you@domain.ru --founder`. Через интерфейс основателя ни создать, ни изменить нельзя; после изменения роли существующие сессии отзываются.
- **Оплата (Робокасса):** ключи берутся по приоритету — вкладка **Settings** (БД) → переменные `ROBOKASSA_*` в `.env` → демо-магазин `TestMerchant` (только вне production либо при явном `ROBOKASSA_DEMO_MODE=1`; публичный demo-пароль делает production demo небезопасным). Ссылку создаёт только same-origin authenticated `POST /api/payment/create` с form field `orderId`, после согласования цены. Уведомления принимает `/api/payments/robokassa/result` (алиас `/api/payment/result`). Реальные платежи сейчас не принимаются; mocked tests не заменяют live verification.
