/**
 * Робокасса: выставление счёта и приём уведомлений об оплате.
 *
 * Протокол вкратце. Мы отправляем клиента на форму Робокассы с подписанной
 * суммой. После оплаты Робокасса двумя способами сообщает нам результат:
 * Result URL — серверный вызов, по нему деньги зачисляются; Success/Fail —
 * браузер клиента, это просто страницы, на которые его возвращают.
 *
 * Два пароля: Password1 подписывает то, что мы отправляем наружу,
 * Password2 — то, что приходит от Робокассы. Путать их нельзя.
 */

import crypto from "node:crypto";

export type RobokassaHashAlgo = "md5" | "ripemd160" | "sha256" | "sha512";

export interface RobokassaConfig {
  merchantLogin: string;
  password1: string;
  password2: string;
  hashAlgo: RobokassaHashAlgo;
  /** Тестовый режим: деньги не списываются. */
  isTest: boolean;
}

const HASH_ALGOS: readonly RobokassaHashAlgo[] = ["md5", "ripemd160", "sha256", "sha512"];
const BASE_URL = "https://auth.robokassa.ru/Merchant/Index.aspx";

/** Хоть один из двух паролей задан — значит подключение настроено. */
export function isRobokassaConfigured(): boolean {
  return Boolean(readConfig());
}

/**
 * Все настройки из переменных окружения. Возвращает null, если не заданы
 * логин и оба пароля: в этом случае счёт выставить нельзя, но сайт
 * продолжает работать.
 */
export function readConfig(): RobokassaConfig | null {
  const merchantLogin = process.env.ROBOKASSA_MERCHANT_LOGIN?.trim();
  const password1 = process.env.ROBOKASSA_PASSWORD1?.trim();
  const password2 = process.env.ROBOKASSA_PASSWORD2?.trim();
  if (!merchantLogin || !password1 || !password2) return null;

  const algo = (process.env.ROBOKASSA_HASH_ALGO?.trim().toLowerCase() ??
    "md5") as RobokassaHashAlgo;
  const hashAlgo = HASH_ALGOS.includes(algo) ? algo : "md5";

  return {
    merchantLogin,
    password1,
    password2,
    hashAlgo,
    isTest: process.env.ROBOKASSA_TEST_MODE === "1",
  };
}

/**
 * Имена дополнительных параметров в протоколе всегда с префиксом shp_.
 *
 * Вызывающему удобно писать { OrderId }, но и в подписи, и в ссылке Робокасса
 * ждёт ровно shp_OrderId. Приводим к одному виду, чтобы подпись не разошлась
 * с тем, что реально уехало в ссылке.
 */
function normalizeExtra(extra: Record<string, string> = {}): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(extra)) {
    if (!value) continue;
    normalized[key.startsWith("shp_") ? key : `shp_${key}`] = value;
  }
  return normalized;
}

/** Хвост подписи: shp_OrderId=значение в алфавитном порядке. */
function extraTail(extra: Record<string, string> = {}): string[] {
  const normalized = normalizeExtra(extra);
  return Object.keys(normalized)
    .sort()
    .map((key) => `${key}=${normalized[key]}`);
}

function hash(config: RobokassaConfig, value: string): string {
  return crypto.createHash(config.hashAlgo).update(value, "utf8").digest("hex").toUpperCase();
}

/**
 * Сумма в формате Робокассы: копейки → «1234.50».
 *
 * Робокасса принимает рубли с точностью до двух знаков и ровно с точкой.
 * Приводим через целые копейки, чтобы не получить «1234.4999999».
 */
export function formatOutSum(kopecks: number): string {
  const whole = Math.trunc(kopecks / 100);
  const fraction = Math.abs(kopecks % 100);
  return `${whole}.${String(fraction).padStart(2, "0")}`;
}

/**
 * Подпись запроса: MerchantLogin:OutSum:InvId:Receipt:Password1:shp_…
 * Дополнительные shp_-параметры идут в алфавитном порядке.
 */
export function requestSignature(
  config: RobokassaConfig,
  outSum: string,
  invId: number | string,
  extra: Record<string, string> = {},
  receipt?: string,
): string {
  const parts = [config.merchantLogin, outSum, String(invId)];
  if (receipt) parts.push(receipt);
  parts.push(config.password1);
  parts.push(...extraTail(extra));
  return hash(config, parts.join(":"));
}

/** Подпись серверного уведомления: OutSum:InvId:Password2. */
export function resultSignature(
  config: RobokassaConfig,
  outSum: string,
  invId: number | string,
  extra: Record<string, string> = {},
): string {
  const parts = [outSum, String(invId), config.password2];
  parts.push(...extraTail(extra));
  return hash(config, parts.join(":"));
}

/**
 * Подпись страницы успеха: OutSum:InvId:Password1. Здесь первый пароль —
 * клиент приходит из браузера, и проверить мы можем только то же, что сами
 * туда положили.
 */
export function successSignature(
  config: RobokassaConfig,
  outSum: string,
  invId: number | string,
  extra: Record<string, string> = {},
): string {
  const parts = [outSum, String(invId), config.password1];
  parts.push(...extraTail(extra));
  return hash(config, parts.join(":"));
}

export interface BuildPaymentUrlInput {
  /** Копейки. */
  amount: number;
  /** Наш идентификатор платежа — Робокасса вернёт его как InvId. */
  invId: number;
  description: string;
  email?: string | null;
  /** shp_-параметры, которые вернутся вместе с уведомлением. */
  extra?: Record<string, string>;
}

/** Ссылка на форму оплаты, которую показываем клиенту. */
export function buildPaymentUrl(input: BuildPaymentUrlInput): string | null {
  const config = readConfig();
  if (!config) return null;

  const outSum = formatOutSum(input.amount);
  // Почта — отдельный служебный параметр, в shp_ её класть не надо.
  const extra: Record<string, string> = { ...(input.extra ?? {}) };

  const params = new URLSearchParams({
    MerchantLogin: config.merchantLogin,
    OutSum: outSum,
    InvId: String(input.invId),
    Description: input.description.slice(0, 100),
    SignatureValue: requestSignature(config, outSum, input.invId, extra),
    Encoding: "utf-8",
  });
  // shp_-параметры уезжают в ссылку ровно в том виде, в каком подписаны.
  for (const [key, value] of Object.entries(normalizeExtra(extra))) {
    params.set(key, value);
  }
  if (input.email) params.set("Email", input.email);
  if (config.isTest) params.set("IsTest", "1");

  return `${BASE_URL}?${params.toString()}`;
}

/** Сравнение подписей без утечки времени по длине сравнения. */
export function signatureMatches(expected: string, actual: string | undefined | null): boolean {
  if (!actual) return false;
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(String(actual).toUpperCase(), "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
