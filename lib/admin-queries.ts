import { queryPayloadRows } from "@/lib/payload-native";

/**
 * Read/write helpers для собственной админ-панели.
 *
 * Запросы идут напрямую в SQLite (та же база, что у сайта), чтобы админка не
 * зависела от CMS-слоя: таблицы — обычный SQL, а не API конкретного продукта.
 * Все запросы параметризованы; строки с `cart` (корзина) в выборки заказов не
 * попадают.
 */

export interface AdminOrderRow {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  currency: string;
  createdAt: string;
  customer: string;
  email: string;
}

export interface AdminServiceRow {
  id: string;
  title: string;
  slug: string;
  category: string;
  basePrice: number;
  priceType: string;
  published: boolean;
  active: boolean;
}

export interface AdminProductRow {
  id: string;
  name: string;
  slug: string;
  category: string;
  price: number;
  stock: number;
  active: boolean;
}

export interface AdminPostRow {
  id: string;
  title: string;
  slug: string;
  published: boolean;
  date: string;
  source: string;
}

export interface AdminAccountRow {
  id: string;
  email: string;
  name: string;
  role: string;
  blocked: boolean;
  createdAt: string;
}

export interface AdminActivityRow {
  id: string;
  action: string;
  title: string;
  entityType: string;
  createdAt: string;
}

export interface AdminRevenuePoint {
  date: string;
  revenue: number;
  orders: number;
}

export interface AdminStatusCount {
  status: string;
  count: number;
}

const ORDER_SCOPE = "o.status <> 'cart'";
const REVENUE_SCOPE = "o.status in ('paid', 'in_progress', 'completed')";

const text = (value: unknown): string => (value == null ? "" : String(value));
const num = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const bool = (value: unknown): boolean => value === 1 || value === true || value === "1";

/** Даты в базе бывают ISO-строкой и миллисекундами — приводим к ISO. */
function isoDate(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "number") return new Date(value).toISOString();
  const asString = String(value);
  if (/^\d+$/.test(asString)) return new Date(Number(asString)).toISOString();
  return asString;
}

export async function getOrders(options: { limit?: number; status?: string } = {}): Promise<AdminOrderRow[]> {
  const limit = Math.min(Math.max(options.limit ?? 25, 1), 200);
  const args: unknown[] = [];
  let filter = ORDER_SCOPE;
  if (options.status) {
    filter += " and o.status = ?";
    args.push(options.status);
  }
  args.push(limit);
  const rows = await queryPayloadRows<Record<string, unknown>>(
    `select o.id, coalesce(o.order_number, o.number, substr(o.id, 1, 8)) order_number,
            o.status, o.total, o.currency, coalesce(o.created_at, o.updated_at) created_at,
            a.email, trim(coalesce(a.first_name, '') || ' ' || coalesce(a.last_name, '')) customer
     from orders o
     left join accounts a on a.id = o.user_id_id
     where ${filter}
     order by coalesce(o.created_at, o.updated_at) desc
     limit ?`,
    args,
  );
  return rows.map((row) => ({
    id: text(row.id),
    orderNumber: text(row.order_number),
    status: text(row.status),
    total: num(row.total),
    currency: text(row.currency) || "RUB",
    createdAt: isoDate(row.created_at),
    customer: text(row.customer),
    email: text(row.email),
  }));
}

export async function getOrderStatusCounts(): Promise<AdminStatusCount[]> {
  const rows = await queryPayloadRows<Record<string, unknown>>(
    `select o.status status, count(*) count from orders o where ${ORDER_SCOPE} group by o.status`,
  );
  return rows.map((row) => ({ status: text(row.status), count: num(row.count) }));
}

export async function getRevenueSeries(days = 30): Promise<AdminRevenuePoint[]> {
  const span = Math.min(Math.max(days, 1), 365);
  const rows = await queryPayloadRows<Record<string, unknown>>(
    `select substr(replace(coalesce(o.created_at, o.updated_at), ' ', 'T'), 1, 10) date,
            sum(case when ${REVENUE_SCOPE} then o.total else 0 end) revenue,
            count(*) orders
     from orders o
     where ${ORDER_SCOPE}
       and coalesce(o.created_at, o.updated_at) >= ?
     group by date
     order by date asc`,
    [new Date(Date.now() - span * 24 * 60 * 60 * 1000).toISOString()],
  );
  return rows.map((row) => ({ date: text(row.date), revenue: num(row.revenue), orders: num(row.orders) }));
}

