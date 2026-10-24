/**
 * Расчёт цены услуги из выбранных опций.
 *
 * Один модуль на два потребителя: конфигуратор на странице услуги (показывает
 * ориентир клиенту) и админка (видит, из чего сложилась сумма заявки). Чтобы
 * клиент и менеджер не видели разных чисел, расчёт живёт здесь, а не в двух
 * компонентах.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ВАЖНО: это расчётная (ориентировочная) цена, а не финальная.
 *
 * Реальная цена согласуется менеджером с клиентом и лежит в Order.total.
 * Калькулятор даёт только отправную точку для разговора. Поэтому:
 *
 *   - Order.estimatedAmount  — то, что насчитано здесь;
 *   - Order.total            — то, что согласовал менеджер и что реально к оплате.
 *
 * Эти два поля никогда не перезаписывают друг друга: по их разнице потом
 * считается, насколько расчёт расходится с фактом.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Формула:
 *
 *   цена = round((basePrice + Σ priceDelta) × Π priceFactor)
 *
 * Сначала складываем все надбавки (материал, ламинация), потом умножаем на
 * множители (тираж, размер). Порядок важен: «+500 ₽ за акрил, потом ×2 за
 * тираж» и «×2, потом +500» дают разные суммы, и первый вариант — тот, который
 * объясняют клиенту на словах.
 *
 * Деньги — целые копейки. Float не используется: 0.1 + 0.2 !== 0.3, и на
 * суммах заказа это даёт расхождения в отчётах. Округление ровно одно, в конце.
 */

export interface PricingOptionInput {
  id: string;
  label: string;
  /** Копейки, прибавляемые к базовой цене. Может быть отрицательной (скидка). */
  priceDelta: number;
  /** Множитель цены — тиражи, размеры. */
  priceFactor: number;
  isDefault: boolean;
  sortOrder: number;
}

export interface PricingGroupInput {
  id: string;
  name: string;
  required: boolean;
  sortOrder: number;
  options: PricingOptionInput[];
}

export interface PricingServiceInput {
  basePrice: number;
  /** "fixed" — цена окончательная; "from" — «от N ₽»; "quote" — цены на сайте нет. */
  priceType: string;
  groups: PricingGroupInput[];
}

export interface SelectedOptionSnapshot {
  groupId: string;
  groupName: string;
  optionId: string;
  optionLabel: string;
  priceDelta: number;
  priceFactor: number;
}

export interface PriceBreakdownLine {
  label: string;
  /** Копейки. Для множителей — сколько добавила эта опция сверху. */
  amount: number;
  kind: "base" | "delta" | "factor";
}

export interface PriceCalculation {
  /** true, когда выбраны все обязательные опции и цену можно показывать. */
  complete: boolean;
  /** Какие обязательные группы не заполнены. */
  missingGroupIds: string[];
  basePrice: number;
  estimatedAmount: number;
  breakdown: PriceBreakdownLine[];
  selected: SelectedOptionSnapshot[];
}

/**
 * Возвращает опцию по умолчанию для группы: помеченную isDefault,
 * иначе первую по sortOrder. Для обязательных групп это то, что будет
 * выбрано, пока клиент не тронул селект.
 */
export function defaultOptionFor(group: PricingGroupInput): PricingOptionInput | undefined {
  if (group.options.length === 0) return undefined;
  return (
    group.options.find((option) => option.isDefault) ??
    [...group.options].sort((a, b) => a.sortOrder - b.sortOrder)[0]
  );
}

/**
 * Считает ориентировочную цену.
 *
 * Незаполненные обязательные группы не считаются ошибкой: клиент только
 * открыл страницу и ещё ничего не выбрал. Вместо падения возвращается
 * `complete: false` и сумма по умолчаниям — так конфигуратор может показать
 * «от 15 600 ₽», а кнопка заказа блокируется до полного выбора.
 */
export function calculateEstimate(
  service: PricingServiceInput,
  selectedOptionIds: readonly string[] = [],
): PriceCalculation {
  const selectedIds = new Set(selectedOptionIds);
  const selected: SelectedOptionSnapshot[] = [];
  const missingGroupIds: string[] = [];

  const orderedGroups = [...service.groups].sort((a, b) => a.sortOrder - b.sortOrder);

  for (const group of orderedGroups) {
    const explicit = group.options.find((option) => selectedIds.has(option.id));
    const chosen = explicit ?? (group.required ? defaultOptionFor(group) : undefined);

    if (!chosen) continue; // необязательная группа и ничего не выбрано

    selected.push({
      groupId: group.id,
      groupName: group.name,
      optionId: chosen.id,
      optionLabel: chosen.label,
      priceDelta: chosen.priceDelta,
      priceFactor: chosen.priceFactor,
    });

    // Обязательная группа без явного выбора — цена ещё не окончательна.
    if (group.required && !explicit) missingGroupIds.push(group.id);
  }

  const sumDelta = selected.reduce((total, item) => total + item.priceDelta, 0);
  const productFactor = selected.reduce((total, item) => total * (item.priceFactor || 1), 1);

  const basePrice = Math.max(0, service.basePrice);
  // Единственное округление во всей цепочке.
  const estimatedAmount = Math.max(0, Math.round((basePrice + sumDelta) * productFactor));

  const breakdown: PriceBreakdownLine[] = [{ label: "Базовая цена", amount: basePrice, kind: "base" }];
  for (const item of selected) {
    if (item.priceDelta !== 0) {
      breakdown.push({ label: item.optionLabel, amount: item.priceDelta, kind: "delta" });
    }
    if (item.priceFactor !== 1) {
      // Множитель превращается в деньги: сколько он добавил к сумме с надбавками.
      const before = (basePrice + sumDelta) * (productFactor / (item.priceFactor || 1));
      const after = before * (item.priceFactor || 1);
      breakdown.push({
        label: `${item.optionLabel} (×${item.priceFactor})`,
        amount: Math.round(after - before),
        kind: "factor",
      });
    }
  }

  return {
    complete: missingGroupIds.length === 0,
    missingGroupIds,
    basePrice,
    estimatedAmount,
    breakdown,
    selected,
  };
}

/** Показывать ли цену на странице услуги. */
export function showPublicPrice(priceType: string): boolean {
  return priceType !== "quote";
}

/** «от 15 600 ₽» для цен с вилкой, «15 600 ₽» для твёрдых. */
export function pricePrefix(priceType: string, locale = "ru"): string {
  if (priceType !== "from") return "";
  return locale.toLowerCase().startsWith("ru") ? "от " : "From ";
}

/**
 * Форматирует копейки в строку для показа.
 * Например: 1560000 → «15 600 ₽».
 */
export function formatKopecks(
  kopecks: number,
  currency = "RUB",
  locale = "ru",
): string {
  const language = locale.toLowerCase().startsWith("ru") ? "ru-RU" : "en-US";
  const amount = kopecks / 100;
  // Keep the familiar ruble sign in both languages, but use the visitor's
  // grouping and decimal conventions instead of Russian formatting everywhere.
  if (currency.toUpperCase() === "RUB") {
    return `${new Intl.NumberFormat(language, {
      maximumFractionDigits: 0,
    }).format(amount)} ₽`;
  }
  return new Intl.NumberFormat(language, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Разница между согласованной и расчётной ценой, в процентах. */
export function estimateDriftPercent(estimatedAmount: number, agreedAmount: number): number | null {
  if (!estimatedAmount) return null;
  return Math.round(((agreedAmount - estimatedAmount) / estimatedAmount) * 100);
}
