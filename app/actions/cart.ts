"use server";

import { revalidatePath } from "next/cache";

import { getActionTranslator } from "@/lib/action-i18n";
import { recordActivity } from "@/lib/activity-log";
import {
  getOrCreateCartOrder,
  requireActiveCustomer,
  syncCartEstimatedAmount,
} from "@/lib/cart";
import { calculateEstimate } from "@/lib/pricing";
import { prisma } from "@/lib/prisma";

export interface CartActionResult {
  ok: boolean;
  error?: string;
  count?: number;
}

export interface CartCheckoutResult {
  ok: boolean;
  error?: string;
  orderNumber?: string;
}

const MAX_QUANTITY = 99;

function sanitizeOptions(
  service: {
    optionGroups: Array<{
      id: string;
      required: boolean;
      options: Array<{ id: string; isDefault: boolean }>;
    }>;
  },
  optionIds: string[]
): Map<string, string> | null {
  const chosenByGroup = new Map<string, string>();
  for (const optionId of optionIds) {
    if (typeof optionId !== "string") continue;
    const group = service.optionGroups.find((candidate) =>
      candidate.options.some((option) => option.id === optionId)
    );
    if (!group) continue;
    if (!chosenByGroup.has(group.id)) chosenByGroup.set(group.id, optionId);
  }
  for (const group of service.optionGroups) {
    if (!group.required || chosenByGroup.has(group.id)) continue;
    const fallback =
      group.options.find((option) => option.isDefault) ?? group.options[0];
    if (!fallback) return null;
    chosenByGroup.set(group.id, fallback.id);
  }
  return chosenByGroup;
}

