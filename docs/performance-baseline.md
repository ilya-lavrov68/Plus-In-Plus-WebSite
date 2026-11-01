# Baseline и измеренные пакеты глобальной оптимизации

Дата: 2026-10-26. Базовый commit первого сравнения: `e399ce3d695d3ae6ad424e4e255db65320ea02b6`.

Документ фиксирует последовательные измеренные пакеты этапов 0–2 из [`next-forge-optimization.md`](next-forge-optimization.md), а не завершение всей программы производительности. Архитектура, схема БД, runtime dependencies, Next.js/React major versions, Auth.js, Prisma и Turso не менялись **внутри того исторического этапа**. После полного cutover текущие data reads используют Payload Local API; упоминания Prisma ниже описывают только исходный baseline и не являются актуальным runbook.

## 1. Что было измерено до изменений

На production build/start с длинными author-controlled статьями обнаружены три подтверждённые проблемы:

1. В RSC/HTML карточек блога передавались полные `htmlContent`, sections и другие поля статьи, хотя карточка использует только `id`, `slug`, `title`, `dateLabel`, `category` и `image` (alt строится из заголовка). На `/`, `/blog` и `/shop/sign-design` в ответе присутствовали тела всех показанных статей.
2. Полные RU и EN словари попадали в client layout из-за browser-safe helpers, импортировавших оба JSON. AccountModal и WebAuthn SDK также входили в начальные client chunks, хотя нужны только после соответствующего взаимодействия.
3. Публичные queries читали больше данных, чем требовал сценарий: неограниченный список ради трёх latest posts, все опубликованные статьи ради metadata одного slug, полные строки для featured navigation и список продуктов ради metadata count.

Bundle analyzer подтвердил вклад словарей, AccountModal и WebAuthn в client layout. Это стало основанием для точечных изменений; массовые `dynamic`, `memo`, кэши и смена stack не применялись.

## 2. Реализованные изменения

- `i18n-catalog.ts` — server-only каталог полных RU/EN словарей; `i18n.ts` оставляет в browser-safe модуле только locale helpers.
- `components/site/lazy-account-modal.tsx` — AccountModal через `next/dynamic`, `ssr: false`, загрузка при первом открытии и preload по pointer/focus intent. Mounted state сохраняется для Radix focus return и exit transition.
- `@simplewebauthn/browser` импортируется через `await import()` только внутри passkey handlers в AccountModal, Signup10 и SecuritySettings. Ошибка загрузки/операции проходит через существующий localized error path и сбрасывает pending state.
- `lib/blog-card.ts` и `BlogCardData` — узкий DTO из шести полей. Клиентские карточки больше не получают article-only данные; production callers явно применяют `toBlogCardData`.
- `getPublishedPosts(limit?)` ограничивает latest posts на уровне Prisma. Главная и service content запрашивают три записи.
- Blog metadata читает только запрошенный slug; featured navigation использует narrow `select`; shop metadata использует `count` вместо чтения всех строк.
- `npm run analyze` включает `@next/bundle-analyzer` только для отдельной production-сборки. Обычный `next.config.mjs` не обёрнут analyzer при обычном запуске; reports создаются в `.next/analyze/` и не коммитятся.
- `tests/performance-contracts.test.cjs` закрепляет DTO/query limits, server-only dictionaries и lazy-loading границы.

Функциональность карточек, CMS, ordinary login, отдельный Staff mode, RBAC/MFA, WebAuthn, мобильная навигация, дизайн и data freshness сохранены. Схема БД и миграции не изменялись.

## 3. Окружение и метод сравнения

| Параметр | Значение |
| --- | --- |
| Runtime | Node.js `22.22.3`, Next.js `15.5.28`, React `18.3.1` |
| Browser | Playwright `1.64.1`, Chromium через `@sparticuz/chromium` `153.0.0` |
| Viewport основных замеров | `1440 × 900` |
| Приложение | `next build` + `next start`, локальный HTTPS origin; development server не использовался |
| Данные | Изолированная throwaway SQLite, три опубликованные статьи по 260 абзацев, одна active service |
| Browser cache | Новый browser context для маршрута; server process оставался warm внутри серии |
| Сеть | Без artificial throttling; это не mobile-field и не удалённый Turso test |
| Основная серия | Один полный baseline и один полный after при одинаковых fixture/method |
| Повторы | Дополнительные after-серии для `/`, `/blog`, `/login` подтвердили направление сокращения encoded network payload |

