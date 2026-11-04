# next-forge как источник оптимизационных практик для Plus In Plus

## 1. Статус документа

Документ фиксирует изучение [`vercel/next-forge`](https://github.com/vercel/next-forge) именно с точки зрения производительности, сквозной разработки и эксплуатационной надёжности. Он является обязательным ориентиром для будущих оптимизационных задач PIP, но не разрешением переписать архитектуру или выполнить все перечисленные этапы одним PR. Ссылки на Prisma относятся к внешнему next-forge и историческому baseline PIP; после завершённого cutover актуальные прикладные workflows используют собственный параметризованный SQL-слой.

Изучен source code, а не только маркетинговое описание:

- repository: `https://github.com/vercel/next-forge`;
- зафиксированный commit: [`f189de79ceef7c1ef69f61f12e272f99b4cdb699`](https://github.com/vercel/next-forge/tree/f189de79ceef7c1ef69f61f12e272f99b4cdb699);
- версия корневого `package.json`: `6.0.2`;
- дата анализа: 2026-10-26.

Здесь и далее явно разделяются:

- **наблюдение в next-forge:** что находится в указанном source;
- **принцип для PIP:** какая идея переносима без смены stack;
- **решение PIP:** что уже существует или принято как процесс;
- **будущий кандидат:** что требует отдельного baseline, реализации и проверки.

**Фактически выполнено в изменении, создавшем этот документ:** исправление геометрии timeline и введение обязательного agent workflow. Миграции, смена зависимостей, кэширование, monitoring и оптимизация других страниц не выполнялись.

**Последующие реализованные пакеты:** настроен opt-in bundle analyzer, сужены blog card DTO и публичные queries, полные словари вынесены за server-only boundary, AccountModal и WebAuthn SDK загружаются по взаимодействию. Затем server-only `actions` catalog исключён из client provider с сохранением трёх необходимых staff fallbacks; отклонённая гипотеза о previous/next article payload также задокументирована. Sitemap получил узкие projections без дополнительных database round trips, а CI — cache только для incremental Next.js artifacts с обязательным полным build/tests. Окружение, измерения и непроверенные сценарии находятся в [`performance-baseline.md`](performance-baseline.md); вся программа оптимизации этим не завершена.

## 2. Почему next-forge нельзя копировать как готовый шаблон

| Область | next-forge на зафиксированном commit | Текущий PIP | Вывод |
| --- | --- | --- | --- |
| Приложение | Bun workspaces + Turborepo, несколько apps | Один Next.js app, npm | Turborepo/monorepo не даёт автоматического выигрыша пользователю |
| Framework | Next.js `16.1.6`, React `19.2.4` | Next.js `15.5.28`, React 18 | Major upgrade — отдельный рискованный проект, не часть точечной оптимизации |
| Auth | Clerk | Auth.js v5, собственные MFA/session/RBAC | Clerk не переносится и не заменяет существующие гарантии |
| Данные | Prisma 7 + Neon PostgreSQL | Prisma `6.19.3` + libSQL/SQLite/Turso | Adapter/provider и схема не меняются по чужому примеру |
| CMS | BaseHub | Database-authoritative CMS, author-controlled content | BaseHub не заменяет текущий контракт контента |
| UI | shadcn/Radix design-system package | Существующие PIP/Spectrum/Shadcnblocks компоненты | Чужой design system не добавляется ради скорости |
| Observability | Sentry, PostHog, BetterStack и др. | Существующие logs/health/security tooling | Новые SDK требуют privacy, consent, cost и overhead review |
| Payments | Stripe | Robokassa с отдельными ограничениями | Stripe flow не является примером работающей Robokassa |

Переносить следует измеримые принципы: узкие client boundaries, явные server-only модули, выборочные данные, отложенную загрузку тяжёлых необязательных частей, bundle analysis, безопасную конфигурацию и observability. Не переносятся vendor, архитектурная форма или необоснованные defaults.

## 3. Что изучено в source и какие выводы сделаны

### 3.1. Server Components и границы интерактивности

**Наблюдения.**

- `skills/next-forge/SKILL.md` закрепляет server-first: `page.tsx` и `layout.tsx` остаются Server Components, интерактивность выносится в отдельные client files.
- `apps/app/app/(authenticated)/page.tsx`, `apps/web/app/[locale]/(home)/page.tsx` и blog/legal pages являются async Server Components.
- `packages/auth/server.ts` и `packages/database/index.ts` используют `server-only`.
- Тяжёлые collaboration/sign-in компоненты подключаются через `next/dynamic` в `apps/app/app/(authenticated)/page.tsx` и `apps/app/app/(unauthenticated)/sign-in/[[...sign-in]]/page.tsx`.

**Принцип для PIP.** Уменьшать клиентский JS через узкие client boundaries и передавать через RSC boundary только необходимые serializable поля. Динамически загружать доказанно тяжёлую и некритичную для первого экрана функциональность, а не каждый компонент подряд.

**Что уже есть в PIP.** `StoryTimeline` server-rendered; admin rich-text editor и data table уже имеют dynamic imports; независимые reads местами объединены через `Promise.all`.

**Решение PIP.** Принцип закреплён в `docs/agent-workflow.md`. Массовое добавление `dynamic`, `memo` или новых client islands не выполнялось. После bundle baseline отложены только AccountModal и WebAuthn SDK; browser flow подтвердил loading, focus return и сохранение обычной авторизации.

### 3.2. Выборочные данные и CMS queries

**Наблюдения.**

- `packages/cms/index.ts` описывает отдельные fragments для metadata/list/full body: список не обязан запрашивать весь article body.
- `apps/web/app/[locale]/blog/[slug]/page.tsx` и legal page содержат `generateMetadata` и `generateStaticParams`.
- `packages/database/index.ts` повторно использует PrismaClient в development через `globalForPrisma`.

**Принцип для PIP.** Список, карточка, полная страница и metadata должны получать только нужные поля. Повторное использование client и request dedupe не должны приводить к shared personalized cache.

**Что уже есть в PIP.** `lib/prisma.ts` использует существующий singleton; `lib/story.ts` выбирает только `value`; `getServicePricing` отдельно загружает дерево опций, чтобы список услуг не тащил его; admin lists имеют pagination.

**Реализовано в первом пакете.** Для карточек введён узкий `BlogCardData`; latest posts ограничены на уровне Prisma, blog metadata читает один slug, featured navigation использует narrow `select`, shop metadata — `count`. Измерены HTML/RSC diagnostic и encoded browser payload; query duration на сетевом Turso ещё не измерена.

**Будущие кандидаты.** Продолжить проверку оставшихся полных reads и server waterfall по фактическим traces. `generateStaticParams` нельзя механически добавить к страницам с `force-dynamic`, per-request locale/CSP и database-authoritative updates.

### 3.3. Независимые операции и server waterfall

**Наблюдения.** В next-forge есть async Server Components и server actions, но сам source не является доказательством оптимального waterfall. Например, `apps/app/app/(authenticated)/page.tsx` и `search/page.tsx` выполняют database query до `auth()`.

**Принцип для PIP.** Сначала обязательные auth/ownership проверки, затем независимые разрешённые reads можно выполнять параллельно. Зависимые операции и транзакции сохраняют порядок.

**Решение PIP.** Пример query-before-auth из next-forge **не переносится**. Для PIP это противоречит правилу защищать саму операцию и может привести к лишней работе или утечке при ошибке в другом коде.

**Будущий кандидат.** Построить по критичным маршрутам реальную карту request waterfall: middleware → guard → Prisma/provider → RSC → client requests. Оптимизировать доказанные последовательные независимые участки, не переставляя security-границы.

### 3.4. Images, fonts и стабильность загрузки

**Наблюдения.**

- `packages/next-config/index.ts` включает AVIF/WebP и узкий `remotePatterns` allowlist.
- `packages/design-system/lib/fonts.ts` централизует variable fonts Geist Sans/Mono.
- CMS image fragment запрашивает `width`, `height`, `alt` и `blurDataURL`; blog hero image получает `priority` только на странице статьи.

**Принцип для PIP.** Размеры media должны резервировать layout, форматы выбираются существующим pipeline, remote origins остаются allowlisted. Некритичные изображения не блокируют LCP; важный LCP-ресурс определяется измерением, а не назначением `priority` всем изображениям.

**Что уже есть в PIP.** Локальные variable fonts с Cyrillic subsets и `font-display: swap`; Sharp/WebP upload pipeline; локальная официальная графика. Случайные remote images запрещены.

**Будущие кандидаты.** Проверить фактические LCP/CLS и размеры отдаваемых ресурсов по ключевым страницам. Не менять шрифты и визуальную систему только потому, что next-forge использует Geist.

### 3.5. Bundle analysis и стоимость зависимостей

**Наблюдения.**

- `packages/next-config/index.ts` подключает `@next/bundle-analyzer` через `withAnalyzer`.
- `apps/*/next.config.ts` включает analyzer только при `ANALYZE=true`; `apps/*/package.json` содержит `analyze` script.
- `packages/observability/next-config.ts` удаляет Sentry debug logging из client bundle через tree-shaking.

**Принцип для PIP.** Сначала получить карту фактического client/server bundle, затем удалять или откладывать конкретный тяжёлый модуль. Название dependency и размер в `node_modules` не равны вкладу в браузерный bundle.

**Решение PIP.** Добавлены exact dev-only `@next/bundle-analyzer` версии текущего Next.js и команда `npm run analyze`. Analyzer включается только при `ANALYZE=true`; reports сохраняются в `.next/analyze/` и не попадают в Git. Baseline и after сравнивались на production builds, а не по размеру исходников в `node_modules`.

**Будущий кандидат.** Повторять analyzer при изменении client boundaries и сопоставлять его с transferred bytes/browser behavior. Approximate source size по-прежнему нельзя выдавать за точный transferred bytes, а уменьшение chunk — за автоматическое улучшение Web Vitals.

### 3.6. Конфигурация и optional integrations

**Наблюдения.**

- `apps/*/env.ts` и `packages/*/keys.ts` используют Zod/`@t3-oss/env-nextjs` для typed env.
- Многие integrations отключаются при отсутствии ключей; database остаётся обязательной.
- `packages/internationalization/index.ts` загружает dictionary выбранной locale динамическим import и имеет fallback.

**Принцип для PIP.** Конфигурация должна иметь явные server/client границы и безопасные defaults. Отсутствие необязательной интеграции может отключать только её саму; отказ auth, DB, payment или обязательной записи не должен молча превращаться в пустое/успешное состояние.

**Решение PIP.** Новый env toolkit не добавляется. Существующие `doctor`, `db:check`, `deploy:verify`, auth-secret и database checks остаются основой до доказанной необходимости замены.

### 3.7. Observability и её цена

**Наблюдения.**

- `apps/*/instrumentation.ts` экспортирует `onRequestError`; `packages/observability/instrumentation.ts` разделяет Node/Edge initialization.
- `packages/observability/client.ts` включает Sentry Replay с maskAllText/blockAllMedia, console logging и `tracesSampleRate: 1`; server/edge также используют sample rate 1.
- `packages/analytics/server.ts` настроен на немедленный flush в serverless; `packages/next-config/index.ts` содержит PostHog reverse proxy rewrites.
- Source comments прямо отмечают стоимость source maps и дополнительную server load/cost от tunnel route.

**Принцип для PIP.** Ошибки и производительность нужно наблюдать, но telemetry сама расходует CPU, network, деньги и может затрагивать приватность. Sampling, consent, retention и PII policy являются частью реализации.

**Решение PIP.** Значения next-forge `tracesSampleRate: 1`, console forwarding, replay и reverse proxies не копируются как production defaults. Сейчас Sentry/PostHog не добавлены.

**Будущий кандидат.** После выбора окружения и privacy review внедрить минимальные sanitized error/Web Vitals measurements с явной sampling и consent policy. Сначала нужен приёмник и runbook реагирования, иначе telemetry не завершает эксплуатационный сценарий.

### 3.8. Security и rate limiting как часть сценария

**Наблюдения.**

- `apps/app/proxy.ts` и `apps/web/proxy.ts` компонуют auth/security headers и другие middleware; static assets исключаются через matcher.
- `packages/rate-limit/index.ts` использует Upstash sliding window.
- `apps/web/app/[locale]/contact/actions/contact.tsx` применяет rate limit к mutation и возвращает result с ошибкой.

**Принцип для PIP.** Rate limit и auth располагаются на реальном mutation path; static assets не должны без причины оплачивать тяжёлый middleware. Но matcher и cache нельзя менять без negative tests обходов, включая locale-prefixed protected routes.

**Что уже есть в PIP.** Собственные CSP nonce/security headers, Auth.js/RBAC/MFA, Upstash-compatible rate-limit policy и защищённые server operations. Они имеют приоритет над шаблоном.

### 3.9. Turborepo caching — для разработки, не для отклика сайта

**Наблюдения.** Корневой `turbo.json` кэширует build/test/analyze outputs, задаёт зависимости `build` от `test` и `^build`, а `dev` делает persistent и некэшируемым.

**Принцип для PIP.** Build cache может сокращать время CI/разработки, но не уменьшает сам по себе TTFB, LCP или INP пользователя.

**Решение PIP.** Не внедрять Turborepo в однопакетный проект ради обещания «мгновенного сайта». Вопрос CI cache рассматривается отдельно от runtime optimization.

## 4. Ограничения источника: что не является готовым примером

Изучение next-forge не должно превращаться в безоговорочную рекомендацию каждого файла:

1. `apps/app/__tests__/sign-in.test.tsx` проверяет только наличие container, а `apps/api/__tests__/health.test.ts` — простой health response. Это не пример достаточного auth/E2E покрытия для PIP.
2. `apps/web/app/[locale]/contact/components/contact-form.tsx` визуально содержит форму, но не связывает поля и submit с `contact` action. Наличие action и красивого UI рядом не доказывает сквозной сценарий — именно такой разрыв PIP обязан находить своей картой зависимостей.
3. Query-before-auth в authenticated examples не переносится, как указано выше.
4. `packages/observability/error.ts` возвращает message из произвольной ошибки. Для PIP сообщения пользователю должны проходить существующую безопасную локализацию/allowlist, без раскрытия внутренних деталей.
5. Наличие `generateStaticParams`, `Feed`, optional provider или security middleware не доказывает cache hit, корректность production flow или пригодность к Turso/Auth.js PIP без отдельного теста.
6. Skill/reference docs полезны как карта, но при расхождении вывод делается по фактическому source на зафиксированном commit.

Эти ограничения не означают, что next-forge плохой шаблон. Они означают, что production-качество конкретного продукта доказывается его собственными end-to-end проверками.

## 5. Исходные факты PIP для программы оптимизации

Архитектурные ограничения остаются прежними; статус измерений обновлён после первого пакета:

- ключевые публичные и personalized pages в большом количестве используют `force-dynamic`;
- middleware создаёт per-request CSP nonce, обрабатывает locale и protected routes;
- locale зависит от URL/cookie, а admin/customer/staff данные имеют разные security boundaries;
- CMS читается из БД, mutations уже используют `revalidatePath`;
- пользовательские заказы, auth sessions, MFA и staff views нельзя помещать в общий кэш;
- Prisma работает через libSQL/Turso adapter, поэтому сетевая близость БД и количество round trips могут быть важнее микрооптимизации React;
- существуют server-first компоненты, локальные fonts, WebP pipeline, dynamic admin editor/table, pagination и `Promise.all` для части независимых reads;
- первый local production-build baseline browser payload и bundle graph зафиксирован в `docs/performance-baseline.md`; распределения field/staging Web Vitals, SQL timings и cache hit ratio по-прежнему отсутствуют;
- внешняя non-production БД не настроена; для сравнения использовалась только изолированная throwaway SQLite, которую нельзя выдавать за staging/Turso evidence.

Следовательно, нельзя заранее назвать главную причину медленного отклика и нельзя обещать результат от кэша, monorepo или нового SDK.

## 6. Поэтапная программа будущей оптимизации

Каждый этап — отдельная измеримая работа/PR с собственным baseline и rollback. Переход дальше возможен после сохранения корректности предыдущих этапов. Порядок может измениться, если измерения покажут другой доминирующий bottleneck.

### Этап 0. Инвентаризация и воспроизводимый baseline

**Задачи.**

1. Выбрать критичные сценарии: `/`, `/shop`, `/shop/[slug]`, `/blog`, `/blog/[slug]`, `/cart`, `/login`, `/profile`, manager order и admin CMS save.
2. Для каждого записать route rendering mode, auth/personalization, reads/writes, client components, third-party calls и invalidation paths.
3. В production build/start измерить TTFB, LCP, INP, CLS, transferred JS/CSS/fonts/images, число requests и RSC payload.
4. На сервере измерить total duration, middleware/guard/provider/Prisma segments, число SQL round trips, cold/warm различие и p50/p75/p95.
5. Зафиксировать commit, Node/Next versions, hardware, browser, viewport, сеть, объём данных, БД/регион и cache state.
6. Отдельно хранить lab и field/staging результаты. Локальный SQLite не сравнивать напрямую с сетевым Turso.

**Критерий завершения.** Есть повторяемый baseline и назначенный владелец каждой метрики. Целевые бюджеты согласуются после baseline; нельзя выбирать число задним числом под желаемый результат.

**Ориентиры, не текущие результаты.** Для field Web Vitals можно использовать стандартную оценку «good» на p75: LCP не более 2,5 s, INP не более 200 ms, CLS не более 0,1. Для TTFB, SQL и mutation latency задаются route-specific бюджеты. Эти ориентиры не заменяют цель быстрого отклика и не являются обещанием «мгновенности».

### Этап 1. Browser payload и rendering без смены дизайна

**Задачи.**

- Получить bundle report и найти фактические крупные client modules по маршрутам.
- Сузить client boundaries и RSC props, не удаляя интерактивность.
- Отложить тяжёлые редакторы/таблицы/графики, если они не нужны первому экрану; сохранить loading/recovery.
- Проверить duplicated imports, неиспользуемые Spectrum/demo modules и third-party scripts только по реальному bundle graph.
- Измерить fonts/images и устранить доказанные CLS/LCP причины через существующие local font/WebP mechanisms.
- Сохранить messenger-like bottom panel, icon microanimations, glass, plus rotation и timeline behavior. Не возвращать тяжёлые continuous scroll drivers.

**Проверки.** Bundle и transferred bytes до/после, LCP/INP/CLS, keyboard/touch, RU/EN, console/network, production screenshots. Функциональность не удаляется ради бюджета.

### Этап 2. Server и Prisma waterfall

**Задачи.**

- Инструментировать реальные критичные routes без PII и секретов.
- Выполнять guard до protected queries; после него параллелить только независимые reads.
- Заменить full-row reads на необходимые `select`, count — на DB aggregate, N+1 — на доказанно подходящий grouped/joined query.
- Проверить pagination и отсутствие неограниченного чтения ради нескольких карточек/statistics.
- Сопоставить число HTTP/SQL round trips с сетевой задержкой Turso; проверить холодный и тёплый запуск.
- Индексы и схему обсуждать только по фактическим filters/order/joins и query evidence, с предупреждением пользователя.

**Проверки.** Идентичные результаты и права, negative authorization, query count/duration, p50/p75/p95, отсутствие новых silent fallbacks и лишних rows.

### Этап 3. Кэширование и freshness по классам данных

Сначала составить матрицу:

| Класс | Возможный подход | Обязательное условие |
| --- | --- | --- |
| Публичный author-controlled контент | Кандидат на ограниченный data/route cache | Locale и все входы ключа, точная invalidation после CMS save |
| Публичный personalized по cookie URL | Не считать автоматически общим | Нет смешивания RU/EN, consent и user state |
| Customer cart/orders/profile | Никакого shared cache | Актуальная session + ownership на каждом защищённом доступе |
| Staff/admin/manager | Никакого shared cache между пользователями | Role/scope и freshness оперативных данных |
| Auth/MFA/session/payment/webhook | Не кэшировать как безопасную «оптимизацию» | Полные replay/origin/MFA/idempotency guarantees |

**Задачи.**

- Оценить request-scoped dedupe отдельно от cross-request data cache и Full Route Cache.
- Не убирать массово `force-dynamic`, пока не доказано отсутствие per-request dependencies и не решён CSP nonce/locale контракт.
- Для допустимого public cache описать ключи, TTL/revalidate, scheduled publication, empty/error behavior и все mutation invalidations.
- Использовать существующие `revalidatePath` осознанно; не добавлять второй несогласованный cache layer.

**Проверки.** CMS edit виден после сохранения; scheduled post не появляется раньше времени; anonymous не получает чужой response; RU/EN не смешиваются; ошибка БД не закэширована как постоянный empty; повторный запрос доказывает freshness и выигрыш.

### Этап 4. Воспринимаемый отклик mutations и навигации

**Задачи.**

- Устранить лишние client requests и повторные renders по фактическому trace.
- Дать немедленную, честную обратную связь на ввод: native pending/selected state без ожидания необязательной анимации.
- Использовать Suspense/loading только там, где ранний полезный UI действительно возможен без утечки и layout shift.
- Применять optimistic update лишь к обратимым нефинансовым действиям с rollback; auth/payment/role/price confirmation остаются серверно подтверждёнными.
- Сократить лишние `router.refresh`/revalidation, не оставляя stale public/admin views.

**Проверки.** Реальный click-to-useful-response, INP, double-submit, retry, slow/offline network, error recovery, server truth после refresh. Spinner без рабочего server flow не считается быстрым откликом.

### Этап 5. Observability, регрессионные бюджеты и эксплуатация

**Задачи.**

- Добавить минимальные sanitized error/performance measurements с privacy/consent/sampling policy.
- Различать cold start, server latency, DB latency, client download и main-thread work.
- Настроить повторяемый production smoke и критичные browser flows в подходящем CI/staging.
- Ввести bundle/performance budgets только после baseline; один Lighthouse score не делать единственным gate.
- Описать владельца alert, runbook, retention и отключение telemetry при отказе провайдера.

**Проверки.** Telemetry не содержит PII/секреты, не ломает CSP/consent, измеримый overhead согласован, alert ведёт к конкретному действию.

### Этап 6. Архитектурные решения только по доказанной необходимости

Сюда относятся Next.js/React major upgrade, monorepo/Turborepo, смена package manager, DB provider/region, queue, новый cache/observability vendor или разделение apps.

Перед началом обязательны:

- измеренная проблема, которую нельзя устранить меньшим изменением;
- совместимость Auth.js/Prisma/Turso/CMS/security;
- миграционный и rollback план, стоимость владения и тестовая матрица;
- отдельное согласование пользователя, особенно для схемы БД и внешних провайдеров.

## 7. Единый отчёт по каждой оптимизации

```text
Сценарий и commit:
Окружение, данные, браузер, сеть, БД/регион:
Cold или warm, число прогонов:
Baseline (метрики и распределение):
Наблюдённый bottleneck и доказательство:
Гипотеза и одна группа изменений:
Результат после (те же условия):
Цена изменения (bundle, memory, freshness, сложность, vendor):
Корректность (auth, RBAC, данные, mutation, RU/EN, browser):
Что не измерено:
Rollback:
```

Если условия до/после различаются, числа нельзя представлять как строгое сравнение. Если производительность улучшилась только в local SQLite/dev, это не доказывает улучшение production Turso.

## 8. Индекс изученных файлов next-forge

Для повторного аудита использовать commit `f189de79ceef7c1ef69f61f12e272f99b4cdb699`, а не неявно обновившийся `main`.

- Архитектура и команды: `README.md`, `package.json`, `turbo.json`, `skills/next-forge/SKILL.md`, `skills/next-forge/references/architecture.md`, `references/packages.md`.
- Next config и bundle: `packages/next-config/index.ts`, `apps/app/next.config.ts`, `apps/web/next.config.ts`, `apps/app/package.json`, `apps/web/package.json`.
- RSC/dynamic/data: `apps/app/app/(authenticated)/page.tsx`, `layout.tsx`, `search/page.tsx`, `apps/app/app/(unauthenticated)/sign-in/[[...sign-in]]/page.tsx`.
- Публичный контент: `apps/web/app/[locale]/(home)/page.tsx`, `blog/page.tsx`, `blog/[slug]/page.tsx`, `legal/[slug]/page.tsx`, `packages/cms/index.ts`, `components/feed.tsx`, `components/image.tsx`.
- Полный mutation path и его границы: `apps/web/app/[locale]/contact/actions/contact.tsx`, `components/contact-form.tsx`.
- Auth/DB/env/i18n: `packages/auth/server.ts`, `packages/database/index.ts`, `packages/database/prisma/schema.prisma`, `apps/app/env.ts`, `packages/internationalization/index.ts`.
- Security/runtime: `apps/app/proxy.ts`, `apps/web/proxy.ts`, `packages/security/*`, `packages/rate-limit/index.ts`.
- Observability/analytics: `packages/observability/client.ts`, `server.ts`, `edge.ts`, `instrumentation.ts`, `next-config.ts`, `error.ts`, `packages/analytics/instrumentation-client.ts`, `server.ts`, `provider.tsx`.
- Проверки: `apps/app/__tests__/sign-in.test.tsx`, `apps/api/__tests__/health.test.ts`, `.github/workflows/release.yml`.

Этот индекс фиксирует охват изучения. Он не означает, что каждый файл рекомендован к копированию.