/** Кладёт услугу с выбранными опциями в единую корзину Order (status='cart'). */
export async function addToCart(input: {
  serviceId: string;
  optionIds?: string[];
  quantity?: number;
}): Promise<CartActionResult> {
  const t = await getActionTranslator();

  const customer = await requireActiveCustomer();
  if (!customer) return { ok: false, error: t("unauthorized") };
  if (!prisma) return { ok: false, error: t("genericError") };

  const quantity = Math.min(
    MAX_QUANTITY,
    Math.max(1, Math.trunc(Number(input.quantity ?? 1)) || 1)
  );

  const service = await prisma.service.findFirst({
    where: { id: input.serviceId, isActive: true },
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

  const estimate = calculateEstimate(
    {
      basePrice: service.basePrice,
      priceType: service.priceType,
      groups: service.optionGroups,
    },
    [...chosenByGroup.values()]
  );

  const optionsSnapshot = JSON.stringify(estimate.selected);

  try {
    const cart = await getOrCreateCartOrder(customer.id);
    const existing = await prisma.orderItem.findFirst({
      where: {
        orderId: cart.id,
        itemType: "service",
        itemId: service.id,
        optionsSnapshot,
      },
    });

    if (existing) {
      await prisma.orderItem.update({
        where: { id: existing.id },
        data: {
          quantity: Math.min(MAX_QUANTITY, existing.quantity + quantity),
          title: service.title,
          estimatedUnitPrice: estimate.estimatedAmount,
        },
      });
    } else {
      await prisma.orderItem.create({
        data: {
          orderId: cart.id,
          itemType: "service",
          itemId: service.id,
          serviceId: service.id,
          title: service.title,
          quantity,
          estimatedUnitPrice: estimate.estimatedAmount,
          optionsSnapshot,
        },
      });
    }

    const count = await syncCartEstimatedAmount(cart.id);
    revalidatePath("/cart");
    return { ok: true, count };
  } catch (error) {
    console.error("Failed to add to cart:", error);
    return { ok: false, error: t("genericError") };
  }
}

export async function updateCartItemQuantity(input: {
  itemId: string;
  quantity: number;
}): Promise<CartActionResult> {
  const t = await getActionTranslator();

  const customer = await requireActiveCustomer();
  if (!customer) return { ok: false, error: t("unauthorized") };
  if (!prisma) return { ok: false, error: t("genericError") };

  const quantity = Math.trunc(Number(input.quantity));
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
    return { ok: false, error: t("genericError") };
  }

  try {
    const cart = await prisma.order.findFirst({
      where: { userId: customer.id, status: "cart" },
      orderBy: { createdAt: "desc" },
    });
    if (!cart) return { ok: false, error: t("genericError") };

    const updated = await prisma.orderItem.updateMany({
      where: { id: input.itemId, orderId: cart.id },
      data: { quantity },
    });
    if (!updated.count) return { ok: false, error: t("genericError") };

    const count = await syncCartEstimatedAmount(cart.id);
    revalidatePath("/cart");
    return { ok: true, count };
  } catch (error) {
    console.error("Failed to update the cart item:", error);
    return { ok: false, error: t("genericError") };
  }
}

export async function removeCartItem(input: {
  itemId: string;
}): Promise<CartActionResult> {
  const t = await getActionTranslator();

  const customer = await requireActiveCustomer();
  if (!customer) return { ok: false, error: t("unauthorized") };
  if (!prisma) return { ok: false, error: t("genericError") };

  try {
    const cart = await prisma.order.findFirst({
      where: { userId: customer.id, status: "cart" },
      orderBy: { createdAt: "desc" },
    });
    if (!cart) return { ok: true, count: 0 };

    await prisma.orderItem.deleteMany({
      where: { id: input.itemId, orderId: cart.id },
    });

    const count = await syncCartEstimatedAmount(cart.id);
    revalidatePath("/cart");
    return { ok: true, count };
  } catch (error) {
    console.error("Failed to remove the cart item:", error);
    return { ok: false, error: t("genericError") };
  }
}

function formatOrderNumber(sequence: number): string {
  return `ПИП-${String(sequence).padStart(6, "0")}`;
}

export async function checkoutCart(input?: {
  note?: string;
  deadline?: string | null;
}): Promise<CartCheckoutResult> {
  const t = await getActionTranslator();

  const customer = await requireActiveCustomer();
  if (!customer) return { ok: false, error: t("unauthorized") };
  if (!prisma) return { ok: false, error: t("genericError") };

  const cart = await prisma.order.findFirst({
    where: { userId: customer.id, status: "cart" },
    orderBy: { createdAt: "desc" },
    include: { items: true },
  });
  if (!cart || !cart.items.length) return { ok: false, error: t("cartEmpty") };

  let parsedDeadline: Date | null = null;
  if (input?.deadline) {
    const candidate = new Date(input.deadline);
    if (!Number.isNaN(candidate.getTime())) {
      parsedDeadline = candidate;
    }
  }

  const note =
    typeof input?.note === "string" ? input.note.trim().slice(0, 4000) : "";

  const serviceQuantities = new Map<string, number>();
  let estimatedAmount = 0;
  for (const item of cart.items) {
    estimatedAmount += item.estimatedUnitPrice * item.quantity;
    if (item.itemType === "service") {
      const svcId = item.itemId || item.serviceId;
      if (svcId) {
        serviceQuantities.set(
          svcId,
          (serviceQuantities.get(svcId) ?? 0) + item.quantity
        );
      }
    }
  }

  let orderNumber = "";
  try {
    const baseCount = await prisma.order.count({
      where: { status: { not: "cart" } },
    });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      orderNumber = formatOrderNumber(baseCount + 1 + attempt);
      try {
        await prisma.$transaction(async (tx) => {
          await tx.orderService.deleteMany({ where: { orderId: cart.id } });
          if (serviceQuantities.size > 0) {
            await tx.orderService.createMany({
              data: [...serviceQuantities.entries()].map(
                ([serviceId, quantity]) => ({
                  orderId: cart.id,
                  serviceId,
                  quantity,
                })
              ),
            });
          }

          await tx.order.update({
            where: { id: cart.id },
            data: {
              status: "pending",
              orderNumber,
              number: orderNumber,
              deadline: parsedDeadline,
              description: note || null,
              customerNote: note || null,
              estimatedAmount,
            },
          });

          await recordActivity(tx, {
            action: "create",
            entityType: "order",
            entityId: cart.id,
            title: `${orderNumber} — ${cart.items
              .map((line) => line.title || line.itemId)
              .join(", ")
              .slice(0, 180)}`,
            actorId: customer.id,
          });
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
