import { isUniqueConstraintError, recordActivity } from "@/lib/accounts";
import { getOrCreateCartOrder } from "@/lib/cart";
import {
  countOrdersExceptCart,
  deleteOrderItem,
  findCartOrder,
  findOrderItem,
  findProductById,
  insertOrderItem,
  listOrderItems,
  listProductsByIds,
  replaceOrderServices,
  transitionOrder,
  updateOrder,
  updateOrderItem,
  type OrderItemRecord,
  type ProductRecord,
} from "@/lib/commerce-data";
import {
  MAX_CART_QUANTITY,
  calculateServiceSelection,
  canAddProductToCart,
  canAddServiceToCart,
  optionIdsFromSnapshot,
} from "@/lib/commerce";
import { withTransaction, type DbTransaction } from "@/lib/db";
import { findServiceById } from "@/lib/data";

/**
 * Правила корзины и оформления заказа. Каждая мутация выполняется одной
 * SQLite-транзакцией: пересчёт суммы и переход статуса не разъезжаются.
 */

export type CartOperationErrorCode =
  | "cartEmpty"
  | "cartItemNotFound"
  | "itemUnavailable"
  | "incompleteOptions"
  | "insufficientStock"
  | "invalidDeadline"
  | "invalidQuantity"
  | "staleCart";

export class CartOperationError extends Error {
  constructor(public readonly code: CartOperationErrorCode) {
    super(code);
    this.name = "CartOperationError";
  }
}

type CartMutationResult = { count: number };

function validId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 128;
}
function normalizeAddQuantity(value: unknown): number {
  const number = Number(value ?? 1);
  if (!Number.isFinite(number)) return 1;
  return Math.min(MAX_CART_QUANTITY, Math.max(1, Math.trunc(number) || 1));
}
function normalizeExactQuantity(value: unknown): number {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > MAX_CART_QUANTITY) throw new CartOperationError("invalidQuantity");
  return number;
}

