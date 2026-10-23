"use server";

import { createHash } from "node:crypto";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";

import { getActionTranslator } from "@/lib/action-i18n";
import { recordActivity } from "@/lib/activity-log";
import { isAuthConfigured } from "@/lib/auth-secret";
import { prisma } from "@/lib/prisma";
import { calculateEstimate } from "@/lib/pricing";

/**
 * Корзина.
 *
 * Хранится в БД (см. модель CartItem): заказ требует входа, поэтому корзина
 * привязана к пользователю и доступна с любого устройства. Одна услуга с
 * разными наборами опций лежит разными строками — различает их optionsHash.
 *
 * Клиенту никогда не верим на слово: он присылает только идентификаторы
 * услуг и опций, все цены пересчитываются на сервере из lib/pricing.ts.
 */

export interface CartActionResult {
  ok: boolean;
  error?: string;
  /** Суммарное количество позиций после операции — для бейджа в шапке. */
  count?: number;
}

export interface CartCheckoutResult {
  ok: boolean;
  error?: string;
  orderNumber?: string;
}

const MAX_QUANTITY = 99;

/** Вошедший и не заблокированный клиент; иначе null. */
async function requireCustomer(): Promise<{ id: string; email: string } | null> {
  try {
    if (!isAuthConfigured() || !prisma) return null;
    const session = await auth();
    if (!session?.user?.id) return null;

    const account = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, isBlocked: true },
    });
    if (!account || account.isBlocked) return null;
    return { id: account.id, email: account.email };
  } catch (error) {
    console.error("Failed to resolve customer session:", error);
    return null;
  }
}

/**
 * Приводит присланные optionId к «одна опция на группу, обязательные группы
 * заполнены» — та же дисциплина, что у заявки на расчёт в actions/orders.ts.
 */
function sanitizeOptions(
  service: {
    optionGroups: Array<{
      id: string;
      required: boolean;
      options: Array<{ id: string; isDefault: boolean }>;
    }>;
  },
  optionIds: string[],
): Map<string, string> | null {
  const chosenByGroup = new Map<string, string>();
  for (const optionId of optionIds) {
    if (typeof optionId !== "string") continue;
    const group = service.optionGroups.find((candidate) =>
      candidate.options.some((option) => option.id === optionId),
    );
    if (!group) continue; // чужая опция — игнорируем
    if (!chosenByGroup.has(group.id)) chosenByGroup.set(group.id, optionId);
  }
  for (const group of service.optionGroups) {
    if (!group.required || chosenByGroup.has(group.id)) continue;
    const fallback = group.options.find((option) => option.isDefault) ?? group.options[0];
    if (!fallback) return null;
    chosenByGroup.set(group.id, fallback.id);
  }
  return chosenByGroup;
}

/** Стабильный отпечаток набора опций: порядок выбора не должен влиять. */
function hashOptions(optionIds: string[]): string {
  return createHash("sha1").update([...optionIds].sort().join("|")).digest("hex");
}

async function countItems(userId: string): Promise<number> {
  if (!prisma) return 0;
  const aggregate = await prisma.cartItem.aggregate({
    where: { userId },
    _sum: { quantity: true },
  });
  return aggregate._sum.quantity ?? 0;
}

