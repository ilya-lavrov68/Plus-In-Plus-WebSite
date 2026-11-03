import { randomUUID } from "node:crypto";

import { rows, run, sqlValue, type SqlExecutor } from "@/lib/db";

/**
 * Заказы, позиции корзины, связи «заказ—услуга», счета и товары.
 *
 * Раньше эти коллекции читал и писал Payload Local API; теперь это обычный
 * параметризованный SQL над `orders`, `order_items`, `order_services`,
 * `payments` и `products`. Модуль не содержит бизнес-правил: он только
 * превращает строки в доменные объекты и обратно, чтобы правила корзины и
 * оплаты оставались явными в `lib/cart*.ts` и `lib/payments/*`.
 */

export type { SqlExecutor };

const direct: SqlExecutor = { rows, run };

const ORDER_COLUMNS = `id, order_number, number, user_id_id, cart_key, status, estimated_amount, subtotal,
  discount, total, currency, deadline, description, final_price, customer_note, manager_note,
  manager_id_id, price_agreed_at, is_locked, locked_at, locked_by_id_id, paid_at, created_at, updated_at`;

const ORDER_ITEM_COLUMNS = `id, order_id_id, item_type, item_id, service_id_id, product_id_id, title,
  quantity, estimated_unit_price, unit_price, total_price, options_snapshot, created_at, updated_at`;

const PAYMENT_COLUMNS = `id, order_id_id, provider, external_id, provider_key, status, amount, currency,
  payment_url, raw_payload, paid_at, created_at, updated_at`;

const PRODUCT_COLUMNS = `p.id, p.name, p.slug, p.description, p.price, p.cover_image, p.cover_id, p.category,
  p.is_active, p.stock, p.created_at, p.updated_at, m.url cover_url`;