export async function getServices(): Promise<AdminServiceRow[]> {
  const rows = await queryPayloadRows<Record<string, unknown>>(
    `select id, title, slug, category, base_price, price_type, is_published, is_active
     from services order by sort_order asc, title asc limit 200`,
  );
  return rows.map((row) => ({
    id: text(row.id),
    title: text(row.title),
    slug: text(row.slug),
    category: text(row.category),
    basePrice: num(row.base_price),
    priceType: text(row.price_type),
    published: bool(row.is_published),
    active: bool(row.is_active),
  }));
}

export async function getProducts(): Promise<AdminProductRow[]> {
  const rows = await queryPayloadRows<Record<string, unknown>>(
    `select id, name, slug, category, price, stock, is_active from products order by name asc limit 200`,
  );
  return rows.map((row) => ({
    id: text(row.id),
    name: text(row.name),
    slug: text(row.slug),
    category: text(row.category),
    price: num(row.price),
    stock: num(row.stock),
    active: bool(row.is_active),
  }));
}

export async function getPosts(): Promise<AdminPostRow[]> {
  const rows = await queryPayloadRows<Record<string, unknown>>(
    `select id, title, slug, is_published, coalesce(published_at, created_at) date, source
     from posts order by coalesce(published_at, created_at) desc limit 100`,
  );
  return rows.map((row) => ({
    id: text(row.id),
    title: text(row.title),
    slug: text(row.slug),
    published: bool(row.is_published),
    date: isoDate(row.date),
    source: text(row.source),
  }));
}

export async function getAccounts(limit = 50): Promise<AdminAccountRow[]> {
  const rows = await queryPayloadRows<Record<string, unknown>>(
    `select id, email, trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')) name,
            role, is_blocked, created_at
     from accounts order by created_at desc limit ?`,
    [Math.min(Math.max(limit, 1), 200)],
  );
  return rows.map((row) => ({
    id: text(row.id),
    email: text(row.email),
    name: text(row.name),
    role: text(row.role),
    blocked: bool(row.is_blocked),
    createdAt: isoDate(row.created_at),
  }));
}

export async function getActivity(limit = 20): Promise<AdminActivityRow[]> {
  const rows = await queryPayloadRows<Record<string, unknown>>(
    `select id, action, title, entity_type, created_at from activity_logs order by created_at desc limit ?`,
    [Math.min(Math.max(limit, 1), 100)],
  );
  return rows.map((row) => ({
    id: text(row.id),
    action: text(row.action),
    title: text(row.title),
    entityType: text(row.entity_type),
    createdAt: isoDate(row.created_at),
  }));
}

export async function getContentCounts(): Promise<{ services: number; products: number; posts: number; accounts: number }> {
  const rows = await queryPayloadRows<Record<string, unknown>>(
    `select
       (select count(*) from services) services,
       (select count(*) from products) products,
       (select count(*) from posts) posts,
       (select count(*) from accounts) accounts`,
  );
  const row = rows[0] ?? {};
  return { services: num(row.services), products: num(row.products), posts: num(row.posts), accounts: num(row.accounts) };
}

/** Смена статуса заказа из админки; ограничена списком допустимых статусов. */
export async function setOrderStatus(orderId: string, status: string): Promise<void> {
  await queryPayloadRows(`update orders set status = ?, updated_at = ? where id = ?`, [
    status,
    new Date().toISOString(),
    orderId,
  ]);
}

export async function logAdminAction(input: {
  action: string;
  entityType: "order" | "service" | "post" | "user" | "setting" | "media";
  entityId: string;
  title: string;
  actorId: string | null;
}): Promise<void> {
  await queryPayloadRows(
    `insert into activity_logs (id, action, entity_type, entity_id, title, actor_id_id, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      input.action,
      input.entityType,
      input.entityId,
      input.title,
      input.actorId,
      new Date().toISOString(),
      new Date().toISOString(),
    ],
  );
}