HTML ниже измерен как `rawHtml.length`, то есть число UTF-16 code units в decoded response, а не как transferred bytes. Этот одинаковый для baseline/after diagnostic показывает удаление скрытого article payload. Network-столбцы — `encodedDataLength` из CDP и включают requests, выполненные при прокрутке; prefetch и session/consent requests делают их менее детерминированными, чем HTML diagnostic.

## 4. Результаты

### 4.1. HTML diagnostic и encoded network payload

| Маршрут | HTML до → после | Изменение HTML | Encoded network до → после, bytes | Изменение network |
| --- | ---: | ---: | ---: | ---: |
| `/` | 312023 → 172972 | −44,6% | 487461 → 467779 | −4,0% |
| `/blog` | 259948 → 120821 | −53,5% | 478040 → 465025 | −2,7% |
| `/services` | 117308 → 116585 | −0,6% | 474353 → 455246 | −4,0% |
| `/shop/sign-design` | 269858 → 130807 | −51,5% | 490727 → 469959 | −4,2% |
| `/login` | 119073 → 118409 | −0,6% | 478117 → 462859 | −3,2% |

На `/`, `/blog` и `/shop/sign-design` маркер полного article body исчез из HTML. Все after-маршруты вернули HTTP 200 без console errors и unexpected failed requests. Повторы не использовались для выборочного усреднения: таблица показывает одну полную сопоставимую серию.

### 4.2. Client bundles

Analyzer показал уменьшение client layout примерно с `20355` до `15776` gzip bytes: `−4579` bytes, или `−22,5%`.

- AccountModal вынесен в async chunk размером около `5736` gzip bytes.
- WebAuthn SDK вынесен в async chunk размером около `2850` gzip bytes и не является initial для layout/login.
- По округлённому Next.js build output First Load JS уменьшился с `170` до `167 kB` для `/` и `/blog`, со `173` до `170 kB` для `/blog/[slug]`, со `191` до `188 kB` для `/login` и `/shop/[slug]`.

Это bundle-size evidence, а не утверждение о пропорциональном улучшении CPU, LCP или INP.

### 4.3. Что не доказано

Улучшение LCP не подтверждено. Единичная baseline-серия и вариативные after-замеры не образуют распределение, достаточное для вывода о Web Vitals. Например, LCP `/` в after-сериях варьировался от `380` до `528 ms`, а `/login` — от `272` до `308 ms`. Эти локальные значения нельзя выдавать за staging, Turso, production или field p75.

SQL duration/round trips на сетевом Turso, TTFB distribution, INP, cold start, cache hit ratio и реальные author images в этой работе не измерены. Поэтому никаких утверждений об «мгновенности» или универсальном ускорении всех сценариев нет.

## 5. Проверка корректности

- `npx tsc --noEmit` — успешно; `npm run lint` — без warnings/errors.
- `npm test` — **378/378 passed**, включая шесть новых performance regression contracts.
- `npm run security:audit` — проверка 333 source files прошла без high-confidence findings; это focused policy check, не полный SAST/pentest.
- `npm run security:dependencies -- --audit-level=high` — **0 vulnerabilities**.
- `npm run analyze` и обычный `npm run build` — успешны.
- Production HTTPS browser review — 16 route/viewport проверок для RU/EN `/`, `/blog`, `/services`, `/shop/sign-design`, `/login`, дополнительные widths `320` и `1920`; overflow, console errors и unexpected failed requests не обнаружены.
- Реальный ordinary login на изолированной fixture прошёл в EN и RU. Account dialog показал подтверждённую customer session; desktop и mobile открытие работает, Escape закрывает dialog и возвращает focus на trigger.
- До взаимодействия не запрашивались account или WebAuthn chunks. При открытии Account загрузился один account chunk; WebAuthn chunk остался незагруженным до passkey-сценария.
- Mobile menu и login navigation проверены с `prefers-reduced-motion: reduce`; glass, bottom panel и существующие состояния сохранены.

