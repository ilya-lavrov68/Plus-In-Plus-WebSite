# Baseline и измеренные пакеты глобальной оптимизации

Дата: 2026-10-26. Базовый commit первого сравнения: `e399ce3d695d3ae6ad424e4e255db65320ea02b6`.

Документ фиксирует последовательные измеренные пакеты этапов 0–2 из [`next-forge-optimization.md`](next-forge-optimization.md), а не завершение всей программы производительности. Архитектура, схема БД, runtime dependencies, Next.js/React major versions, Auth.js, Prisma и Turso не менялись.

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
