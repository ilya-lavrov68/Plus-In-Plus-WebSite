import { rows, run, type SqlExecutor } from "@/lib/db";

/**
 * Правила каталога услуг.
 *
 * Хуки CMS запрещали менять цену и варианты услуги, по которой уже идут
 * заказы, и удалять такую услугу. Правила перенесены сюда: админка и скрипты
 * ходят через эти функции, а не пишут в таблицу напрямую.
 */

export class ServiceRuleError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = "ServiceRuleError";
  }
}

/** Статусы, при которых заказ ещё «живой» для услуги. */
const ACTIVE_ORDER_STATUSES = [
  "pending",
  "quote_requested",
  "negotiating",
  "priced",
  "awaiting_payment",
  "paid",
  "in_progress",
] as const;

export async function countActiveServiceOrders(serviceId: string, exec: SqlExecutor = { rows, run }): Promise<number> {
  const placeholders = ACTIVE_ORDER_STATUSES.map(() => "?").join(", ");
  const found = await exec.rows<{ total: number }>(
    `select count(*) total from orders o
     where o.status in (${placeholders})
       and (exists (select 1 from order_services os where os.order_id_id = o.id and os.service_id_id = ?)
            or exists (select 1 from order_items oi where oi.order_id_id = o.id and oi.service_id_id = ?))`,
    [...ACTIVE_ORDER_STATUSES, serviceId, serviceId],
  );
  return Number(found[0]?.total ?? 0);
}

export interface ServiceUpdate {
  id: string;
  title: string;
  category: "small" | "large";
  shortDesc: string;
  fullDesc: string;
  basePrice: number;
  priceType: "from" | "quote";
  isPublished: boolean;
  isActive: boolean;
  sortOrder: number;
}

function rublesToKopecks(value: number): number {
  return Math.round(value * 100);
}

/**
 * Обновляет услугу. `basePrice` приходит в рублях и сохраняется в копейках,
 * как того ждёт остальной код (`estimated_unit_price`).
 */
export async function updateService(input: ServiceUpdate): Promise<void> {
  const [current] = await rows<{ base_price: number; price_type: string; is_published: number }>(
    `select base_price, price_type, is_published from services where id = ?`,
    [input.id],
  );
  if (!current) throw new ServiceRuleError("Услуга не найдена.", "not_found");

  const priceChanged =
    rublesToKopecks(input.basePrice) !== Number(current.base_price) || input.priceType !== current.price_type;
  if (priceChanged && (await countActiveServiceOrders(input.id)) > 0) {
    throw new ServiceRuleError("Цену услуги с активными заказами изменить нельзя.", "pricing_locked");
  }

  const changed = await run(
    `update services set title = ?, category = ?, short_desc = ?, full_desc = ?, base_price = ?,
       price_type = ?, is_orderable = ?, is_published = ?, is_active = ?, sort_order = ?, updated_at = ?
     where id = ?`,
    [
      input.title,
      input.category,
      input.shortDesc,
      input.fullDesc,
      rublesToKopecks(input.basePrice),
      input.priceType,
      // «По запросу» не заказывается напрямую — это правило тоже жило в CMS.
      input.priceType === "quote" ? 0 : 1,
      input.isPublished ? 1 : 0,
      input.isActive ? 1 : 0,
      input.sortOrder,
      new Date().toISOString(),
      input.id,
    ],
  );
  // Ноль изменений означает, что услугу удалили или id не совпал: молча
  // «сохранить» в этом случае нельзя — админка показала бы ложный успех.
  if (changed !== 1) throw new ServiceRuleError("Услуга не найдена.", "not_found");
}

export async function deleteService(serviceId: string): Promise<void> {
  if ((await countActiveServiceOrders(serviceId)) > 0) {
    throw new ServiceRuleError("Услугу с активными заказами нельзя удалить.", "orders_exist");
  }
  await run(`delete from services where id = ?`, [serviceId]);
}
