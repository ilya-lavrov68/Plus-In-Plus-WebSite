# Plus In Plus: визуальный контракт на структуре payloadcms.com

## 1. Источник композиции

Пользователь отменил предыдущий редизайн по jpg-референсу и попросил заново воспроизвести **структуру и ритм [payloadcms.com](https://payloadcms.com/)**, наполнив её нашим контентом:

- плоская тёмная страница без «карточек-островов», весь каркас держится на hairline-границах;
- один крупный заголовок в hero, короткий лид, две кнопки и колонка быстрых переходов;
- секции-полосы с одинаковым вертикальным шагом: eyebrow → H2 → содержимое;
- карточки без теней и без скруглённых «пузырей»: тонкая рамка, мягкий радиус 14 px, внутренние отступы;
- лента направлений вместо ленты логотипов;
- финальный CTA — центрированная полоса, а не большая цветная плашка;
- футер — короткие строки ссылок, а не простыня колонок.

Копируется **только композиция и типографическая иерархия**. Тексты, изображения, логотипы, структура данных, CMS, i18n и серверная логика — собственные.

Палитра — наша: графит `#181819` и жёлтый `#FFFF01`. Монохром Payload не используется.

## 2. Палитра

| Роль | Значение | Токен |
| --- | --- | --- |
| Фон темы | `#181819` | `--background` |
| Несущая поверхность | `#1C1C1E` | `--card`, `--popover` |
| Hairline-граница | `#2B2B2E` | `--border`, `--input` |
| Основной текст | `#F4F4F2` | `--foreground` |
| Вторичный текст | `#A6A6AE` | `--muted-foreground` |
| **Главный сигнал** | `#FFFF01` | `--primary`, `--pip-signal`, `--color-brand-signal` |
| Светлый сигнал | `#FFFFA3` | `--pip-signal-strong` |
| Сигнальный wash | `#F7F7CC` | `--pip-signal-wash` |
| Глубокая сигнальная подложка | `#23230D` | `--pip-signal-deep` |
| **Вторичный periwinkle** | `#8F9CFC` | `--pip-violet`, `--color-brand-violet` |
| Светлый periwinkle | `#AFB8FD` | `--pip-violet-strong` |
| Periwinkle wash | `#EAEDFE` | `--pip-violet-wash` |
| Глубокий periwinkle | `#1E2238` | `--pip-violet-deep` |
| Текст на жёлтом | `#12131B` | `--primary-foreground` |

Жёлтый отвечает за действия: primary-кнопка, акцентное слово в заголовке, focus, активный пункт навигации. Periwinkle остаётся в резерве и в новых блоках не используется. Правило 60/30/10 сохраняется: графит и текст — основа, нейтральные поверхности — второй слой, жёлтый — не более 10 %.

## 3. Форма

Форма мягкая, как у Payload:

1. `--radius-sm…4xl` = 6 / 10 / 14 / 18 / 24 / 28 / 32 px, `--radius` = 14 px; `rounded-none` остаётся только у служебных элементов (админка, разделители).
2. Все кнопки — `rounded-full`. `default` / `primary` / `cta` — жёлтый pill с hover `bg-brand-signal-strong`. `secondary` / `outline` — прозрачный pill с hairline-обводкой.
3. Карточки — `.pip-card`: `--card`, hairline `border-border`, `--radius-lg`, без теней и без glow.
4. Подписи-надзаголовки — `.pip-mono`: uppercase mono 0.6875 rem, tracking 0.16em.
5. Медиа — `.pip-media-frame`: рамка `--radius-lg` с hairline, чтобы будущие изображения вставали в сетку без переделки разметки.

Тени запрещены полностью (`shadow*`, `box-shadow`, `text-shadow`, ring-as-shadow). Видимый focus-outline обязателен. `pip-cursor-fill` больше не рисует волну: это простой `background-color` + hover 160 ms.

## 4. Главная

Порядок секций повторяет эталон:

| # | Секция | Компонент | Содержание |
| --- | --- | --- | --- |
| 1 | Hero | `components/blocks/hero138.tsx` | eyebrow `.pip-mono`, H1 в две строки с жёлтым хвостом, лид, две pill-кнопки, footnote, колонка `quickLinks` (услуги / ИИ / контакт) |
| 2 | Лента направлений | `DirectionMarquee` | шесть направлений студии вместо логотипов клиентов |
| 3 | Сплит | `SplitDirections` | две практики: дизайн и ИИ, две карточки в общей рамке `gap-px bg-border` |
| 4 | Сценарии | `UseCases` | 4 карточки 2×2: вывески, айдентика, Lumi Q1 / Kairo, каталог-заказ |
| 5 | Процесс | `Process` | `<ol>` из 4 шагов: бриф, концепция, продакшн, поддержка |
| 6 | Манифест | `Manifesto` | H2 + два абзаца + текстовая ссылка |
| 7 | Блог | `BlogSection` | свежие материалы |
| 8 | CTA | `components/blocks/cta13.tsx` | центрированная полоса, две кнопки |

`components/blocks/home-sections.tsx` содержит секции 2–6. Hero не использует орнаменты, мозаику и медиа: сейчас это типографический каркас, медиа добавим отдельным шагом.

## 5. Прочие маршруты

- Внутренние страницы сохраняют прежние данные и формы, но приводятся к тем же принципам: mono-eyebrow, pill-кнопки, hairline-карточки, плотные списки, шаг секций как на главной.
- Геометрические примитивы `components/site/brand-geometry.tsx` (`PixelMosaic`, `DotLattice`, `GridField`, `SignalBlocks`) остаются в коде и на внутренних страницах через `components/site/page-geometry.tsx`. На главной они больше не применяются — структура важнее орнамента. Все примитивы детерминированы (math-хеш без `Math.random`), `aria-hidden` и `pointer-events-none`.
- Шапка: hairline снизу, высота 64 px, нейтральные ссылки, активный пункт жёлтый, справа язык / корзина / кабинет / pill-CTA.
- Footer: подпись студии, соцсети, пять коротких групп ссылок и нижняя строка с копирайтом.
- Админка (`payload/components/admin-brand.tsx`, `app/(payload)/custom.scss`) в редизайн не входит.

## 6. Контент

- H1: «Дизайн, который / работает / на улице»;
- eyebrow: «Plus In Plus · дизайн и ИИ»;
- footnote: «Открыт бриф · ответ в течение дня»;
- CTA: «Обсудить проект» / «Смотреть услуги»;
- Manifecto: «Мы строим форму, которой можно владеть.»

Тексты короткие и техничные, RU и EN синхронны. Ключи `messages/*.json` не переименовываются; новые ключи — `marquee1…6`, `split.*`, `cases.*`, `process.*`, `manifesto.*`, `quick*`, `newsTitle`.

## 7. Assets

- `public/assets/logos/lnpip.svg`, `npip.svg` — жёлтые `#FFFF01` сигнальные элементы и белые нейтрали;
- `public/assets/pixels/direction-*.png` — пересобраны `npm run sprites:directions`;
- `public/assets/agents/*` — предрендеренные shader-циклы в жёлтой рампе;
- `docs/brand/hero-preview.svg` — схема hero (вектор, не screenshot).

## 8. Проверка

- `npx tsc --noEmit` и `npx eslint .` — без ошибок;
- `npm test` — контрактные тесты: `tests/brand-geometry.test.cjs` (порядок секций, токены, отсутствие орнаментов в hero), `tests/cursor-fill.test.cjs` (pill-кнопки, радиусы, запрет теней), `tests/site-components.test.cjs`, `tests/story-components.test.cjs`, `tests/admin-animated-icons.test.cjs`, `tests/direction-sprites.test.cjs`;
- серверный рендер: `/ru`, `/ru/services`, `/ru/ai`, `/ru/ai/lumi`, `/ru/ai/kairo`, `/ru/blog`, `/ru/contact`, `/ru/login`, `/ru/signup`, `/ru/privacy`, `/ru/terms`, `/ru/shop`, `/ru/cart`.

Ограничение: в песочнице нет браузера (Chromium не запускается без `libnspr4`/`libnss3`), поэтому визуальный review, скриншоты и hover проверяются вне песочницы.
