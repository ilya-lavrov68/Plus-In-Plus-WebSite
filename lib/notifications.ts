import { listSiteSettings } from "@/lib/commerce-data";
import { logServerError } from "@/lib/security-log";

/**
 * Уведомления о новых заказах в Telegram.
 *
 * Токен бота и chat_id хранятся в `site_settings` (только основатель), поэтому
 * интеграция включается из админки без перезапуска и без правки .env. Токен
 * никогда не попадает в журнал и в ответ админки: наружу уходит только
 * результат «доставлено / не настроено / ошибка».
 */

export type NotificationFailureReason =
  | "not_configured"
  | "invalid_config"
  | "network"
  | "api";

export type NotificationResult =
  | { ok: true; detail?: string }
  | { ok: false; reason: NotificationFailureReason; detail?: string };

export interface NotificationConfig {
  botToken: string;
  chatId: string;
}

const TELEGRAM_TIMEOUT_MS = 8000;

export type TelegramFetcher = typeof fetch;

export async function readNotificationConfig(
  settings?: Record<string, string>,
): Promise<NotificationConfig | null> {
  let values = settings;
  if (!values) {
    try {
      values = await listSiteSettings("telegram");
    } catch (error) {
      logServerError("admin.notifications.config_read_failed", error);
      return null;
    }
  }
  const botToken = (values.telegramBotToken ?? "").trim();
  const chatId = (values.telegramChatId ?? "").trim();
  if (!botToken || !chatId) return null;
  return { botToken, chatId };
}

/** Отправляет текст в Telegram; сеть и ответ API сводятся к одному результату. */
export async function sendTelegramMessage(
  config: NotificationConfig,
  text: string,
  fetcher: TelegramFetcher = fetch,
): Promise<NotificationResult> {
  if (!config.botToken || !config.chatId) return { ok: false, reason: "not_configured" };

  try {
    const response = await fetcher(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: config.chatId,
        text,
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(TELEGRAM_TIMEOUT_MS),
    });
    const payload = (await response.json().catch(() => null)) as
      | { ok?: boolean; description?: string }
      | null;
    if (response.ok && payload?.ok !== false) return { ok: true };
    return {
      ok: false,
      reason: response.status === 401 || response.status === 400 ? "invalid_config" : "api",
      detail: payload?.description?.slice(0, 200),
    };
  } catch (error) {
    logServerError("admin.notifications.telegram_send_failed", error);
    return { ok: false, reason: "network" };
  }
}

/** Кнопка «Проверить» в настройках: короткое сообщение и явный результат. */
export async function sendTelegramTest(
  config: NotificationConfig | null,
  fetcher: TelegramFetcher = fetch,
): Promise<NotificationResult> {
  if (!config) return { ok: false, reason: "not_configured" };
  return sendTelegramMessage(
    config,
    "Plus In Plus: проверка уведомлений из админки. Настройки Telegram работают.",
    fetcher,
  );
}

export interface NewOrderNotice {
  orderNumber: string;
  services: string[];
  amount: number;
  customerEmail?: string | null;
  deadline?: string | null;
}

function formatOrderMessage(notice: NewOrderNotice): string {
  const lines = [
    `Plus In Plus — новая заявка ${notice.orderNumber}`,
    `Услуги: ${notice.services.slice(0, 6).join(", ") || "—"}`,
    `Предварительная сумма: ${notice.amount.toLocaleString("ru-RU")} ₽`,
  ];
  if (notice.deadline) lines.push(`Срок: ${notice.deadline.slice(0, 10)}`);
  if (notice.customerEmail) lines.push(`Клиент: ${notice.customerEmail}`);
  lines.push("Открыть: /admin/orders");
  return lines.join("\n");
}

/**
 * Уведомление о новой заявке. Вызывающий код не должен падать из-за доставки:
 * заказ уже сохранён, поэтому ошибка только логируется и возвращается наружу.
 */
export async function notifyNewOrder(
  notice: NewOrderNotice,
  fetcher: TelegramFetcher = fetch,
): Promise<NotificationResult> {
  const config = await readNotificationConfig();
  if (!config) return { ok: false, reason: "not_configured" };
  return sendTelegramMessage(config, formatOrderMessage(notice), fetcher);
}