Registration через реальную форму не завершён в sandbox: внешняя password breach проверка недоступна, и приложение корректно вернуло ошибку вместо ослабления защиты. Для auth/account review создан временный USER непосредственно в throwaway БД, после чего выполнен настоящий ordinary login. Passkey с физическим/platform authenticator и Staff MFA browser flow в этом пакете не запускались; соответствующие server/unit/integration contracts остаются в полном suite.

## 6. Следующие измеримые шаги

1. Настроить согласованное non-production окружение с сетевым Turso и реальными объёмами author-controlled данных; измерять p50/p75/p95 TTFB/SQL и повторные A/B-серии Web Vitals.
2. Проверить оставшийся RSC payload текущей locale и route-specific dictionaries только после отдельного анализа; не добавлять module-global кэш и не смешивать locale/personalization.
3. Определить фактический LCP-ресурс на реальных локальных изображениях, затем оценить image/font изменения с отдельными before/after и CLS/loading checks.
4. Построить server/Prisma waterfall по критичным routes, не перемещая protected queries раньше auth/ownership guards.
5. Ввести budgets и staging browser flows только после повторяемого baseline; не выбирать целевые числа задним числом под текущий результат.

## 7. Rollback и цена изменения

Rollback — обычный revert этого diff. Миграций и runtime configuration changes нет. Единственная новая dependency — точная dev-only версия `@next/bundle-analyzer`, совпадающая с Next.js; production runtime не получает новый сервис или vendor.

Цена изменений — дополнительный lazy boundary, явные DTO mapping calls и необходимость поддерживать query projections при изменении карточек. Взамен уменьшены initial client layout, скрытый RSC/HTML article payload и лишние database reads. Freshness и существующие `revalidatePath` не менялись, общий кэш не добавлялся.

## 8. Второй пакет: server-action messages вне client payload

Baseline второго сравнения — commit `f559526ddc17ab886fd04e849e8e5875b6cc4203`. Использовались тот же Node/Next/React, production build/start, локальный HTTPS и throwaway SQLite с тремя статьями по 260 абзацев.

### 8.1. Отклонённая гипотеза

Сначала проверялся `/blog/[slug]`: previous/next типизированы как полные `CatalogBlogPost`, но фактический response содержал только тело текущей статьи. `Blogpost11` является Server Component и превращает соседние записи в обычные ссылки до клиентской сериализации. Поэтому сужение этих props не было оформлено как оптимизация и не вошло в diff.

### 8.2. Подтверждённый bottleneck и изменение

Во всех шести baseline responses присутствовали маркеры полного `actions` catalog, включая server validation messages. При этом браузерные компоненты использовали из этого namespace только `genericError`, `updateServiceFailed` и `invalidAmount` в трёх staff-формах.

- Эти три строки с идентичным RU/EN текстом добавлены в уже необходимый им `admin` namespace; компоненты продолжают показывать те же fallbacks через существующий translator.
- `getClientMessages()` исключает только `actions` из `NextIntlClientProvider`. Все остальные namespaces остаются доступными, поэтому client navigation не зависит от pathname и не теряет route messages.
- `messages` и `i18n-request.ts` сохраняют полный `actions`; серверный `getActionTranslator()`, validation errors и security behavior не изменены.

### 8.3. Результат до/после

HTML здесь — фактический `Buffer.byteLength` decoded response. Повторный browser run сравнивает CDP encoded Document; остальные session/consent requests в общий показатель не включены из-за их вариативности.

| Маршрут | HTML bytes до → после | Изменение | Encoded Document до → after/повтор |
| --- | ---: | ---: | ---: |
| `/` | 172587 → 164288 | −8299 (−4,81%) | 44582 → 42450 / 42452 |
| `/blog` | 120512 → 112213 | −8299 (−6,89%) | 35661 → 33552 / 33552 |
| `/blog/performance-article-2` | 197336 → 189037 | −8299 (−4,21%) | 40317 → 38245 / 38159 |
| `/login` | 116618 → 108319 | −8299 (−7,12%) | 34538 → 32387 / 32438 |
| `/services` | 113856 → 105557 | −8299 (−7,29%) | 34357 → 32233 / 32225 |
| `/ru/blog` | 156669 → 144002 | −12667 (−8,09%) | 42630 → 39963 / 39997 |

