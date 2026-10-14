# Этап 3 — Расширенное внедрение (broad adoption)

## Цель

Перевести на Spectrum UI не только «спокойные» админские контролы, но и
высокочастотные элементы — таблицы админки и все кнопки публичного сайта.
**Обязательное условие:** внешний вид (цвета бренда, геометрия, ховеры) и
поведение не меняются ни на пиксель.

---

## 1. Таблицы админки

### Что было

| Файл | Было |
|---|---|
| `components/admin/services-table.tsx` | 147 строк, ручная разметка `<table>` |
| `components/admin/posts-table.tsx` | 94 строки |
| `components/admin/users-table.tsx` | 63 строки |

Ручная пагинация, ручной выбор строк, сортировка только по одной колонке,
инлайновая панель истории действий.

### Что стало

Все три переписаны на `AdminDataTable` — тонкую обёртку над Spectrum
`DataTable` (`components/admin/admin-data-table.tsx`).

**Зачем отдельная обёртка.** Прямое использование Spectrum `DataTable`
увеличивало First Load JS на 48 kB (174 → 222 kB) — он тянет `motion`.
`AdminDataTable` грузит его через `next/dynamic(..., { ssr: false })` и
показывает `AdminTableSkeleton` на время загрузки. Итог: **+2–3 kB** вместо 48.

### Разделение ответственности за фильтры

| Фильтр | Реализация |
|---|---|
| Статус | `quickFilter` (пилюли Published/Draft) |
| Категория (услуги) | `Select` внутри `toolbar` |
| Источник / «в избранное» (посты) | `Select` внутри `toolbar` |
| Поиск | `searchable` + `searchText` |
| Размер страницы | `Select` в `toolbar` → проп `pageSize` |

Сортировка переехала с выпадающего списка на кликабельные заголовки колонок.

### Что получили сверх прежнего

- сортировка по любой колонке, а не только по одной;
- клавиатурная навигация и фокус-менеджмент;
- копирование выделенных строк в буфер обмена;
- панель истории действий пользователя — через disclosure-панель
  (`renderDetail`) вместо инлайнового раскрытия.

### Объём кода

Сравнение по строкам некорректно (исходники были спрессованы в однострочный
JSX), поэтому замер по символам без пробелов:

| Файл | Было | Стало | Δ |
|---|---|---|---|
| `posts-table.tsx` | 8 683 | 6 361 | −2 322 |
| `services-table.tsx` | 8 596 | 5 674 | −2 922 |
| `users-table.tsx` | 4 877 | 4 557 | −320 |
| **Итого** | **22 156** | **16 592** | **−5 564 (−25 %)** |

---

## 2. Кнопки публичного сайта

Все кнопки теперь идут через единую брендовую систему
`components/ui/button.tsx` (внутри — Spectrum `LoadingButton`),
`components/ui/header-button.tsx` или `buttonVariants`.

| Файл | Изменение |
|---|---|
| `components/ui/button.tsx` | добавлен вариант `cta` — `bg-[#00C56D]` / `text-[#052B42]` / `hover:bg-[#00B361]`; единственное место, где зелёный — заливка кнопки |
| `components/site/hero-section.tsx` | две самодельные CTA → `<Button asChild variant="cta" size="lg">` и `<Button asChild variant="outline" size="lg">` |
| `components/site/service-card.tsx` | «Подробнее» → `buttonVariants` с `group-hover:bg-[#0A4366]` |
| `components/site/shop-service-card.tsx` | то же, с сохранением всех `sm:`/`xl:` размеров |
| `components/site/contact-form.tsx` | submit → `<Button size="lg">` |
| `components/site/footer-subscribe-form.tsx` | submit → `<Button size="sm">` + `h-10` |
| `components/ui/header-button.tsx` | переведён на Spectrum `LoadingButton`; `asChild` сохраняет нативную семантику ссылки |
| `components/site/breadcrumb-back.tsx` | уже использовал `buttonVariants` — подхватилось автоматически |

### Почему `group-hover`, а не обычный `hover`