/** Кладёт услугу с выбранными опциями в корзину (или увеличивает количество). */
export async function addToCart(input: {
  serviceId: string;
  optionIds: string[];
  quantity?: number;
}): Promise<CartActionResult> {
  const t = await getActionTranslator();

  const customer = await requireCustomer();
  if (!customer) return { ok: false, error: t("unauthorized") };
  if (!prisma) return { ok: false, error: t("genericError") };

  const quantity = Math.min(MAX_QUANTITY, Math.max(1, Math.trunc(Number(input.quantity ?? 1)) || 1));

  const service = await prisma.service.findFirst({
    where: { id: input.serviceId, isPublished: true, isOrderable: true },
    include: {
      optionGroups: {
        orderBy: { sortOrder: "asc" },
        include: { options: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });
  if (!service) return { ok: false, error: t("serviceNotFound") };

  const chosenByGroup = sanitizeOptions(service, input.optionIds ?? []);
  if (!chosenByGroup) return { ok: false, error: t("incompleteOptions") };

  const optionIds = [...chosenByGroup.values()];
  const optionsJson = JSON.stringify(
    [...chosenByGroup.entries()].map(([groupId, optionId]) => ({ groupId, optionId })),
  );
  const optionsHash = hashOptions(optionIds);

  try {
    await prisma.cartItem.upsert({
      where: {
        userId_serviceId_optionsHash: {
          userId: customer.id,
          serviceId: service.id,
          optionsHash,
        },
      },
      create: {
        userId: customer.id,
        serviceId: service.id,
        quantity,
        optionsJson,
        optionsHash,
      },
      update: { quantity: { increment: quantity } },
    });
    // Переполнение сверху: инкремент мог перескочить лимит.
    await prisma.cartItem.updateMany({
      where: { userId: customer.id, serviceId: service.id, optionsHash, quantity: { gt: MAX_QUANTITY } },
      data: { quantity: MAX_QUANTITY },
    });
  } catch (error) {
    console.error("Failed to add to cart:", error);
    return { ok: false, error: t("genericError") };
  }

  revalidatePath("/cart");
  return { ok: true, count: await countItems(customer.id) };
}

/** Меняет количество позиции. Только своей — чужой id молча не найдётся. */
export async function updateCartItemQuantity(input: {
  itemId: string;
  quantity: number;
}): Promise<CartActionResult> {
  const t = await getActionTranslator();

  const customer = await requireCustomer();
  if (!customer) return { ok: false, error: t("unauthorized") };
  if (!prisma) return { ok: false, error: t("genericError") };

  const quantity = Math.trunc(Number(input.quantity));
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
    return { ok: false, error: t("genericError") };
  }

  try {
    const updated = await prisma.cartItem.updateMany({
      where: { id: input.itemId, userId: customer.id },
      data: { quantity },
    });
    if (!updated.count) return { ok: false, error: t("genericError") };
  } catch (error) {
    console.error("Failed to update the cart item:", error);
    return { ok: false, error: t("genericError") };
  }

  revalidatePath("/cart");
  return { ok: true, count: await countItems(customer.id) };
}

/** Убирает позицию из корзины. */
export async function removeCartItem(input: { itemId: string }): Promise<CartActionResult> {
  const t = await getActionTranslator();

  const customer = await requireCustomer();
  if (!customer) return { ok: false, error: t("unauthorized") };
  if (!prisma) return { ok: false, error: t("genericError") };

  try {
    await prisma.cartItem.deleteMany({ where: { id: input.itemId, userId: customer.id } });
  } catch (error) {
    console.error("Failed to remove the cart item:", error);
    return { ok: false, error: t("genericError") };
  }

  revalidatePath("/cart");
  return { ok: true, count: await countItems(customer.id) };
}

function formatOrderNumber(sequence: number): string {
  return `ПИП-${String(sequence).padStart(6, "0")}`;
}

/**
 * Превращает корзину в одну заявку на расчёт.
 *
 * Как и одиночная заявка из конфигуратора: сумма только расчётная,
 * total остаётся нулём до согласования цены менеджером. Услуги, снятые с
 * продажи после добавления в корзину, в заявку не попадают — об этом
 * честно сообщает ошибка, а не молчаливое исчезновение позиции.
 */
export async function checkoutCart(input?: { note?: string }): Promise<CartCheckoutResult> {
  const t = await getActionTranslator();

  const customer = await requireCustomer();
  if (!customer) return { ok: false, error: t("unauthorized") };
  if (!prisma) return { ok: false, error: t("genericError") };

  const cartItems = await prisma.cartItem.findMany({
    where: { userId: customer.id },
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
  if (!cartItems.length) return { ok: false, error: t("cartEmpty") };

  // Пересчёт каждой позиции на сервере — по текущим данным услуги.
  const lines: Array<{
    serviceId: string;
    title: string;
    quantity: number;
    estimatedUnitPrice: number;
    optionsSnapshot: string;
    currency: string;
  }> = [];

  for (const item of cartItems) {
    const service = item.service;
    if (!service || !service.isPublished || !service.isOrderable) {
      return { ok: false, error: t("cartItemUnavailable") };
    }

    let storedOptionIds: string[] = [];
    try {
      const parsed = JSON.parse(item.optionsJson) as Array<{ optionId?: string }>;
      storedOptionIds = parsed
        .map((entry) => entry?.optionId)
        .filter((id): id is string => typeof id === "string");
    } catch {
      storedOptionIds = [];
    }

    const chosenByGroup = sanitizeOptions(service, storedOptionIds);
    if (!chosenByGroup) return { ok: false, error: t("incompleteOptions") };

    const estimate = calculateEstimate(
      { basePrice: service.basePrice, priceType: service.priceType, groups: service.optionGroups },
      [...chosenByGroup.values()],
    );
    if (!estimate.complete) return { ok: false, error: t("incompleteOptions") };

    lines.push({
      serviceId: service.id,
      title: service.title,
      quantity: item.quantity,
      estimatedUnitPrice: estimate.estimatedAmount,
      optionsSnapshot: JSON.stringify(estimate.selected),
      currency: service.currency,
    });
  }

  const estimatedAmount = lines.reduce(
    (sum, line) => sum + line.estimatedUnitPrice * line.quantity,
    0,
  );
  const serviceQuantities = new Map<string, number>();
  for (const line of lines) {
    serviceQuantities.set(
      line.serviceId,
      (serviceQuantities.get(line.serviceId) ?? 0) + line.quantity,
    );
  }
  const note = typeof input?.note === "string" ? input.note.trim().slice(0, 2000) : "";

  let orderNumber = "";
  try {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const sequence = (await prisma.order.count()) + 1 + attempt;
      orderNumber = formatOrderNumber(sequence);
      try {
        await prisma.$transaction(async (tx) => {
          const order = await tx.order.create({
            data: {
              number: orderNumber,
              userId: customer.id,
              status: "quote_requested",
              estimatedAmount,
              subtotal: 0,
              discount: 0,
              total: 0, // цену ещё не согласовал менеджер
              currency: lines[0]?.currency ?? "RUB",
              customerNote: note || null,
              services: {
                create: [...serviceQuantities.entries()].map(
                  ([serviceId, quantity]) => ({ serviceId, quantity }),
                ),
              },
              items: {
                create: lines.map((line) => ({
                  serviceId: line.serviceId,
                  title: line.title,
                  quantity: line.quantity,
                  estimatedUnitPrice: line.estimatedUnitPrice,
                  unitPrice: 0,
                  totalPrice: 0,
                  optionsSnapshot: line.optionsSnapshot,
                })),
              },
            },
          });
          await recordActivity(tx, {
            action: "create",
            entityType: "order",
            entityId: order.id,
            title: `${order.number} — ${lines.map((line) => line.title).join(", ").slice(0, 180)}`,
            actorId: customer.id,
          });
          // Корзина очищается в той же транзакции: заявка и пустая корзина
          // должны появиться одновременно, а не «как получится».
          await tx.cartItem.deleteMany({ where: { userId: customer.id } });
          return order;
        });
        break;
      } catch (error) {
        const code = (error as { code?: string })?.code;
        if (code !== "P2002" || attempt === 4) throw error;
      }
    }
  } catch (error) {
    console.error("Failed to checkout the cart:", error);
    return { ok: false, error: t("genericError") };
  }

  revalidatePath("/cart");
  revalidatePath("/orders");
  return { ok: true, orderNumber };
}
