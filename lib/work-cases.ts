/**
 * Работы студии.
 *
 * Раздел «Работы» — главный аргумент сайта, поэтому здесь только то, что можно
 * подтвердить: собственный продукт Line Launcher (публичный репозиторий и
 * реальные экраны), собственный бренд студии и сам этот сайт. Клиентские
 * проекты добавляются сюда только с разрешением на публикацию и в том же
 * формате: контекст → задача → что сделали → результат.
 */

export type WorkLocale = "ru" | "en";

export interface WorkFact {
  label: string;
  value: string;
}

export interface WorkSection {
  title: string;
  body: string;
  bullets?: string[];
}

export interface WorkImage {
  src: string;
  alt: string;
  caption?: string;
}

export interface WorkCaseContent {
  title: string;
  discipline: string;
  summary: string;
  lead: string;
  facts: WorkFact[];
  sections: WorkSection[];
}

export interface WorkCase {
  slug: string;
  year: string;
  cover: string;
  coverAlt: string;
  /** Обложка на карточке: кадр целиком или вписать знак. */
  coverFit?: "cover" | "contain";
  gallery: WorkImage[];
  related: Array<{ label: Record<WorkLocale, string>; href: string }>;
  content: Record<WorkLocale, WorkCaseContent>;
}

export const WORK_CASES: WorkCase[] = [
  {
    slug: "line-launcher",
    year: "2024—2026",
    cover: "/assets/line-launcher/line-servers.webp",
    coverAlt: "Экран списка серверов в Line Launcher",
    gallery: [
      {
        src: "/assets/line-launcher/line-welcome.webp",
        alt: "Первый экран Line Launcher",
        caption: "Первый экран: вход в игру без регистрации и ручной настройки",
      },
      {
        src: "/assets/line-launcher/line-servers.webp",
        alt: "Список серверов Line Launcher",
        caption: "Выбор сервера: актуальные адреса и версии рядом с кнопкой «Играть»",
      },
      {
        src: "/assets/line-launcher/line-profile.webp",
        alt: "Профиль игрока Line Launcher",
        caption: "Профиль: скины и история сессий в одном месте",
      },
      {
        src: "/assets/line-launcher/line-settings.webp",
        alt: "Настройки Line Launcher",
        caption: "Настройки: память, Java и аргументы запуска без правки конфигов",
      },
    ],
    related: [
      { label: { ru: "Страница продукта", en: "Product page" }, href: "/line-launcher" },
    ],
    content: {
      ru: {
        title: "Line Launcher",
        discipline: "Продуктовый дизайн и интерфейс",
        summary:
          "Лаунчер Minecraft, который избавляет игрока от ручной настройки серверов, Java и аргументов запуска.",
        lead:
          "Собственный продукт студии. Мы проектируем интерфейс и собираем его: от первого экрана до профиля игрока и настроек запуска. Продукт развивается публично — версия, стек и экраны можно проверить в репозитории.",
        facts: [
          { label: "Роль", value: "Дизайн интерфейса и фронтенд" },
          { label: "Платформы", value: "Windows | Linux" },
          { label: "Стек", value: "Tauri 2.12, Rust, React 19" },
          { label: "Статус", value: "0.15.4, в разработке" },
        ],
        sections: [
          {
            title: "Задача",
            body:
              "Обычный путь игрока выглядит так: найти сборку, разобраться с версией Java, прописать адрес сервера, поймать ошибку в логах. Мы хотели сократить это до одного нажатия «Играть».",
          },
          {
            title: "Что сделали",
            body:
              "Собрали лаунчер как нативное приложение: список серверов, профиль со скинами, настройки памяти и Java — в одном окне, без внешних конфигов.",
            bullets: [
              "Экран серверов с версиями и статусом — главный сценарий в один клик",
              "Профиль игрока: скины и сессии без перехода в веб-кабинет",
              "Настройки запуска с понятными значениями по умолчанию",
              "Светлая и тёмная темы, клавиатурная навигация по основным действиям",
            ],
          },
          {
            title: "Решения",
            body:
              "Лаунчер не изобретает новый способ играть: он убирает шаги, которые не относятся к игре. Поэтому в интерфейсе нет мастеров настройки и модальных окон на старте — только список серверов и кнопка запуска.",
          },
        ],
      },
      en: {
        title: "Line Launcher",
        discipline: "Product design and interface",
        summary:
          "A Minecraft launcher that removes manual server, Java and startup-argument setup from the player's path.",
        lead:
          "The studio's own product. We design the interface and build it — from the first screen to the player profile and launch settings. The product is developed in public: version, stack and screens can be checked in the repository.",
        facts: [
          { label: "Role", value: "Interface design and frontend" },
          { label: "Platforms", value: "Windows | Linux" },
          { label: "Stack", value: "Tauri 2.12, Rust, React 19" },
          { label: "Status", value: "0.15.4, in development" },
        ],
        sections: [
          {
            title: "The problem",
            body:
              "The usual player path: find a build, work out the Java version, type in a server address, then read an error in the logs. We wanted to reduce that to a single Play button.",
          },
          {
            title: "What we did",
            body:
              "We built the launcher as a native app: server list, profile with skins, memory and Java settings in one window, without external config files.",
            bullets: [
              "Server screen with versions and status — the main scenario in one click",
              "Player profile: skins and sessions without a web dashboard",
              "Launch settings with sensible defaults",
              "Light and dark themes, keyboard navigation for primary actions",
            ],
          },
          {
            title: "Decisions",
            body:
              "The launcher does not invent a new way to play: it removes the steps that are not about playing. That is why there are no setup wizards or startup modals — only the server list and the Play button.",
          },
        ],
      },
    },
  },
  {
    slug: "plus-in-plus-brand",
    year: "2024—2026",
    cover: "/assets/work/brand-cover.svg",
    coverAlt: "Знак и палитра Plus In Plus",
    coverFit: "cover",
    gallery: [
      {
        src: "/assets/logos/npip.svg",
        alt: "Словесный знак Plus In Plus",
        caption: "Словесный знак: гротеск и плюс, собранный из квадратов",
      },
    ],
    related: [],
    content: {
      ru: {
        title: "Бренд Plus In Plus",
        discipline: "Айдентика",
        summary:
          "Знак, палитра и типографика студии — от логотипа на фасаде до интерфейса и документов.",
        lead:
          "Собственная айдентика — это тоже работа, которую можно показать. Мы собрали её как систему: знак, четыре цвета, один гротеск и правила, по которым они живут на вывеске, в интерфейсе и в печати.",
        facts: [
          { label: "Роль", value: "Айдентика и дизайн-система" },
          { label: "Палитра", value: "#EEEEEE | #FF5F01 | #110F10 | #2B292A" },
          { label: "Знак", value: "Плюс в сетке 6×6" },
          { label: "Носители", value: "Сайт, документы, вывеска" },
        ],
        sections: [
          {
            title: "Знак",
            body:
              "Плюс собирается из квадратов на сетке, поэтому одинаково читается на вывеске в несколько метров и в фавиконе 16×16. Форма не зависит от контекста — она и есть константа бренда.",
          },
          {
            title: "Цвет",
            body:
              "Четыре цвета и жёсткое правило: оранжевый #FF5F01 принадлежит действию, а не декору. Светлый #EEEEEE держит вторичные действия и текст на тёмном, поверхности #110F10 и #2B292A — глубину.",
          },
          {
            title: "Типографика и носители",
            body:
              "Один гротеск и крупные кегли: заголовок должен читаться с двадцати метров на вывеске и оставаться спокойным в интерфейсе. Из этого выросла вся сетка сайта.",
            bullets: [
              "Заголовки — крупный гротеск, без декоративных начертаний",
              "Подписи — тот же шрифт, уменьшенный кегль и разрядка",
              "Соотношение 60/30/10: тёмная основа, поверхности, акцент",
            ],
          },
        ],
      },
      en: {
        title: "Plus In Plus brand",
        discipline: "Identity",
        summary:
          "The studio's mark, palette and typography — from a facade sign to the interface and documents.",
        lead:
          "Our own identity is work we can show. We built it as a system: one mark, four colours, one grotesque and the rules that let them live on a sign, in an interface and in print.",
        facts: [
          { label: "Role", value: "Identity and design system" },
          { label: "Palette", value: "#EEEEEE | #FF5F01 | #110F10 | #2B292A" },
          { label: "Mark", value: "A plus on a 6×6 grid" },
          { label: "Surfaces", value: "Website, documents, signage" },
        ],
        sections: [
          {
            title: "The mark",
            body:
              "The plus is built from squares on a grid, so it reads the same on a multi-metre sign and in a 16×16 favicon. The form does not depend on context — it is the brand's constant.",
          },
          {
            title: "Colour",
            body:
              "Four colours and one hard rule: orange #FF5F01 belongs to action, not decoration. #EEEEEE holds secondary actions and text on dark, while #110F10 and #2B292A build depth.",
          },
          {
            title: "Typography and surfaces",
            body:
              "One grotesque and large sizes: a headline must read from twenty metres on a facade and stay calm inside an interface. The site grid grew out of the same rule.",
            bullets: [
              "Headlines — large grotesque, no decorative cuts",
              "Labels — the same typeface at a smaller size with tracking",
              "A 60/30/10 balance: dark base, surfaces, accent",
            ],
          },
        ],
      },
    },
  },
  {
    slug: "studio-website",
    year: "2026",
    cover: "/assets/work/site-home.webp",
    coverAlt: "Главная страница сайта Plus In Plus",
    gallery: [
      {
        src: "/assets/work/site-home.webp",
        alt: "Главная страница сайта студии",
        caption: "Главная: позиционирование, работы и один путь к брифу",
      },
      {
        src: "/assets/work/site-services.webp",
        alt: "Каталог услуг студии",
        caption: "Услуги: малые и крупноформатные решения в одной сетке",
      },
      {
        src: "/assets/work/site-journal.webp",
        alt: "Журнал студии",
        caption: "Журнал: featured-материал и карточки с временем чтения",
      },
    ],
    related: [],
    content: {
      ru: {
        title: "Сайт студии",
        discipline: "Структура и дизайн-система",
        summary:
          "Сайт, который вы читаете: карта разделов, графический язык на Hazeglow и реализация на Next.js.",
        lead:
          "Этот сайт — тоже кейс: мы перестроили его вокруг работ, убрали разделы-метафоры из меню и собрали графический язык на одном примитиве. Здесь видно и результат, и инженерную часть.",
        facts: [
          { label: "Роль", value: "Структура, дизайн, фронтенд" },
          { label: "Стек", value: "Next.js 16.4, React 19.3, Tailwind 4.3" },
          { label: "Графика", value: "Hazeglow 0.6.1, WebGL2" },
          { label: "Проверки", value: "tsc, ESLint, 485 тестов" },
        ],
        sections: [
          {
            title: "Структура",
            body:
              "Меню сократилось до четырёх задач: работы, услуги, студия, журнал. Соцсети и аккаунт ушли в подвал, а разделы, которые раньше жили якорями на главной, получили собственные адреса.",
          },
          {
            title: "Графический язык",
            body:
              "Все визуальные сцены собраны на одном примитиве Hazeglow в двух режимах — dither и ascii. Пиксельные спрайты и сторонние макеты удалены: язык студии один.",
            bullets: [
              "Dither — фон первого экрана и карточки направлений",
              "Ascii — панель продукта",
              "Нейтральные медиа-слоты — та же растровая сетка на CSS",
            ],
          },
          {
            title: "Инженерия",
            body:
              "Сайт отдаёт контент сервером, работает с клавиатуры, уважает reduced motion и проверяется тестами на контраст, палитру, маршруты и локализацию.",
          },
        ],
      },
      en: {
        title: "Studio website",
        discipline: "Structure and design system",
        summary:
          "The site you are reading: a section map, a graphic language built on Hazeglow and a Next.js implementation.",
        lead:
          "This site is a case too: we rebuilt it around the work, removed metaphor-driven menu items and built one graphic primitive. Both the result and the engineering are visible here.",
        facts: [
          { label: "Role", value: "Structure, design, frontend" },
          { label: "Stack", value: "Next.js 16.4, React 19.3, Tailwind 4.3" },
          { label: "Graphics", value: "Hazeglow 0.6.1, WebGL2" },
          { label: "Checks", value: "tsc, ESLint, 485 tests" },
        ],
        sections: [
          {
            title: "Structure",
            body:
              "The menu shrank to four tasks: work, services, studio, journal. Social links and the account moved to the footer, and sections that used to live as anchors on the home page got their own addresses.",
          },
          {
            title: "Graphic language",
            body:
              "Every visual scene is built on one Hazeglow primitive in two modes — dither and ascii. Pixel sprites and third-party mockups were removed: the studio has a single language.",
            bullets: [
              "Dither — hero background and direction cards",
              "Ascii — the product panel",
              "Neutral media slots — the same halftone grid in CSS",
            ],
          },
          {
            title: "Engineering",
            body:
              "The site renders content on the server, works from the keyboard, respects reduced motion and is covered by tests for contrast, palette, routes and localisation.",
          },
        ],
      },
    },
  },
];

export function getWorkCase(slug: string): WorkCase | undefined {
  return WORK_CASES.find((item) => item.slug === slug);
}

export interface LocalizedWorkCase extends Omit<WorkCase, "content"> {
  title: string;
  discipline: string;
  summary: string;
  lead: string;
  facts: WorkFact[];
  sections: WorkSection[];
}

export function localizeWorkCase(item: WorkCase, locale: WorkLocale): LocalizedWorkCase {
  const { content, ...rest } = item;
  return { ...rest, ...content[locale] };
}

export function localizeWorkCases(
  items: WorkCase[],
  locale: WorkLocale,
): LocalizedWorkCase[] {
  return items.map((item) => localizeWorkCase(item, locale));
}
