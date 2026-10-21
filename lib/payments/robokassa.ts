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

/** Откуда взялась активная конфигурация — подсказка во вкладке Settings. */
export type RobokassaConfigSource = "settings" | "env" | "demo" | "none";

export interface ResolvedRobokassa {
  /** null — только в production без ключей и без разрешённого демо-режима. */
  config: RobokassaConfig | null;
  source: RobokassaConfigSource;
}

/**
 * Демо-магазин Робокассы: общедоступные тестовые ключи. Деньги не
 * списываются, оплата «проходит» с любой картой (например 4111 1111 1111
 * 1111, срок 12/30, CVV 123). Нужен, чтобы проверять оплату до регистрации
 * настоящего магазина.
 *
 * ВАЖНО: пароль демо-магазина публичен («qwe»), поэтому в production
 * демо-режим по умолчанию ВЫКЛЮЧЕН — иначе любой, кто знает InvId, подписал
 * бы поддельное уведомление об оплате. Включить осознанно можно переменной
 * ROBOKASSA_DEMO_MODE=1. В разработке демо работает из коробки.
 */
export const DEMO_CONFIG: RobokassaConfig = {
  merchantLogin: "TestMerchant",
  password1: "qwe",
  password2: "qwe",
  hashAlgo: "md5",
  isTest: true,
};

/** Разрешён ли демо-режим в этом окружении. */
export function demoAllowed(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.ROBOKASSA_DEMO_MODE === "1";
}

/** Это демо-конфигурация (публичный тестовый магазин)? */
export function isDemoConfig(config: RobokassaConfig): boolean {
  return config.merchantLogin === DEMO_CONFIG.merchantLogin;
}

/** Хоть один настоящий источник ключей задан — значит подключение настроено. */
export function isRobokassaConfigured(): boolean {
  return Boolean(readConfig());
}

/**
 * Конфигурация из переменных окружения. Возвращает null, если не заданы
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
 * Конфигурация из настроек сайта (таблица SiteSetting, вкладка Settings —
 * её ведёт только FOUNDER). Пароли нигде не хардкодятся: источник правды —
 * БД или env. Частично заполненный набор считается незаданным: полунастроен-
 * ный магазин хуже ненастроенного, подпись просто не сойдётся.
 */
export function configFromSettings(
  settings: Record<string, string | undefined>,
): RobokassaConfig | null {
  const merchantLogin = settings.robokassaLogin?.trim();
  const password1 = settings.robokassaPassword1?.trim();
  const password2 = settings.robokassaPassword2?.trim();
  if (!merchantLogin || !password1 || !password2) return null;

  const algo = (settings.robokassaHashAlgo?.trim().toLowerCase() ??
    "md5") as RobokassaHashAlgo;
  return {
    merchantLogin,
    password1,
    password2,
    hashAlgo: HASH_ALGOS.includes(algo) ? algo : "md5",
    isTest: settings.robokassaTestMode === "1",
  };
}

/**
 * Выбор активной конфигурации по приоритету:
 *   1. Настройки в БД (Settings) — основатель меняет ключи без редеплоя;
 *   2. Переменные окружения;
 *   3. Демо-магазин TestMerchant — если разрешён в этом окружении;
 *   4. null — production без ключей: счетов со ссылками нет, сайт работает.
 */
export function pickConfig(
  settings: Record<string, string | undefined> = {},
): ResolvedRobokassa {
  const fromSettings = configFromSettings(settings);
  if (fromSettings) return { config: fromSettings, source: "settings" };

  const fromEnv = readConfig();
  if (fromEnv) return { config: fromEnv, source: "env" };

  if (demoAllowed()) return { config: DEMO_CONFIG, source: "demo" };
  return { config: null, source: "none" };
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

/**
 * Ссылка на форму оплаты, которую показываем клиенту.
 *
 * Конфигурацию можно передать явно (серверный код читает её из настроек БД);
 * без неё берётся env, а в разработке — демо-магазин.
 */
export function buildPaymentUrl(
  input: BuildPaymentUrlInput,
  provided?: RobokassaConfig | null,
): string | null {
  const config = provided === undefined ? pickConfig().config : provided;
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

// ---------------------------------------------------------------------------
// Именованные обёртки под терминологию ТЗ: «сформировать ссылку» и
// «проверить хеш ResultURL». Логика та же, что у buildPaymentUrl /
// resultSignature + signatureMatches — дублировать подпись нельзя.
// ---------------------------------------------------------------------------

export interface GeneratePaymentLinkInput {
  /** Наш идентификатор счёта — Робокасса вернёт его как InvId. */
  invId: number;
  /** Сумма в копейках (внутри сайта деньги только целыми копейками). */
  amountKopecks: number;
  description: string;
  email?: string | null;
  extra?: Record<string, string>;
}

/** Формирует подписанную ссылку на оплату (SignatureValue по Password1). */
export function generatePaymentLink(
  input: GeneratePaymentLinkInput,
  config?: RobokassaConfig | null,
): string | null {
  return buildPaymentUrl(
    {
      amount: input.amountKopecks,
      invId: input.invId,
      description: input.description,
      email: input.email,
      extra: input.extra,
    },
    config,
  );
}

/**
 * Проверяет подпись серверного уведомления (ResultURL): хеш считается по
 * Password2 — это и есть подтверждение, что вызов пришёл от Робокассы.
 */
export function verifyPaymentHash(
  config: RobokassaConfig,
  params: {
    outSum: string;
    invId: number | string;
    signatureValue: string | undefined | null;
    extra?: Record<string, string>;
  },
): boolean {
  const expected = resultSignature(config, params.outSum, params.invId, params.extra ?? {});
  return signatureMatches(expected, params.signatureValue);
}
