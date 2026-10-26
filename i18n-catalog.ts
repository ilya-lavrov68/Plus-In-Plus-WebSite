import en from "@/messages/en.json";
import ru from "@/messages/ru.json";

// Полные словари импортируются только серверными entry points. Locale helpers
// остаются в i18n.ts и не переносят оба JSON-каталога в браузерный bundle.
export const messages = { en, ru } as const;

/**
 * Server actions по-прежнему используют полный `actions` catalog. В браузере
 * нужны только три fallback-строки, перенесённые в `admin`, поэтому весь
 * server-action namespace не сериализуется в каждый HTML/RSC response.
 */
export function getClientMessages(locale: keyof typeof messages) {
  const { actions: serverActionMessages, ...clientMessages } = messages[locale];
  void serverActionMessages;
  return clientMessages;
}