На карточках подсвечиваться должен весь тайл, а не только полоска кнопки.
`group-hover:bg-[#0A4366]` перекрывает `hover:bg-[#153c5c]` из варианта —
проверено разбором специфичности: `group-hover` выигрывает, значит тайл
продолжает подсвечиваться так же, как раньше.

### Проверка эквивалентности

Визуально сверить карточки не удалось (БД не настроена — публичные страницы
рендерят пустые состояния), поэтому эквивалентность проверена программно:
старый и новый наборы классов прогнаны через `twMerge` и сравнены.

```
--- service-card ---        потеряно значимых классов: нет ✓
--- shop-service-card ---   потеряно значимых классов: нет ✓
CTA КАРТОЧЕК ЭКВИВАЛЕНТНЫ ✓
```

Отдельно проверено в отрендеренном HTML:

- hero CTA `/shop`: `bg-[#00C56D] text-[#052B42] hover:bg-[#00B361] h-12 px-8 rounded-xl min-w-[168px] text-base font-medium` — совпадает с оригиналом;
- hero CTA `/contact`: `border-[#052B42] bg-transparent text-[#052B42] h-12 px-8 rounded-xl min-w-[168px] text-base font-medium hover:bg-navy/5` — совпадает;
- хедер: 2 кнопки, обе `h-9` + `rounded-full`;
- утечек серого Spectrum (`bg-primary`, `outline-hidden`, `rounded-md`) — нет;
- `py-2` из дефолтного размера Spectrum подавлен через `py-0` в базе CVA.

---

## 3. Стоимость бандла

| Маршрут | Этап 2 | Этап 3 | Δ |
|---|---|---|---|
| First Load JS (общий) | 102 kB | 102 kB | 0 |
| `/` | 139 kB | **142 kB** | +3 |
| `/shop` | 139 kB | **142 kB** | +3 |
| `/shop/[slug]` | 139 kB | 139 kB | 0 |
| `/blog` | 134 kB | 134 kB | 0 |
| `/blog/[slug]` | 140 kB | 141 kB | +1 |
| `/contact` | 131 kB | **134 kB** | +3 |
| `/admin` | 103 kB | 103 kB | 0 |
| `/admin/blog` | 175 kB | **177 kB** | +2 |
| `/admin/blog/[id]` | 270 kB | 271 kB | +1 |
| `/admin/services` | 174 kB | **176 kB** | +2 |
| `/admin/services/[id]` | 173 kB | 174 kB | +1 |
| `/admin/settings` | 131 kB | 132 kB | +1 |
| `/admin/users` | 164 kB | **167 kB** | +3 |
| `/test-spectrum` | 259 kB | 250 kB | −9 |

Публичные маршруты: **+3 kB** — цена подключения кнопок к Spectrum
(`LoadingButton` + `@radix-ui/react-slot`). Админские списки: **+2–3 kB** —
обёртка над `DataTable`; сам `motion` (+48 kB) ушёл в асинхронный чанк.

---

## 4. Проверки

- `npx tsc --noEmit` — без ошибок ✅
- `npm run lint` — «No ESLint warnings or errors» ✅
- `rm -rf .next && npm run build` — exit 0 ✅
- HTTP 200: `/`, `/shop`, `/blog`, `/contact`, `/test-spectrum` ✅

`/test-spectrum` переведён с прямого импорта `DataTable` на `AdminDataTable`,
чтобы обёртка тоже исполнялась в рантайме: скелетон рендерится на сервере
(`loadingTable` присутствует), таблица подгружается на клиенте.

---

## Что не тронули и почему

| Компонент | Причина |
|---|---|
| Кнопки-стрелки карусели (`news-carousel.tsx`) | `h-8 w-8 rounded-full` — чисто иконочные круги; брендовая кнопка добавила бы лишние `text-sm`/`font-semibold` |
| Превью галереи (`post-gallery.tsx`) | миниатюры и бейджи, не кнопки |
| Анимации (`hero-image-slideshow.tsx`, `floating-images.tsx`, `logo.tsx`) | не являются Spectrum-компонентами; трогать = риск потерять анимации |

---

## Следующий этап (4)

1. Удалить `app/test-spectrum/`.
2. Убрать неиспользуемые примитивы shadcn.
3. Финальные `npm run lint` и `npm run build`.