async function syncEstimatedAmount(tx: DbTransaction, orderId: string): Promise<number> {
  const items = await listOrderItems(orderId, tx);
  const estimatedAmount = items.reduce((sum, item) => sum + item.estimatedUnitPrice * item.quantity, 0);
  await updateOrder(orderId, { estimatedAmount }, tx);
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

async function writeActivity(tx: DbTransaction, data: { action: string; entityId: string; title: string; actorId: string }) {
  await recordActivity({ ...data, entityType: "order" }, tx);
}

export async function addCartItem(
  userId: string,
  input: { itemType: "service" | "product"; itemId: string; quantity?: number; optionIds?: string[] },
): Promise<CartMutationResult> {
  if (!validId(userId) || !validId(input.itemId)) throw new CartOperationError("itemUnavailable");
  const quantity = normalizeAddQuantity(input.quantity);
  // Корзина создаётся до транзакции: уникальный `cart_key` делает это безопасным.
  const cart = await getOrCreateCartOrder(userId);
  return withTransaction(async (tx) => {
    if (input.itemType === "service") {
      const service = await findServiceById(input.itemId, { withOptions: true });
      if (!service || !canAddServiceToCart(service)) throw new CartOperationError("itemUnavailable");
      const estimate = calculateServiceSelection(service, input.optionIds ?? []);
      if (!estimate) throw new CartOperationError("incompleteOptions");
      const optionsSnapshot = JSON.stringify(estimate.selected);
      const existing = await findOrderItem(cart.id, { itemType: "service", itemId: service.id, optionsSnapshot }, tx);
      const nextQuantity = Math.min(MAX_CART_QUANTITY, (existing?.quantity ?? 0) + quantity);
      if (existing) {
        await updateOrderItem(existing.id, { quantity: nextQuantity, title: service.title, estimatedUnitPrice: estimate.estimatedAmount }, tx);
      } else {
        await insertOrderItem({
          orderId: cart.id,
          itemType: "service",
          itemId: service.id,
          serviceId: service.id,
          title: service.title,
          quantity,
          estimatedUnitPrice: estimate.estimatedAmount,
          optionsSnapshot,
        }, tx);
      }
    } else {
      const product = await findProductById(input.itemId, tx);
      if (!product || !product.isActive) throw new CartOperationError("itemUnavailable");
      const existing = await findOrderItem(cart.id, { itemType: "product", itemId: product.id }, tx);
      const nextQuantity = Math.min(MAX_CART_QUANTITY, (existing?.quantity ?? 0) + quantity);
      if (!canAddProductToCart(product, nextQuantity)) throw new CartOperationError("insufficientStock");
      const estimatedUnitPrice = Math.round(product.price * 100);
      if (existing) {
        await updateOrderItem(existing.id, { quantity: nextQuantity, title: product.name, estimatedUnitPrice }, tx);
      } else {
        await insertOrderItem({
          orderId: cart.id,
          itemType: "product",
          itemId: product.id,
          productId: product.id,
          title: product.name,
          quantity,
          estimatedUnitPrice,
          optionsSnapshot: "[]",
        }, tx);
      }
    }
    return { count: await syncEstimatedAmount(tx, cart.id) };
  });
}

export async function updateOwnedCartItem(userId: string, input: { id: string; quantity: number }): Promise<CartMutationResult> {
  if (!validId(input.id)) throw new CartOperationError("cartItemNotFound");
  const quantity = normalizeExactQuantity(input.quantity);
  return withTransaction(async (tx) => {
    const cart = await findCartOrder(userId, tx);
    if (!cart) throw new CartOperationError("cartItemNotFound");
    const line = await findOrderItem(cart.id, { itemRowId: input.id }, tx);
    if (!line) throw new CartOperationError("cartItemNotFound");
    if (line.itemType === "service") {
      const service = await findServiceById(line.itemId || line.serviceId || "", { withOptions: true });
      if (!service || !canAddServiceToCart(service)) throw new CartOperationError("itemUnavailable");
      const optionIds = optionIdsFromSnapshot(line.optionsSnapshot);
      const estimate = optionIds === null ? null : calculateServiceSelection(service, optionIds);
      if (!estimate) throw new CartOperationError("incompleteOptions");
      await updateOrderItem(line.id, {
        quantity,
        title: service.title,
        estimatedUnitPrice: estimate.estimatedAmount,
        optionsSnapshot: JSON.stringify(estimate.selected),
      }, tx);
    } else if (line.itemType === "product") {
      const product = await findProductById(line.itemId || line.productId || "", tx);
      if (!product || !product.isActive) throw new CartOperationError("itemUnavailable");
      if (!canAddProductToCart(product, quantity)) throw new CartOperationError("insufficientStock");
      await updateOrderItem(line.id, { quantity, title: product.name, estimatedUnitPrice: Math.round(product.price * 100) }, tx);
    } else throw new CartOperationError("itemUnavailable");
    return { count: await syncEstimatedAmount(tx, cart.id) };
  });
}

export async function removeOwnedCartItem(userId: string, id: string): Promise<CartMutationResult> {
  if (!validId(id)) throw new CartOperationError("cartItemNotFound");
  return withTransaction(async (tx) => {
    const cart = await findCartOrder(userId, tx);
    if (!cart) return { count: 0 };
    const removed = await deleteOrderItem(cart.id, id, tx);
    if (removed === 0) throw new CartOperationError("cartItemNotFound");
    return { count: await syncEstimatedAmount(tx, cart.id) };
  });
}

function parseDeadline(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const candidate = new Date(raw);
  if (Number.isNaN(candidate.getTime())) throw new CartOperationError("invalidDeadline");
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const day = new Date(candidate);
  day.setUTCHours(0, 0, 0, 0);
  if (day < today) throw new CartOperationError("invalidDeadline");
  return day;
}
function orderNumber(sequence: number): string {
  return `ПИП-${String(sequence).padStart(6, "0")}`;
}

function lineTargetId(item: OrderItemRecord): string {
  return item.itemId || item.serviceId || item.productId || "";
}

export async function checkoutOwnedCart(
  userId: string,
  input: { note?: string | null; deadline?: string | null } = {},
): Promise<{ orderNumber: string }> {
  const deadline = parseDeadline(input.deadline);
  const note = typeof input.note === "string" ? input.note.trim().slice(0, 4000) : "";
  // Уникальный номер заказа: инкремент от количества оформленных заказов.
  const baseCount = await countOrdersExceptCart();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const number = orderNumber(baseCount + 1 + attempt);
    try {
      return await withTransaction(async (tx) => {
        const cart = await findCartOrder(userId, tx);
        if (!cart) throw new CartOperationError("cartEmpty");
        const cartItems = await listOrderItems(cart.id, tx);
        if (cartItems.length === 0) throw new CartOperationError("cartEmpty");

        const serviceIds = [...new Set(cartItems.filter((item) => item.itemType === "service").map(lineTargetId).filter(Boolean))];
        const productIds = [...new Set(cartItems.filter((item) => item.itemType === "product").map(lineTargetId).filter(Boolean))];
        const services = await Promise.all(serviceIds.map((id) => findServiceById(id, { withOptions: true })));
        const products = await listProductsByIds(productIds, tx);
        const serviceMap = new Map(services.filter((service) => service !== null).map((service) => [service.id, service]));
        const productMap = new Map<string, ProductRecord>(products.map((product) => [product.id, product]));

        const productQuantities = new Map<string, number>();
        for (const line of cartItems) {
          if (line.itemType !== "product") continue;
          const id = lineTargetId(line);
          productQuantities.set(id, (productQuantities.get(id) ?? 0) + line.quantity);
        }
        for (const [id, quantity] of productQuantities) {
          const product = productMap.get(id);
          if (!product || !product.isActive) throw new CartOperationError("itemUnavailable");
          if (!canAddProductToCart(product, quantity)) throw new CartOperationError("insufficientStock");
        }

        let estimatedAmount = 0;
        const serviceQuantities = new Map<string, number>();
        const refreshedTitles: string[] = [];
        for (const line of cartItems) {
          if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > MAX_CART_QUANTITY) throw new CartOperationError("invalidQuantity");
          const id = lineTargetId(line);
          if (line.itemType === "service") {
            const service = serviceMap.get(id);
            if (!service || !canAddServiceToCart(service)) throw new CartOperationError("itemUnavailable");
            const optionIds = optionIdsFromSnapshot(line.optionsSnapshot);
            const estimate = optionIds === null ? null : calculateServiceSelection(service, optionIds);
            if (!estimate) throw new CartOperationError("incompleteOptions");
            estimatedAmount += estimate.estimatedAmount * line.quantity;
            serviceQuantities.set(id, (serviceQuantities.get(id) ?? 0) + line.quantity);
            refreshedTitles.push(service.title);
            await updateOrderItem(line.id, {
              title: service.title,
              estimatedUnitPrice: estimate.estimatedAmount,
              optionsSnapshot: JSON.stringify(estimate.selected),
            }, tx);
          } else if (line.itemType === "product") {
            const product = productMap.get(id);
            if (!product) throw new CartOperationError("itemUnavailable");
            const unitEstimate = Math.round(product.price * 100);
            estimatedAmount += unitEstimate * line.quantity;
            refreshedTitles.push(product.name);
            await updateOrderItem(line.id, { title: product.name, estimatedUnitPrice: unitEstimate }, tx);
          } else throw new CartOperationError("itemUnavailable");
        }

        await replaceOrderServices(
          cart.id,
          [...serviceQuantities].map(([serviceId, quantity]) => ({ serviceId, quantity })),
          tx,
        );

        const transitioned = await transitionOrder(cart.id, "cart", {
          status: "pending",
          cartKey: null,
          orderNumber: number,
          number,
          deadline: deadline ?? null,
          description: note || null,
          customerNote: note || null,
          estimatedAmount,
        }, tx);
        if (!transitioned) throw new CartOperationError("staleCart");
        await writeActivity(tx, {
          action: "create",
          entityId: cart.id,
          title: `${number} — ${refreshedTitles.join(", ").slice(0, 180)}`,
          actorId: userId,
        });
        return { orderNumber: number };
      });
    } catch (error) {
      if (error instanceof CartOperationError) throw error;
      if (!isUniqueConstraintError(error) || attempt === 4) throw error;
    }
  }
  throw new Error("Unable to allocate an order number");
}
