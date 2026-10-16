import { auth } from "@/auth";

import { prisma } from "@/lib/prisma";
import { calculateEstimate } from "@/lib/pricing";

/**
 * Чтение корзины вошедшего пользователя.
 *
 * Идентификатор берётся только из сессии — как и в lib/customer-orders.ts:
 * подставить чужой id и прочитать чужую корзину нельзя.
 *
 * Цены пересчитываются при каждом чтении по текущим данным услуги: если
 * администратор поменял прайс, клиент видит актуальный ориентир, а не цифру
 * месячной давности.
 */

export interface CartLineOption {
  group: string;
  option: string;
}

export interface CartLine {
  id: string;
  serviceId: string;
  title: string;
  slug: string;
  coverImage: string;
  quantity: number;
  currency: string;
  options: CartLineOption[];
  /** Выбранные optionId — нужны конфигуратору и пересчёту. */
  optionIds: string[];
  /** Расчётная цена за единицу, копейки. */
  unitEstimate: number;
  /** Расчётная цена строки (unit × quantity), копейки. */
  lineEstimate: number;
  /** true — услугу сняли с продажи после добавления. */
  unavailable: boolean;
  /** Показывать ли цену (priceType fixed/from); quote — цена по запросу. */
  showPrice: boolean;
}

export interface CartView {
  lines: CartLine[];
  /** Суммарное количество единиц — бейдж в шапке. */
  count: number;
  /** Сумма расчётных цен доступных позиций, копейки. */
  totalEstimate: number;
  currency: string;
}

const EMPTY_CART: CartView = { lines: [], count: 0, totalEstimate: 0, currency: "RUB" };

export async function getCart(): Promise<CartView> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId || !prisma) return EMPTY_CART;

  try {
    const items = await prisma.cartItem.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      include: {
        service: {
          include: {
            optionGroups: {
              orderBy: { sortOrder: "asc" },
              include: { options: { orderBy: { sortOrder: "asc" } } },
            },
          },
        },
      },
    });

    const lines: CartLine[] = [];
    for (const item of items) {
      const service = item.service;
      const unavailable = !service || !service.isPublished || !service.isOrderable;

      let optionIds: string[] = [];
      try {
        const parsed = JSON.parse(item.optionsJson) as Array<{ optionId?: string }>;
        optionIds = parsed
          .map((entry) => entry?.optionId)
          .filter((id): id is string => typeof id === "string");
      } catch {
        optionIds = [];
      }

      if (!service) continue; // услуга удалена — строку не показать осмысленно

      const estimate = calculateEstimate(
        { basePrice: service.basePrice, priceType: service.priceType, groups: service.optionGroups },
        optionIds,
      );

      // Подписи выбранных опций для списка в корзине.
      const options: CartLineOption[] = [];
      for (const group of service.optionGroups) {
        const chosen = group.options.find((option) => optionIds.includes(option.id));
        if (chosen) options.push({ group: group.name, option: chosen.label });
      }

      lines.push({
        id: item.id,
        serviceId: service.id,
        title: service.title,
        slug: service.slug,
        coverImage: service.coverImage,
        quantity: item.quantity,
        currency: service.currency,
        options,
        optionIds,
        unitEstimate: estimate.estimatedAmount,
        lineEstimate: estimate.estimatedAmount * item.quantity,
        unavailable,
        showPrice: service.priceType === "fixed" || service.priceType === "from",
      });
    }

    const available = lines.filter((line) => !line.unavailable);
    return {
      lines,
      count: lines.reduce((sum, line) => sum + line.quantity, 0),
      totalEstimate: available.reduce((sum, line) => sum + line.lineEstimate, 0),
      currency: lines[0]?.currency ?? "RUB",
    };
  } catch (error) {
    console.error("Failed to load the cart:", error);
    return EMPTY_CART;
  }
}

/** Лёгкий счётчик для бейджа — без пересчёта цен. */
export async function getCartCount(): Promise<number> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId || !prisma) return 0;
  try {
    const aggregate = await prisma.cartItem.aggregate({
      where: { userId },
      _sum: { quantity: true },
    });
    return aggregate._sum.quantity ?? 0;
  } catch (error) {
    console.error("Failed to count the cart items:", error);
    return 0;
  }
}