После изменения server-action маркеры отсутствуют в HTML, необходимые staff fallback остаются. Все browser routes вернули HTTP 200 без console errors, unexpected failed requests и horizontal overflow. Мобильные `/blog`, `/login`, `/ru/blog`, статья, client navigation на login и reduced-motion mobile menu проверены отдельно.

Это доказанное уменьшение response/document payload, а не новый LCP claim. Локальная SQLite по-прежнему не заменяет staging/Turso/field measurements.

### 8.4. Проверки второго пакета

- `npx tsc --noEmit`, `npm run lint` и обычный `npm run build` — успешны.
- `npm test` — **382/382 passed**: добавлен performance contract для client messages и три behavior tests с реальным `NextIntlClientProvider`, где `actions` отсутствует.
- Behavior tests подтверждают прежние `genericError`, `updateServiceFailed` и `invalidAmount` при rejected/thrown service update и invalid order amount.
- `npm run security:audit` — 334 source files без high-confidence findings; `npm run security:dependencies -- --audit-level=high` — **0 vulnerabilities**.

Rollback второго пакета также не требует миграций: восстановить `actions` в client provider и три прежних translator imports. Цена изменения — три коротких fallback-сообщения дублируются в `admin`, зато весь server-action catalog больше не отправляется браузеру на каждом маршруте.

## 9. Третий пакет: узкие database reads для sitemap

Baseline третьего сравнения — commit `c75623fb4eb54572db66b69a5544587e98043dc6`. В `app/sitemap.ts` три независимых чтения уже выполнялись параллельно, но services и posts загружались целиком: вместе с описаниями, ценами, assets, excerpt и полным author-controlled HTML. Для XML нужны только `id`/`slug` услуги, `slug`/`publishedAt` статьи и отдельный count активных продуктов.

Добавлены `getSitemapServices()` и `getSitemapPosts()` с Prisma `select`. Фильтры публикации, сортировка, отсутствие лимита, `serviceHref()` fallback на `id`, URL encoding и условное появление `/shop` сохранены. Число запросов не изменилось: два narrow `findMany` и один `count` по-прежнему выполняются в одном `Promise.all`; дополнительный round trip и общий cache не добавлялись.

### 9.1. Измерение на одной throwaway БД

Fixture содержала три опубликованные статьи с телами по 120000 символов и две услуги с длинными описаниями. Ниже — UTF-8 размер `JSON.stringify` фактически возвращённых приложению DTO. Это диагностический размер объектов после Prisma mapping, а не число bytes в libSQL wire response и не замер сетевого Turso.

| Данные | До, bytes | После, bytes |
| --- | ---: | ---: |
| Три posts DTO | 372837 | 165 |
| Два services DTO | 170405 | 77 |
| Сумма | 543242 | 242 |

До изменения тот же script отдельно вычислил required projections: 165 bytes для posts и 77 для services. После изменения реальные narrow queries вернули ровно эти наборы. Сериализованный `MetadataRoute.Sitemap` на неизменной БД совпал побайтно: SHA-256 до и после `bce411d67fca0383af7174b5ff6f039bb24b1d4f6e82aef12eeb841f0be6547e`, 12 entries. Production `next build`/`next start` также вернул HTTP 200 для `/api/health`, `/`, `/blog` и `/sitemap.xml`; фактический XML содержал 12 URL и ожидаемые encoded slugs/`lastmod`.

### 9.2. Проверки и граница пакета

- `npx tsc --noEmit`, `npm run lint`, `npm run build` — успешно.
- `npm test` — **384/384 passed**: добавлены query-projection contract и sitemap behavior regression для encoded slugs, legacy `id` и optional `lastModified`.
- `npm run security:audit` — 334 source files без high-confidence findings; `npm run security:dependencies -- --audit-level=high` — **0 vulnerabilities**.

Полный `/blog` сознательно не включён в этот diff. `mergeCatalogPosts()` использует точные title/excerpt/content для untouched-launch preset; body-only CMS edit обязан немедленно отключать preset. Убрать `content` из этого запроса без дополнительного чтения нельзя без изменения semantics, а raw SQL или второй round trip не признаются улучшением без отдельного обоснования и сетевого Turso baseline. Rollback sitemap-пакета — вернуть два прежних data loaders; схема БД и runtime dependencies не менялись.

