import en from "@/messages/en.json";
import ru from "@/messages/ru.json";

// Полные словари импортируются только серверными entry points. Locale helpers
// остаются в i18n.ts и не переносят оба JSON-каталога в браузерный bundle.
export const messages = { en, ru } as const;
