import en from "@/messages/en.json";
import ru from "@/messages/ru.json";

// Полные словари импортируются только серверными entry points. Locale helpers
// остаются в i18n.ts и не переносят оба JSON-каталога в браузерный bundle.
export const messages = { en, ru } as const;

/**
 * Наборы сообщений публичной части сайта.
 *
 * `NextIntlClientProvider` сериализует переданный каталог в HTML/RSC-ответ,
 * поэтому отправлять браузеру весь словарь (120 КБ на ru) дорого: страница
 * тянет строки, которых посетитель этого экрана никогда не увидит. Список
 * ниже — ровно те namespace, которые запрашивает `useTranslations` внутри
 * клиентских компонентов публичных страниц. Проверяется
 * `tests/i18n-client-catalog.test.cjs`: если клиентский компонент начнёт
 * использовать новый namespace, тест упадёт раньше, чем пользователь увидит
 * `MISSING_MESSAGE`.
 */
export const CLIENT_MESSAGE_NAMESPACES = [
  "account",
  "auth",
  "cart",
  "common",
  "contact",
  "cookies",
  "errors",
  "header",
  "mobileNav",
  "navigation",
  "orders",
  "profile",
  "security",
  "services",
  "shop",
] as const;

/**
 * Наборы сообщений админки: к публичным добавляется только `admin`.
 *
 * Кабинет не отдаёт посетителю сайта строки панели управления — это и вес,
 * и лишний текст служебного интерфейса в разметке публичных страниц.
 */
export const ADMIN_CLIENT_MESSAGE_NAMESPACES = [
  ...CLIENT_MESSAGE_NAMESPACES,
  "admin",
] as const;

export type ClientMessagesScope = "site" | "admin";

/**
 * Каталог для браузера: только нужные текущему разделу namespace.
 *
 * Серверные страницы берут сообщения через `getRequestTranslations` и работают
 * с полным каталогом — сюда попадает только клиентская часть.
 */
export function getClientMessages(
  locale: keyof typeof messages,
  scope: ClientMessagesScope = "site",
) {
  const namespaces: readonly string[] =
    scope === "admin" ? ADMIN_CLIENT_MESSAGE_NAMESPACES : CLIENT_MESSAGE_NAMESPACES;
  const catalog: Record<string, unknown> = messages[locale];
  const client: Record<string, unknown> = {};
  for (const namespace of namespaces) {
    if (namespace in catalog) client[namespace] = catalog[namespace];
  }
  return client;
}