## 10. Четвёртый пакет: безопасный Next.js cache в CI

Baseline CI — успешный push run [`40353990905`](https://github.com/ilya-lavrov68/Plus-In-Plus-WebSite/actions/runs/40353990905) на `c75623f`: job занял 2m51s, production build — 68s. Эти значения являются ориентиром, но не чистым A/B: другой commit и другой запуск hosted runner могут отличаться по нагрузке.

В `.github/workflows/ci.yml` добавлен `actions/cache@v4` только для `.next/cache`. Restore выполняется до `npm ci`, поэтому source hash не захватывает `node_modules` или восстановленные artifacts. Ключ включает `package-lock.json` и исходники; restore prefix дополнительно ограничен тем же lockfile hash. `.next/server`, `.next/static` и остальной готовый build output не кэшируются. Lint, typecheck, полный tests, оба security audit, schema checks, production build и HTTP smoke выполняются на каждом run без условий cache hit.

Первый push run [`40362654749`](https://github.com/ilya-lavrov68/Plus-In-Plus-WebSite/actions/runs/40362654749), attempt 1, на `cbc19ce` прошёл за 2m43s; production build занял 61s, tests — 31s. Cache miss был ожидаем: до этого пакета Next.js cache не существовал. Post-step успешно сохранил новый entry размером **30508679 bytes**. Сам по себе этот холодный run не доказывал ускорение.

Docs-only commit `f24f867` не изменил source hash и запустил warm push run [`40363394774`](https://github.com/ilya-lavrov68/Plus-In-Plus-WebSite/actions/runs/40363394774). Cache API подтвердил обращение к исходному branch entry с тем же key во время restore. Сравнение одной cold/warm пары:

| Показатель | Cold, `cbc19ce` | Warm, `f24f867` | Изменение |
| --- | ---: | ---: | ---: |
| Весь CI job | 163s | 128s | −35s (−21,5%) |
| Production build | 61s | 36s | −25s (−41,0%) |

Это одна hosted-runner cold/warm пара, а не устойчивое среднее или гарантия для каждого commit. Tests в этих runs заняли 31s и 26s, но Next.js cache не должен влиять на tests, поэтому такая разница отражает обычную вариативность runner и не засчитывается как эффект оптимизации.

Контрольный последующий warm PR run [`40363954285`](https://github.com/ilya-lavrov68/Plus-In-Plus-WebSite/actions/runs/40363954285) на `b4bed03` подтвердил эту осторожность: cache был восстановлен, production build занял 53s, а весь job — 179s из-за более медленных остальных steps. Следовательно, первые −35s не являются обещанным экономным результатом; для budget нужна серия повторов. Практический результат пакета — работающий narrow cache с сохранением полной верификации, а не фиксированное время CI. При изменении исходников restore prefix может вернуть предыдущий cache, после чего build обязан сам проверить инвалидацию; готовый output по-прежнему не переиспользуется.

Regression contract запрещает расширить cache path на весь `.next` или удалить обязательные verification commands. Локальный полный suite после добавления contract — **385/385 passed**; security policy audit — 334 source files, dependency audit — **0 vulnerabilities**. Cold и warm CI также успешно выполнили полный набор проверок и production smoke.

Цена — примерно 30 MB cache на source/ref entry (первые push и pull_request runs создали независимые entries); GitHub управляет eviction по своей политике. Runtime сайта этот cache не меняет. Rollback — удалить только restore step из CI; приложение и схема БД не затрагиваются.

## 11. Пятый пакет: production-mode Web Vitals и preload критичных шрифтов

Baseline — commit `2a1ff28bcf4ea784ac5c0d5d5230241420e9545a`. Для этой серии использовался обычный `next start` на HTTP `0.0.0.0:3444` и отдельный TLS reverse proxy на `0.0.0.0:3443`, который перезаписывал `Host`, `X-Forwarded-Host` и `X-Forwarded-Proto`. Предварительная серия через custom Next HTTPS server исключена: она смешивала bind/public origins и создавала не относящиеся к изменению ошибки. В приведённых ниже сериях все document responses — HTTP 200.

Fixture — изолированная throwaway SQLite после существующих `db:push` и `seed-demo`: 8 services, 4 posts, 5 users и 3 orders. Это не production и не сетевой Turso. Browser — Playwright `1.64.1` и `@sparticuz/chromium` `153.0.0`, production build, warm route code, новый browser context на каждый прогон, `serviceWorkers: block`, без artificial throttling. Desktop — `1440 × 900`, mobile — `390 × 844` с touch/mobile mode. Для каждого из десяти EN/RU route-viewport сценариев выполнено по три прогона до и после. Снимались Navigation Timing, LCP element, CLS session window и его sources, CDP encoded bytes, long tasks, console/request failures и screenshots; после `load` ожидались `document.fonts.ready` и ещё 2,5 секунды.

### 11.1. Доказанная причина и изменение

На EN desktop `/` три baseline CLS session scores составили `0.1403752`, `0.1694989`, `0.1694989`; на RU desktop `/` — три раза `0.0495205`. Sources указывали на изменение текстовых line boxes и размеров header/hero после загрузки local fonts. Mobile home в обеих локалях имел CLS `0`; тяжёлые raster LCP-ресурсы в fixture отсутствовали.

Добавлены только ранние preload links для уже используемых шрифтов:

- `geist-variable.woff2` и `google-sans-flex-latin.woff2` — для обеих локалей;
- `inter-cyrillic-wght-normal.woff2` — только для RU;
- каждый link имеет `as="font"`, `type="font/woff2"` и `crossOrigin="anonymous"`, поэтому preload переиспользуется CSS font request, а не создаёт второй ответ под другим mode.

Начертания, `unicode-range`, пять `font-display: swap`, контент и анимации не менялись. Cyrillic Ext и Latin Ext специально не preloaded: они не нужны каждому первому экрану. Regression contract закрепляет locale-aware набор и запрещает случайно вернуть preload всех subsets.

### 11.2. Сопоставимые результаты до/после

LCP ниже — медиана трёх прогонов в ms; в скобках дан полный диапазон. CLS приведён как три session-window scores, а не выбранный лучший прогон. Таблица описывает именно локальный warm-route lab experiment; различия LCP не являются статистически доказанным ускорением.

| Сценарий | LCP до → после, ms | CLS до → после |
| --- | ---: | --- |
| EN `/`, desktop | 268 (260–292) → 268 (268–296) | 0.1403752 / 0.1694989 / 0.1694989 → 0 / 0 / 0 |
| EN `/`, mobile | 232 (228–236) → 232 (212–236) | 0 / 0 / 0 → 0 / 0 / 0 |
| RU `/`, desktop | 256 (252–320) → 260 (240–304) | 0.0495205 / 0.0495205 / 0.0495205 → 0 / 0 / 0 |
| RU `/`, mobile | 228 (228–280) → 224 (196–236) | 0 / 0 / 0 → 0 / 0 / 0 |
| EN `/blog`, desktop | 224 (192–248) → 184 (176–196) | 0.0002367 / 0.0002367 / 0.0153673 → 0 / 0 / 0.0143673 |
| EN `/blog`, mobile | 200 (176–200) → 168 (160–196) | 0 / 0 / 0 → 0 / 0 / 0 |
| EN article, desktop | 200 (192–268) → 200 (184–276) | 0.0155429 / 0.0179843 / 0.0179843 → 0 / 0 / 0 |
| EN article, mobile | 200 (188–220) → 196 (176–200) | 0 / 0 / 0 → 0 / 0 / 0 |
| EN `/services`, desktop | 204 (200–216) → 180 (176–208) | 0.0016357 / 0.0016357 / 0.0016357 → 0 / 0 / 0 |
| EN `/services`, mobile | 212 (200–248) → 188 (184–212) | 0 / 0 / 0 → 0 / 0 / 0 |

Подтверждённый результат пакета — устранение наблюдавшихся font-related shifts на home, article и services в этих повторах, а не обещание CLS `0` на любом устройстве. Оставшийся intermittent `/blog` desktop shift `0.0143673` имеет другой source: видимая нижняя часть footer уходит за viewport при расширении async content над ним. Его нельзя приписать шрифтам или считать решённым этим diff; резервирование async layout — отдельный кандидат.

Font CDP encoded bytes не выросли: EN home — `121555` bytes до и после, RU home — `140838` до и после. В каждом EN home run осталось ровно два font responses для двух уникальных URL, в RU — три для трёх; повторной загрузки preloaded resource нет. Screenshots EN/RU desktop/mobile визуально совпали: header, hero, cookie banner и messenger-like mobile bottom panel сохранены. Horizontal overflow не появился.

Responsive-raster pipeline в этот пакет не включён. Approved runtime uploads в fixture отсутствуют, старые covers преобразуются в локальные SVG-placeholders, а retired JPEG запрещено возвращать. Поэтому текущие SVG LCP не доказывают выгоду `srcset`/AVIF/WebP; создавать искусственные raster covers ради измерения не допускается. Этот пункт остаётся до появления реальных author-controlled local materials.

### 11.3. Проверки, цена и rollback

Для font-only diff выполнены `npx tsc --noEmit`, `npm run lint`, focused performance contracts и обычный production `npm run build`. Contract suite на этом этапе — 10/10. Полный repository suite и security audits выполняются после всего пакета и фиксируются в итоговом PR summary.

Цена — более ранняя загрузка двух общих и одного RU-specific WOFF2, которые уже нужны глобальным heading/body stacks. Это сознательный приоритет критичным ресурсам, а не увеличение набора font files или bytes. Preload не гарантирует отсутствие fallback shift при произвольно медленной сети; для field/staging p75 по-прежнему нужны реальные RUM/remote-data замеры. Rollback — удалить три conditional/unconditional link и их contract; схема БД, dependencies и runtime configuration не менялись.

## 12. Шестой пакет: публичный origin в protected redirects

Browser baseline независимо от шрифтов выявил functional defect: guest prefetch `/cart` через корректный TLS reverse proxy получал `Location: https://localhost:3443/login`, хотя публичный origin был `https://127.0.0.1:3443`. Прямой HTTP request к `next start` воспроизводил тот же bind-host redirect. В Auth.js route уже существовал `authRequest()` с проверкой forwarded host/protocol, но middleware строил protected redirects из исходного `request.url`.

Общая pure-функция `publicRequestUrl()` теперь использует тот же доверенный `X-Forwarded-Host`/`X-Forwarded-Proto`, Host fallback и прежнюю allowlist-валидацию. `authRequest()` сохраняет прежнее поведение для Auth.js, включая тело POST. Middleware применяет public URL только к guest/role redirects и locale-prefixed protected redirects. Public rewrites, session rules, refresh cookie, ordinary customer login, Staff mode, RBAC и FOUNDER-only settings не изменены. Deployment requirement не ослаблен: доверенный proxy обязан перезаписывать forwarded headers; malformed origins по-прежнему отклоняются.

После production rebuild `HEAD /cart` возвращает `307` с `Location: https://127.0.0.1:3443/login`, а `HEAD /ru/admin/settings` — `307` на том же публичном origin в `/admin/settings`. Regression test покрывает пять путей: guest cart, USER в admin, MANAGER в admin, ADMIN в founder settings и locale-prefixed protected path. Реальный ordinary login через форму затем повторно проверен в EN и RU: обе сессии остались `USER`, `/cart` вернул HTTP 200, console errors не появились.

Контрольная 30-run browser серия после font + origin changes снова вернула HTTP 200 для всех documents и **0 console errors**; прежние CSP/failed-RSC messages исчезли. В `requestfailed` остались только `net::ERR_ABORTED` у отменяемых prefetch/document requests при закрытии свежих contexts; других failure types нет. Эта серия не используется для приписывания origin fix улучшения LCP/CLS.

Итоговые проверки двух пакетов:

- `npx tsc --noEmit`, `npm run lint`, production `npm run build` — успешно;
- `npm test` — **387/387 passed**;
- `npm run db:check` с той же изолированной fixture — все таблицы и колонки существуют;
- `npm run security:audit` — 334 source files без high-confidence findings;
- `npm run security:dependencies -- --audit-level=high` — **0 vulnerabilities**.

Rollback шестого пакета — вернуть прежние redirect bases и inline auth-request normalization, удалив новый regression test. Миграций, dependencies и configuration changes нет.
