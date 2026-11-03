import { randomUUID } from "node:crypto";

import { createAccount } from "@/lib/accounts";
import {
  findOrderById,
  insertOrder,
  insertOrderItem,
  listOrderItems,
  listOrderServicesForOrders,
  replaceOrderServices,
} from "@/lib/commerce-data";
import { findServiceById } from "@/lib/data";
import { closeDb, run, withTransaction } from "@/lib/db";

/**
 * Дымовой тест после отказа от CMS: проверяет, что вложенные опции услуги и
 * связи заказа читаются из SQL так же, как раньше из Payload. Всё созданное
 * удаляется в конце, база остаётся чистой.
 */
async function main() {
  const suffix = Date.now().toString(36);
  const user = await createAccount({ email: `smoke-${suffix}@example.test`, passwordHash: "not-a-real-password" });
  const serviceId = `svc-smoke-${suffix}`;
  const groupId = randomUUID();
  const now = new Date().toISOString();

  try {
    await withTransaction(async (tx) => {
      await tx.run(
        `insert into services (id, title, slug, category, short_desc, full_desc, result_text, base_price,
           price_type, currency, is_orderable, is_published, is_active, sort_order, created_at, updated_at)
         values (?, ?, ?, 'small', 'Smoke', 'Smoke service', 'Ready', 10000, 'from', 'RUB', 1, 1, 1, 0, ?, ?)`,
        [serviceId, `Smoke ${suffix}`, `smoke-${suffix}`, now, now],
      );
      await tx.run(`insert into services_includes (_order, _parent_id, id, value) values (0, ?, ?, 'One')`, [serviceId, randomUUID()]);
      await tx.run(`insert into services_shapes (_order, _parent_id, id, value) values (0, ?, ?, 'Layout')`, [serviceId, randomUUID()]);
      await tx.run(
        `insert into services_option_groups (_order, _parent_id, id, name, required, sort_order) values (0, ?, ?, 'Size', 1, 0)`,
        [serviceId, groupId],
      );
      await tx.run(
        `insert into services_option_groups_options (_order, _parent_id, id, label, price_delta, price_factor, is_default, sort_order)
         values (0, ?, ?, 'A', 100, 1, 1, 0)`,
        [groupId, randomUUID()],
      );
    });

    const service = await findServiceById(serviceId, { withOptions: true });
    if (!service?.optionGroups?.[0]?.options?.length) {
      throw new Error("nested service options were not loaded");
    }

    const order = await withTransaction(async (tx) => {
      const created = await insertOrder(
        {
          orderNumber: `SMOKE-${suffix}`,
          number: `SMOKE-${suffix}`,
          userId: user.id,
          status: "quote_requested",
          estimatedAmount: 10000,
          subtotal: 0,
          discount: 0,
          total: 0,
          currency: "RUB",
        },
        tx,
      );
      await replaceOrderServices(created.id, [{ serviceId, quantity: 1 }], tx);
      await insertOrderItem(
        {
          orderId: created.id,
          itemType: "service",
          itemId: serviceId,
          serviceId,
          title: service.title,
          quantity: 1,
          estimatedUnitPrice: 10000,
          optionsSnapshot: "[]",
        },
        tx,
      );
      return created;
    });

    const [items, links, loadedOrder] = await Promise.all([
      listOrderItems(order.id),
      listOrderServicesForOrders([order.id]),
      findOrderById(order.id),
    ]);
    if (items.length !== 1 || links.length !== 1 || loadedOrder?.userId !== user.id) {
      throw new Error("order relations were not loaded");
    }

    console.log(JSON.stringify({
      ok: true,
      serviceOptions: service.optionGroups[0].options.length,
      orderItems: items.length,
    }));
  } finally {
    // Порядок важен: заказ ссылается на услугу и аккаунт.
    await run(`delete from orders where user_id_id = ?`, [user.id]);
    await run(`delete from services where id = ?`, [serviceId]);
    await run(`delete from accounts where id = ?`, [user.id]);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closeDb);
