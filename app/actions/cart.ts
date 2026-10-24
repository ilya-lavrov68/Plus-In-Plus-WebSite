"use server";

import { revalidatePath } from "next/cache";

import { getActionTranslator } from "@/lib/action-i18n";
import { requireActiveCustomer } from "@/lib/cart";
import {
  CartOperationError,
  addCartItem,
  checkoutOwnedCart,
  removeOwnedCartItem,
  updateOwnedCartItem,
  type CartOperationErrorCode,
} from "@/lib/cart-operations";
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

function errorKey(error: unknown): CartOperationErrorCode | "genericError" {
  return error instanceof CartOperationError ? error.code : "genericError";
}

function revalidateCart() {
  revalidatePath("/cart");
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

  try {
    const result = await addCartItem(customer.id, {
      itemType: "service",
      itemId: input.serviceId,
      optionIds: input.optionIds,
      quantity: input.quantity,
    });
    revalidateCart();
    return { ok: true, count: result.count };
  } catch (error) {
    if (!(error instanceof CartOperationError)) {
      console.error("Failed to add to cart:", error);
    }
    return { ok: false, error: t(errorKey(error)) };
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

  try {
    const result = await updateOwnedCartItem(customer.id, {
      id: input.itemId,
      quantity: input.quantity,
    });
    revalidateCart();
    return { ok: true, count: result.count };
  } catch (error) {
    if (!(error instanceof CartOperationError)) {
      console.error("Failed to update the cart item:", error);
    }
    return { ok: false, error: t(errorKey(error)) };
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
    const result = await removeOwnedCartItem(customer.id, input.itemId);
    revalidateCart();
    return { ok: true, count: result.count };
  } catch (error) {
    if (!(error instanceof CartOperationError)) {
      console.error("Failed to remove the cart item:", error);
    }
    return { ok: false, error: t(errorKey(error)) };
  }
}

export async function checkoutCart(input?: {
  note?: string;
  deadline?: string | null;
}): Promise<CartCheckoutResult> {
  const t = await getActionTranslator();
  const customer = await requireActiveCustomer();
  if (!customer) return { ok: false, error: t("unauthorized") };
  if (!prisma) return { ok: false, error: t("genericError") };

  try {
    const result = await checkoutOwnedCart(customer.id, {
      note: input?.note,
      deadline: input?.deadline,
    });
    revalidatePath("/cart");
    revalidatePath("/cart");
    revalidatePath("/admin/orders");
    revalidatePath("/manager/orders");
    revalidatePath("/admin/dashboard");
    return { ok: true, orderNumber: result.orderNumber };
  } catch (error) {
    if (!(error instanceof CartOperationError)) {
      console.error("Failed to checkout the cart:", error);
    }
    return { ok: false, error: t(errorKey(error)) };
  }
}
