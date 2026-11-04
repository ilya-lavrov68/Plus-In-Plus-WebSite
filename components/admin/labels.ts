import type { RequestLocale } from "@/lib/request-locale";

/**
 * Подписи админки. Русский и английский варианты объявлены рядом, поэтому
 * расхождение видно в диффе, а не на проде.
 */
export function adminLabels(locale: RequestLocale) {
  const ru = locale === "ru";
  return {
    ru,
    brand: "Plus In Plus",
    shell: {
      title: ru ? "Админ-панель" : "Admin panel",
      nav: ru ? "Разделы админки" : "Admin sections",
      viewSite: ru ? "Открыть сайт" : "Open site",
      role: ru ? "Роль" : "Role",
      skip: ru ? "К основному содержимому" : "Skip to content",
      menu: ru ? "Меню" : "Menu",
    },
    nav: {
      overview: ru ? "Обзор" : "Overview",
      orders: ru ? "Заказы" : "Orders",
      services: ru ? "Услуги" : "Services",
      products: ru ? "Товары" : "Products",
      posts: ru ? "Материалы" : "Posts",
      accounts: ru ? "Аккаунты" : "Accounts",
      activity: ru ? "Активность" : "Activity",
      settings: ru ? "Настройки" : "Settings",
      story: ru ? "История" : "Story",
      media: ru ? "Медиатека" : "Media",
    },
    roles: {
      FOUNDER: ru ? "Основатель" : "Founder",
      ADMIN: ru ? "Администратор" : "Admin",
      MANAGER: ru ? "Менеджер" : "Manager",
      USER: ru ? "Пользователь" : "User",
    } as Record<string, string>,
    statuses: {
      pending: ru ? "Новая заявка" : "New request",
      quote_requested: ru ? "Запрошен расчёт" : "Quote requested",
      negotiating: ru ? "Согласование" : "Negotiating",
      priced: ru ? "Цена согласована" : "Priced",
      awaiting_payment: ru ? "Ожидает оплаты" : "Awaiting payment",
      paid: ru ? "Оплачен" : "Paid",
      in_progress: ru ? "В работе" : "In progress",
      completed: ru ? "Завершён" : "Completed",
      cancelled: ru ? "Отменён" : "Cancelled",
      refunded: ru ? "Возврат" : "Refunded",
    } as Record<string, string>,
    overview: {
      title: ru ? "Рабочий обзор" : "Operations overview",
      subtitle: ru
        ? "Заказы, выручка и трафик за последние 30 дней."
        : "Orders, revenue and traffic over the last 30 days.",
      queue: ru ? "В очереди" : "In queue",
      queueHint: ru ? "Заявки и заказы без финального статуса" : "Requests and orders not yet finished",
      revenue: ru ? "Выручка" : "Revenue",
      revenueHint: ru ? "Оплачено и в работе" : "Paid and in progress",
      paidOrders: ru ? "Оплаченных заказов" : "Paid orders",
      average: ru ? "Средний чек" : "Average order",
      views: ru ? "Просмотры" : "Page views",
      visitors: ru ? "Посетители" : "Visitors",
      avgTime: ru ? "Среднее время" : "Avg. time",
      trafficTitle: ru ? "Трафик" : "Traffic",
      trafficHint: ru ? "Просмотры и уникальные посетители по дням" : "Views and unique visitors per day",
      revenueTitle: ru ? "Выручка по дням" : "Revenue per day",
      revenueEmpty: ru ? "Оплаченных заказов пока нет" : "No paid orders yet",
      sourcesTitle: ru ? "Источники" : "Sources",
      devicesTitle: ru ? "Устройства" : "Devices",
      topPagesTitle: ru ? "Популярные страницы" : "Top pages",
      recentOrdersTitle: ru ? "Последние заказы" : "Recent orders",
      activityTitle: ru ? "Активность" : "Activity",
      allOrders: ru ? "Все заказы" : "All orders",
      contentTitle: ru ? "Контент" : "Content",
      empty: ru ? "Пока нет данных" : "No data yet",
    },
    table: {
      order: ru ? "Заказ" : "Order",
      customer: ru ? "Клиент" : "Customer",
      status: ru ? "Статус" : "Status",
      total: ru ? "Сумма" : "Total",
      date: ru ? "Дата" : "Date",
      save: ru ? "Сохранить" : "Save",
      open: ru ? "Открыть" : "Open",
      title: ru ? "Название" : "Title",
      category: ru ? "Категория" : "Category",
      price: ru ? "Цена" : "Price",
      stock: ru ? "Остаток" : "Stock",
      published: ru ? "Опубликовано" : "Published",
      active: ru ? "Активно" : "Active",
      visible: ru ? "Видно" : "Visible",
      hidden: ru ? "Скрыто" : "Hidden",
      source: ru ? "Источник" : "Source",
      email: ru ? "E-mail" : "E-mail",
      name: ru ? "Имя" : "Name",
      role: ru ? "Роль" : "Role",
      blocked: ru ? "Заблокирован" : "Blocked",
      created: ru ? "Создан" : "Created",
      action: ru ? "Действие" : "Action",
      entity: ru ? "Объект" : "Entity",
      empty: ru ? "Записей нет" : "No records",
      yes: ru ? "Да" : "Yes",
      no: ru ? "Нет" : "No",
      quote: ru ? "по запросу" : "on request",
      editLink: ru ? "Изменить" : "Edit",
      create: ru ? "Создать" : "Create",
    },
    orders: {
      title: ru ? "Заказы" : "Orders",
      subtitle: ru ? "Все заявки и заказы, кроме корзин." : "All requests and orders, excluding carts.",
      all: ru ? "Все статусы" : "All statuses",
      filter: ru ? "Фильтр по статусу" : "Filter by status",
      updated: ru ? "Статус обновлён" : "Status updated",
      updateFailed: ru ? "Не удалось обновить статус" : "Could not update the status",
      statusOf: ru ? "Статус заказа" : "Order status",
    },
    services: { title: ru ? "Услуги" : "Services", subtitle: ru ? "Каталог услуг и цены." : "Service catalog and pricing." },
    service: {
      title: ru ? "Название" : "Title",
      shortDesc: ru ? "Краткое описание" : "Short description",
      fullDesc: ru ? "Полное описание" : "Full description",
      priceType: ru ? "Тип цены" : "Price type",
      priceFrom: ru ? "от" : "from",
      priceRubles: ru ? "Цена, ₽" : "Price, RUB",
      sortOrder: ru ? "Порядок вывода" : "Sort order",
      categorySmall: ru ? "Малый дизайн" : "Small design",
      categoryLarge: ru ? "Крупный формат" : "Large format",
      isPublished: ru ? "Опубликовано" : "Published",
      isActive: ru ? "Показывать в каталоге" : "Visible in the catalog",
      saved: ru ? "Услуга сохранена." : "Service saved.",
      cancel: ru ? "Назад" : "Back",
      readOnly: ru ? "Редактировать услуги может только администратор." : "Only an admin can edit services.",
      activeOrders: ru ? "По услуге идут активные заказы: {count}. Цена и тип цены заблокированы." : "Active orders on this service: {count}. Price and price type are locked.",
      pricingLocked: ru ? "Снимите блокировку цены может только основатель — либо дождитесь закрытия активных заказов." : "Only the founder can override the price lock, or wait until the active orders are closed.",
      edit: ru ? "Изменить" : "Edit",
      create: ru ? "Новая услуга" : "New service",
    },
    post: {
      title: ru ? "Заголовок" : "Title",
      slug: ru ? "Адрес (slug)" : "Slug",
      excerpt: ru ? "Краткое описание" : "Excerpt",
      content: ru ? "Текст (Markdown или HTML)" : "Content (Markdown or HTML)",
      readTime: ru ? "Время чтения, мин" : "Read time, min",
      sourceUrl: ru ? "Ссылка на источник" : "Source URL",
      isPublished: ru ? "Опубликовано" : "Published",
      isFeatured: ru ? "В избранном" : "Featured",
      hint: ru
        ? "Избранный материал на главной может быть только один; в избранное попадает лишь опубликованный текст."
        : "Only one featured post is allowed on the home page, and only a published post can be featured.",
      saved: ru ? "Материал сохранён." : "Post saved.",
      readOnly: ru ? "Редактировать материалы может только администратор." : "Only an admin can edit posts.",
      create: ru ? "Новый материал" : "New post",
    },
    media: {
      title: ru ? "Медиатека" : "Media library",
      subtitle: ru
        ? "Загруженные изображения. Удалить можно только файл, на который не ссылается ни одна услуга, товар или материал."
        : "Uploaded images. Only files that no service, product or post references can be deleted.",
      empty: ru ? "Файлов пока нет." : "No files yet.",
      kind: ru ? "Раздел" : "Section",
      size: ru ? "Размер" : "Size",
      dimensions: ru ? "Размер в пикселях" : "Dimensions",
      created: ru ? "Загружен" : "Uploaded",
      inUse: ru ? "Используется: {count}" : "Used by: {count}",
      remove: ru ? "Удалить файл" : "Delete file",
      deleted: ru ? "Файл удалён." : "File deleted.",
    },
    gallery: {
      title: ru ? "Галерея" : "Gallery",
      hint: ru
        ? "Дополнительные изображения материала. Порядок — сверху вниз; файл пережимается в WebP, до 12 картинок."
        : "Extra images for the post. Order is top to bottom; files are converted to WebP, up to 12 images.",
      add: ru ? "Добавить изображения" : "Add images",
      remove: ru ? "Удалить" : "Remove",
      empty: ru ? "Галерея пуста." : "The gallery is empty.",
    },
    image: {
      title: ru ? "Обложка" : "Cover image",
      upload: ru ? "Загрузить изображение" : "Upload an image",
      remove: ru ? "Удалить текущую обложку" : "Remove the current cover",
      hint: ru
        ? "PNG, JPEG, WebP, GIF или AVIF до 8 МБ. Файл пережимается в WebP; соотношение 4:3, рекомендуем 1600 × 1200 px."
        : "PNG, JPEG, WebP, GIF or AVIF up to 8 MB. The file is converted to WebP; 4:3, 1600 × 1200 px recommended.",
    },
    story: {
      title: ru ? "История студии" : "Studio story",
      subtitle: ru
        ? "Заголовок, вступление и вехи на главной странице. Пустой блок не показывается."
        : "Heading, intro and milestones on the home page. An empty block is hidden.",
      heading: ru ? "Заголовок блока" : "Block heading",
      description: ru ? "Вступление" : "Intro",
      events: ru ? "Вехи" : "Milestones",
      eventsHint: ru
        ? "Заполняйте сверху вниз: порядок строк — это порядок на странице. Пустые строки удаляются, лимит — {count}."
        : "Fill top to bottom: row order is page order. Empty rows are dropped, limit {count}.",
      event: ru ? "Веха" : "Milestone",
      period: ru ? "Период" : "Period",
      eventTitle: ru ? "Название" : "Title",
      eventDescription: ru ? "Описание" : "Description",
      saved: ru ? "История сохранена." : "Story saved.",
    },
    settings: {
      title: ru ? "Настройки" : "Settings",
      subtitle: ru
        ? "Публичные данные студии и ключи платёжного провайдера. Доступно только основателю."
        : "Public studio details and payment provider keys. Founder only.",
      saved: ru ? "Настройки сохранены." : "Settings saved.",
      savedCount: ru ? "Сохранено изменений:" : "Changes saved:",
      nothingChanged: ru
        ? "Изменений нет — значения совпадают с сохранёнными."
        : "Nothing changed — the values match what is already stored.",
      errorPrefix: ru ? "Не сохранено:" : "Not saved:",
      secretSet: ru ? "уже задан — оставьте пустым, чтобы не менять" : "already set — leave empty to keep it",
      secretEmpty: ru ? "не задан" : "not set",
      secretHint: ru
        ? "Значение хранится в базе и никогда не показывается обратно."
        : "The value is stored in the database and never shown again.",
      secretStatusSet: ru ? "задан" : "set",
      secretStatusEmpty: ru ? "не задан" : "not set",
      clearSecret: ru ? "Очистить сохранённое значение" : "Clear the stored value",
      saveHint: ru
        ? "Изменения применяются сразу: публичные поля — на сайте, ключи — в оплате и уведомлениях."
        : "Changes apply immediately: public fields on the site, keys in payments and notifications.",
      errors: {
        required: ru ? "Заполните поле." : "This field is required.",
        tooLong: ru ? "Значение слишком длинное." : "The value is too long.",
        invalidEmail: ru ? "Нужен корректный e-mail, например name@studio.ru." : "Enter a valid e-mail, e.g. name@studio.ru.",
        invalidUrl: ru ? "Нужен полный адрес http:// или https://." : "Enter a full http:// or https:// address.",
        invalidPhone: ru ? "Телефон может содержать цифры, пробелы, +, -, точки и скобки." : "A phone may contain digits, spaces, +, -, dots and brackets.",
        invalidValue: ru ? "Недопустимое значение для этого поля." : "This value is not allowed for the field.",
        controlCharacters: ru ? "Уберите служебные символы из значения." : "Remove control characters from the value.",
      } as Record<string, string>,
      test: {
        button: ru ? "Проверить отправку" : "Send a test",
        ok: ru ? "Проверка прошла: тестовое сообщение отправлено в Telegram." : "Test passed: the message was delivered to Telegram.",
        not_configured: ru
          ? "Проверка не запущена: заполните токен бота и chat ID."
          : "Nothing to test yet: fill in the bot token and chat ID.",
        invalid_config: ru
          ? "Telegram отклонил токен или chat ID. Проверьте значения."
          : "Telegram rejected the token or chat ID. Check both values.",
        network: ru
          ? "Не удалось связаться с Telegram из этого окружения. Попробуйте позже."
          : "Telegram is unreachable from this environment. Try again later.",
        api: ru ? "Telegram вернул ошибку. Подробности — в журнале сервера." : "Telegram returned an error. See the server log.",
      },
      groups: {
        public: {
          title: ru ? "Студия и SEO" : "Studio and SEO",
          hint: ru
            ? "Эти значения читает публичный сайт: заголовок вкладки, описание, подвал и контакты."
            : "The public site reads these values: tab title, description, footer and contacts.",
          keys: [
            "studioName",
            "studioDescription",
            "contactEmail",
            "contactPhone",
            "vkUrl",
            "telegramUrl",
            "youtubeUrl",
            "metaTitle",
            "metaDescription",
            "metaKeywords",
          ],
        },
        payment: {
          title: ru ? "Робокасса" : "Robokassa",
          hint: ru
            ? "Пустые значения означают: взять из .env, затем демо-магазин."
            : "Empty values mean: fall back to .env, then the demo merchant.",
          keys: ["robokassaLogin", "robokassaPassword1", "robokassaPassword2", "robokassaTestMode", "robokassaHashAlgo"],
        },
        notification: {
          title: ru ? "Уведомления" : "Notifications",
          hint: ru
            ? "Telegram-бот присылает сообщение о каждой новой заявке. Кнопка проверки отправляет тестовое сообщение с текущими значениями формы."
            : "The Telegram bot messages you about every new request. The test button sends a message using the values currently in the form.",
          emailHint: ru
            ? "E-mail сохранён как запасной контакт; отправку писем пока выполняет почтовый сервис хостинга, а не сайт."
            : "The e-mail is stored as a fallback contact; sending is handled by the hosting mail service, not by the site.",
          keys: ["telegramBotToken", "telegramChatId", "notificationEmail"],
        },
      },
      labels: {
        studioName: ru ? "Название студии" : "Studio name",
        studioDescription: ru ? "Описание студии" : "Studio description",
        contactEmail: ru ? "Контактный e-mail" : "Contact e-mail",
        contactPhone: ru ? "Контактный телефон" : "Contact phone",
        vkUrl: "VK",
        telegramUrl: "Telegram",
        youtubeUrl: "YouTube",
        metaTitle: ru ? "SEO-заголовок" : "SEO title",
        metaDescription: ru ? "SEO-описание" : "SEO description",
        metaKeywords: ru ? "SEO-ключевые слова" : "SEO keywords",
        robokassaLogin: ru ? "Логин магазина" : "Merchant login",
        robokassaPassword1: ru ? "Пароль №1" : "Password #1",
        robokassaPassword2: ru ? "Пароль №2" : "Password #2",
        robokassaTestMode: ru ? "Режим оплаты" : "Payment mode",
        robokassaHashAlgo: ru ? "Алгоритм подписи" : "Signature algorithm",
        notificationEmail: ru ? "E-mail уведомлений" : "Notification e-mail",
        telegramBotToken: ru ? "Токен Telegram-бота" : "Telegram bot token",
        telegramChatId: ru ? "Chat ID Telegram" : "Telegram chat ID",
      } as Record<string, string>,
    },
    product: {
      priceRubles: ru ? "Цена, ₽" : "Price, RUB",
      isActive: ru ? "Показывать в магазине" : "Visible in the shop",
      saved: ru ? "Товар сохранён." : "Product saved.",
      readOnly: ru ? "Редактировать товары может только администратор." : "Only an admin can edit products.",
      create: ru ? "Новый товар" : "New product",
    },
    products: { title: ru ? "Товары" : "Products", subtitle: ru ? "Магазин и остатки." : "Shop and stock." },
    posts: { title: ru ? "Материалы" : "Posts", subtitle: ru ? "Блог и публикации." : "Blog and publications." },
    accounts: { title: ru ? "Аккаунты" : "Accounts", subtitle: ru ? "Пользователи и роли." : "Users and roles." },
    activity: { title: ru ? "Активность" : "Activity", subtitle: ru ? "Журнал действий." : "Action log." },
  };
}

export type AdminLabels = ReturnType<typeof adminLabels>;