export interface OrderRecord {
  id: string;
  orderNumber: string | null;
  number: string | null;
  userId: string;
  cartKey: string | null;
  status: string;
  estimatedAmount: number;
  subtotal: number;
  discount: number;
  total: number;
  currency: string;
  deadline: Date | null;
  description: string | null;
  finalPrice: number | null;
  customerNote: string | null;
  managerNote: string | null;
  managerId: string | null;
  priceAgreedAt: Date | null;
  isLocked: boolean;
  lockedAt: Date | null;
  lockedById: string | null;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItemRecord {
  id: string;
  orderId: string;
  itemType: "service" | "product";
  itemId: string;
  serviceId: string | null;
  productId: string | null;
  title: string;
  quantity: number;
  estimatedUnitPrice: number;
  unitPrice: number;
  totalPrice: number;
  optionsSnapshot: string;
}

export interface OrderServiceRecord {
  id: string;
  orderId: string;
  serviceId: string;
  quantity: number;
}

export interface PaymentRecord {
  id: string;
  orderId: string;
  provider: string;
  externalId: string | null;
  providerKey: string | null;
  status: string;
  amount: number;
  currency: string;
  paymentUrl: string | null;
  rawPayload: string | null;
  paidAt: Date | null;
  createdAt: Date;
}

export interface ProductRecord {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  coverImage: string | null;
  cover: { url: string | null };
  category: string | null;
  isActive: boolean;
  stock: number;
  createdAt: Date;
  updatedAt: Date;
}

function date(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? new Date(value) : new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function mapOrder(source: Record<string, unknown>): OrderRecord {
  return {
    id: String(source.id),
    orderNumber: source.order_number == null ? null : String(source.order_number),
    number: source.number == null ? null : String(source.number),
    userId: String(source.user_id_id ?? ""),
    cartKey: source.cart_key == null ? null : String(source.cart_key),
    status: String(source.status ?? "cart"),
    estimatedAmount: num(source.estimated_amount),
    subtotal: num(source.subtotal),
    discount: num(source.discount),
    total: num(source.total),
    currency: String(source.currency ?? "RUB"),
    deadline: date(source.deadline),
    description: source.description == null ? null : String(source.description),
    finalPrice: source.final_price == null ? null : num(source.final_price),
    customerNote: source.customer_note == null ? null : String(source.customer_note),
    managerNote: source.manager_note == null ? null : String(source.manager_note),
    managerId: source.manager_id_id == null ? null : String(source.manager_id_id),
    priceAgreedAt: date(source.price_agreed_at),
    isLocked: sqlValue.boolean(source.is_locked),
    lockedAt: date(source.locked_at),
    lockedById: source.locked_by_id_id == null ? null : String(source.locked_by_id_id),
    paidAt: date(source.paid_at),
    createdAt: date(source.created_at) ?? new Date(0),
    updatedAt: date(source.updated_at) ?? new Date(0),
  };
}

export function mapOrderItem(source: Record<string, unknown>): OrderItemRecord {
  return {
    id: String(source.id),
    orderId: String(source.order_id_id ?? ""),
    itemType: source.item_type === "product" ? "product" : "service",
    itemId: String(source.item_id ?? ""),
    serviceId: source.service_id_id == null ? null : String(source.service_id_id),
    productId: source.product_id_id == null ? null : String(source.product_id_id),
    title: String(source.title ?? ""),
    quantity: num(source.quantity) || 1,
    estimatedUnitPrice: num(source.estimated_unit_price),
    unitPrice: num(source.unit_price),
    totalPrice: num(source.total_price),
    optionsSnapshot: String(source.options_snapshot ?? "[]"),
  };
}

export function mapOrderService(source: Record<string, unknown>): OrderServiceRecord {
  return {
    id: String(source.id),
    orderId: String(source.order_id_id ?? ""),
    serviceId: String(source.service_id_id ?? ""),
    quantity: num(source.quantity) || 1,
  };
}

export function mapPayment(source: Record<string, unknown>): PaymentRecord {
  return {
    id: String(source.id),
    orderId: String(source.order_id_id ?? ""),
    provider: String(source.provider ?? "robokassa"),
    externalId: source.external_id == null ? null : String(source.external_id),
    providerKey: source.provider_key == null ? null : String(source.provider_key),
    status: String(source.status ?? "pending"),
    amount: num(source.amount),
    currency: String(source.currency ?? "RUB"),
    paymentUrl: source.payment_url == null ? null : String(source.payment_url),
    rawPayload: source.raw_payload == null ? null : String(source.raw_payload),
    paidAt: date(source.paid_at),
    createdAt: date(source.created_at) ?? new Date(0),
  };
}

export function mapProduct(source: Record<string, unknown>): ProductRecord {
  const coverUrl = source.cover_url == null || source.cover_url === "" ? null : String(source.cover_url);
  const storedUrl = source.cover_image == null || source.cover_image === "" ? null : String(source.cover_image);
  return {
    id: String(source.id),
    name: String(source.name ?? ""),
    slug: String(source.slug ?? ""),
    description: source.description == null ? null : String(source.description),
    price: num(source.price),
    coverImage: storedUrl ?? coverUrl,
    cover: { url: coverUrl ?? storedUrl },
    category: source.category == null ? null : String(source.category),
    isActive: source.is_active === undefined || source.is_active === null ? true : sqlValue.boolean(source.is_active),
    stock: num(source.stock),
    createdAt: date(source.created_at) ?? new Date(0),
    updatedAt: date(source.updated_at) ?? new Date(0),
  };
}

/* ---------------------------------------------------------------- заказы */

/** Корзина — это заказ со статусом `cart` и уникальным `cart_key`. */
export async function findCartOrder(userId: string, exec: SqlExecutor = direct): Promise<OrderRecord | null> {
  const found = await exec.rows(
    `select ${ORDER_COLUMNS} from orders where user_id_id = ? and status = 'cart'
     order by created_at desc limit 1`,
    [userId],
  );
  return found[0] ? mapOrder(found[0]) : null;
}

export async function findOrderById(id: string, exec: SqlExecutor = direct): Promise<OrderRecord | null> {
  const found = await exec.rows(`select ${ORDER_COLUMNS} from orders where id = ? limit 1`, [id]);
  return found[0] ? mapOrder(found[0]) : null;
}

/** Поиск оформленного заказа по id, `number` или `order_number` (redirect-формы шлют любой). */
export async function findOrderByReference(reference: string, exec: SqlExecutor = direct): Promise<OrderRecord | null> {
  const found = await exec.rows(
    `select ${ORDER_COLUMNS} from orders
     where status <> 'cart' and (id = ? or number = ? or order_number = ?) limit 1`,
    [reference, reference, reference],
  );
  return found[0] ? mapOrder(found[0]) : null;
}

export async function countPaymentsByStatus(orderId: string, status: string, exec: SqlExecutor = direct): Promise<number> {
  const found = await exec.rows<{ total: number }>(
    `select count(*) total from payments where order_id_id = ? and status = ?`,
    [orderId, status],
  );
  return Number(found[0]?.total ?? 0);
}

export interface NewOrder {
  userId: string;
  status: string;
  orderNumber?: string | null;
  number?: string | null;
  customerNote?: string | null;
  description?: string | null;
  deadline?: Date | null;
  cartKey?: string | null;
  estimatedAmount?: number;
  subtotal?: number;
  discount?: number;
  total?: number;
  currency?: string;
}

export async function insertOrder(input: NewOrder, exec: SqlExecutor = direct): Promise<OrderRecord> {
  const id = randomUUID();
  const now = new Date().toISOString();
  await exec.run(
    `insert into orders (id, user_id_id, cart_key, status, order_number, number, customer_note,
       description, deadline, estimated_amount, subtotal, discount, total, currency, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.userId,
      input.cartKey ?? null,
      input.status,
      input.orderNumber ?? null,
      input.number ?? null,
      input.customerNote ?? null,
      input.description ?? null,
      input.deadline ? input.deadline.toISOString() : null,
      input.estimatedAmount ?? 0,
      input.subtotal ?? 0,
      input.discount ?? 0,
      input.total ?? 0,
      input.currency ?? "RUB",
      now,
      now,
    ],
  );
  const created = await findOrderById(id, exec);
  if (!created) throw new Error("Order row disappeared right after insert.");
  return created;
}

const ORDER_FIELDS = {
  orderNumber: "order_number",
  number: "number",
  cartKey: "cart_key",
  status: "status",
  estimatedAmount: "estimated_amount",
  subtotal: "subtotal",
  discount: "discount",
  total: "total",
  currency: "currency",
  deadline: "deadline",
  description: "description",
  finalPrice: "final_price",
  customerNote: "customer_note",
  managerNote: "manager_note",
  managerId: "manager_id_id",
  priceAgreedAt: "price_agreed_at",
  isLocked: "is_locked",
  lockedAt: "locked_at",
  lockedById: "locked_by_id_id",
  paidAt: "paid_at",
} as const;

export type OrderPatch = Partial<{ [K in keyof typeof ORDER_FIELDS]: Date | string | number | boolean | null }>;

function orderValue(key: string, value: unknown): unknown {
  if (key === "isLocked") return value ? 1 : 0;
  if (value instanceof Date) return value.toISOString();
  return value ?? null;
}

export async function updateOrder(id: string, patch: OrderPatch, exec: SqlExecutor = direct): Promise<void> {
  const assignments: string[] = [];
  const params: unknown[] = [];
  for (const [key, column] of Object.entries(ORDER_FIELDS)) {
    if (!(key in patch)) continue;
    assignments.push(`${column} = ?`);
    params.push(orderValue(key, patch[key as keyof OrderPatch]));
  }
  if (!assignments.length) return;
  assignments.push("updated_at = ?");
  params.push(new Date().toISOString(), id);
  await exec.run(`update orders set ${assignments.join(", ")} where id = ?`, params);
}

/**
 * Условный переход статуса: конкурентные checkout/оплата не перетирают друг
 * друга, потому что UPDATE требует прежнего статуса.
 */
export async function transitionOrder(
  id: string,
  fromStatus: string,
  patch: OrderPatch,
  exec: SqlExecutor = direct,
): Promise<boolean> {
  const assignments: string[] = [];
  const params: unknown[] = [];
  for (const [key, column] of Object.entries(ORDER_FIELDS)) {
    if (!(key in patch)) continue;
    assignments.push(`${column} = ?`);
    params.push(orderValue(key, patch[key as keyof OrderPatch]));
  }
  assignments.push("updated_at = ?");
  params.push(new Date().toISOString(), id, fromStatus);
  const affected = await exec.run(
    `update orders set ${assignments.join(", ")} where id = ? and status = ?`,
    params,
  );
  return affected === 1;
}

export async function countOrdersByStatus(status: string, exec: SqlExecutor = direct): Promise<number> {
  const found = await exec.rows<{ total: number }>(`select count(*) total from orders where status = ?`, [status]);
  return Number(found[0]?.total ?? 0);
}

export async function countOrdersExceptCart(exec: SqlExecutor = direct): Promise<number> {
  const found = await exec.rows<{ total: number }>(`select count(*) total from orders where status <> 'cart'`, []);
  return Number(found[0]?.total ?? 0);
}

export async function listOrdersForUser(userId: string, exec: SqlExecutor = direct): Promise<OrderRecord[]> {
  const found = await exec.rows(
    `select ${ORDER_COLUMNS} from orders where user_id_id = ? and status <> 'cart' order by created_at desc`,
    [userId],
  );
  return found.map(mapOrder);
}

/* ------------------------------------------------------- позиции заказа */

export async function listOrderItems(orderId: string, exec: SqlExecutor = direct): Promise<OrderItemRecord[]> {
  const found = await exec.rows(
    `select ${ORDER_ITEM_COLUMNS} from order_items where order_id_id = ? order by created_at, id`,
    [orderId],
  );
  return found.map(mapOrderItem);
}

export async function listOrderItemsForOrders(orderIds: readonly string[]): Promise<OrderItemRecord[]> {
  if (!orderIds.length) return [];
  const found = await rows(
    `select ${ORDER_ITEM_COLUMNS} from order_items where order_id_id in (${orderIds.map(() => "?").join(", ")})`,
    [...orderIds],
  );
  return found.map(mapOrderItem);
}

export interface NewOrderItem {
  orderId: string;
  itemType: "service" | "product";
  itemId: string;
  serviceId?: string | null;
  productId?: string | null;
  title: string;
  quantity: number;
  estimatedUnitPrice: number;
  optionsSnapshot?: string;
}

export async function insertOrderItem(input: NewOrderItem, exec: SqlExecutor = direct): Promise<string> {
  const id = randomUUID();
  const now = new Date().toISOString();
  await exec.run(
    `insert into order_items (id, order_id_id, item_type, item_id, service_id_id, product_id_id, title,
       quantity, estimated_unit_price, unit_price, total_price, options_snapshot, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?)`,
    [
      id,
      input.orderId,
      input.itemType,
      input.itemId,
      input.serviceId ?? null,
      input.productId ?? null,
      input.title,
      input.quantity,
      input.estimatedUnitPrice,
      input.optionsSnapshot ?? "[]",
      now,
      now,
    ],
  );
  return id;
}

export interface OrderItemPatch {
  quantity?: number;
  title?: string;
  estimatedUnitPrice?: number;
  optionsSnapshot?: string;
  totalPrice?: number;
}

export async function updateOrderItem(id: string, patch: OrderItemPatch, exec: SqlExecutor = direct): Promise<void> {
  const columns: Array<[string, unknown]> = [];
  if (patch.quantity !== undefined) columns.push(["quantity", patch.quantity]);
  if (patch.title !== undefined) columns.push(["title", patch.title]);
  if (patch.estimatedUnitPrice !== undefined) columns.push(["estimated_unit_price", patch.estimatedUnitPrice]);
  if (patch.optionsSnapshot !== undefined) columns.push(["options_snapshot", patch.optionsSnapshot]);
  if (patch.totalPrice !== undefined) columns.push(["total_price", patch.totalPrice]);
  if (!columns.length) return;
  const assignments = columns.map(([column]) => `${column} = ?`);
  const params = columns.map(([, value]) => value);
  assignments.push("updated_at = ?");
  params.push(new Date().toISOString(), id);
  await exec.run(`update order_items set ${assignments.join(", ")} where id = ?`, params);
}

export async function deleteOrderItem(orderId: string, itemId: string, exec: SqlExecutor = direct): Promise<number> {
  return exec.run(`delete from order_items where id = ? and order_id_id = ?`, [itemId, orderId]);
}

export async function findOrderItem(
  orderId: string,
  where: { itemType?: "service" | "product"; itemId?: string; optionsSnapshot?: string; itemRowId?: string },
  exec: SqlExecutor = direct,
): Promise<OrderItemRecord | null> {
  const clauses = ["order_id_id = ?"];
  const params: unknown[] = [orderId];
  if (where.itemRowId !== undefined) {
    clauses.push("id = ?");
    params.push(where.itemRowId);
  }
  if (where.itemType !== undefined) {
    clauses.push("item_type = ?");
    params.push(where.itemType);
  }
  if (where.itemId !== undefined) {
    clauses.push("item_id = ?");
    params.push(where.itemId);
  }
  if (where.optionsSnapshot !== undefined) {
    clauses.push("options_snapshot = ?");
    params.push(where.optionsSnapshot);
  }
  const found = await exec.rows(
    `select ${ORDER_ITEM_COLUMNS} from order_items where ${clauses.join(" and ")} order by created_at, id limit 1`,
    params,
  );
  return found[0] ? mapOrderItem(found[0]) : null;
}

/* --------------------------------------------- связи «заказ—услуга» */

export async function listOrderServicesForOrders(orderIds: readonly string[]): Promise<OrderServiceRecord[]> {
  if (!orderIds.length) return [];
  const found = await rows(
    `select id, order_id_id, service_id_id, quantity from order_services
     where order_id_id in (${orderIds.map(() => "?").join(", ")})`,
    [...orderIds],
  );
  return found.map(mapOrderService);
}

export async function replaceOrderServices(
  orderId: string,
  links: ReadonlyArray<{ serviceId: string; quantity: number }>,
  exec: SqlExecutor = direct,
): Promise<void> {
  await exec.run(`delete from order_services where order_id_id = ?`, [orderId]);
  const now = new Date().toISOString();
  for (const link of links) {
    await exec.run(
      `insert into order_services (id, order_id_id, service_id_id, quantity, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?)`,
      [randomUUID(), orderId, link.serviceId, link.quantity, now, now],
    );
  }
}

/* ---------------------------------------------------------------- счета */

export async function listPaymentsForOrders(orderIds: readonly string[]): Promise<PaymentRecord[]> {
  if (!orderIds.length) return [];
  const found = await rows(
    `select ${PAYMENT_COLUMNS} from payments where order_id_id in (${orderIds.map(() => "?").join(", ")})
     order by created_at desc`,
    [...orderIds],
  );
  return found.map(mapPayment);
}

export async function listPaymentsForOrder(orderId: string, exec: SqlExecutor = direct): Promise<PaymentRecord[]> {
  const found = await exec.rows(
    `select ${PAYMENT_COLUMNS} from payments where order_id_id = ? order by created_at desc`,
    [orderId],
  );
  return found.map(mapPayment);
}

export async function findPaymentByExternalId(
  externalId: string,
  provider: string,
  exec: SqlExecutor = direct,
): Promise<PaymentRecord | null> {
  const found = await exec.rows(
    `select ${PAYMENT_COLUMNS} from payments where external_id = ? and provider = ? limit 1`,
    [externalId, provider],
  );
  return found[0] ? mapPayment(found[0]) : null;
}

export interface NewPayment {
  orderId: string;
  provider: string;
  externalId: string;
  status: string;
  amount: number;
  currency: string;
  paymentUrl: string | null;
}

export async function insertPayment(input: NewPayment, exec: SqlExecutor = direct): Promise<PaymentRecord> {
  const id = randomUUID();
  const now = new Date().toISOString();
  await exec.run(
    `insert into payments (id, order_id_id, provider, external_id, status, amount, currency, payment_url, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.orderId, input.provider, input.externalId, input.status, input.amount, input.currency, input.paymentUrl, now, now],
  );
  const found = await exec.rows(`select ${PAYMENT_COLUMNS} from payments where id = ? limit 1`, [id]);
  if (!found[0]) throw new Error("Payment row disappeared right after insert.");
  return mapPayment(found[0]);
}

/**
 * Пометка «оплачено» ровно один раз: условный UPDATE по статусу `pending`.
 */
export async function markPaymentSucceeded(
  paymentId: string,
  rawPayload: string,
  exec: SqlExecutor = direct,
): Promise<boolean> {
  const now = new Date().toISOString();
  const affected = await exec.run(
    `update payments set status = 'succeeded', paid_at = ?, raw_payload = ?, updated_at = ?
     where id = ? and status = 'pending'`,
    [now, rawPayload, now, paymentId],
  );
  return affected === 1;
}

export async function setPaymentUrl(paymentId: string, paymentUrl: string, exec: SqlExecutor = direct): Promise<boolean> {
  const now = new Date().toISOString();
  const affected = await exec.run(
    `update payments set payment_url = ?, updated_at = ? where id = ? and status = 'pending' and payment_url is null`,
    [paymentUrl, now, paymentId],
  );
  return affected === 1;
}

export async function expirePendingPayments(orderId: string, exec: SqlExecutor = direct): Promise<void> {
  const now = new Date().toISOString();
  await exec.run(
    `update payments set status = 'failed', updated_at = ? where order_id_id = ? and status = 'pending'`,
    [now, orderId],
  );
}

/* --------------------------------------------------------------- товары */

export async function listProductsByIds(ids: readonly string[], exec: SqlExecutor = direct): Promise<ProductRecord[]> {
  if (!ids.length) return [];
  const found = await exec.rows(
    `select ${PRODUCT_COLUMNS} from products p left join media m on m.id = p.cover_id
     where p.id in (${ids.map(() => "?").join(", ")})`,
    [...ids],
  );
  return found.map(mapProduct);
}

export async function findProductById(id: string, exec: SqlExecutor = direct): Promise<ProductRecord | null> {
  const [product] = await listProductsByIds([id], exec);
  return product ?? null;
}

export async function findProductBySlug(slug: string, exec: SqlExecutor = direct): Promise<ProductRecord | null> {
  const found = await exec.rows(
    `select ${PRODUCT_COLUMNS} from products p left join media m on m.id = p.cover_id where p.slug = ? limit 1`,
    [slug],
  );
  return found[0] ? mapProduct(found[0]) : null;
}

export async function listActiveProducts(exec: SqlExecutor = direct): Promise<ProductRecord[]> {
  const found = await exec.rows(
    `select ${PRODUCT_COLUMNS} from products p left join media m on m.id = p.cover_id
     where p.is_active = 1 order by p.created_at desc`,
    [],
  );
  return found.map(mapProduct);
}

/** Настройки сайта (в том числе ключи Robokassa) — плоская таблица key/value. */
export async function listSiteSettings(prefix: string | null, exec: SqlExecutor = direct): Promise<Record<string, string>> {
  const found = prefix
    ? await exec.rows<{ key: string; value: unknown }>(
        `select "key" as key, value from site_settings where "key" like ?`,
        [`${prefix}%`],
      )
    : await exec.rows<{ key: string; value: unknown }>(`select "key" as key, value from site_settings`, []);
  return Object.fromEntries(found.map((row) => [String(row.key), String(row.value ?? "")]));
}
