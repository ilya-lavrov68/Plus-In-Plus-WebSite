import { closeDb, rows, run, withTransaction } from "@/lib/db";

const DEMO_POST_SLUGS = [
  "how-exterior-signage-shapes-first-impressions",
  "designing-large-format-billboards-that-read-in-three-seconds",
  "print-and-packaging-systems-for-events-and-retail",
];

function placeholders(count: number): string {
  return Array.from({ length: count }, () => "?").join(", ");
}

async function main() {
  console.log("Starting database cleanup…");

  // Тестовые аккаунты: всё, что похоже на demo/test, кроме основателя.
  const testUsers = await rows<{ id: string }>(
    `select id from accounts
     where role <> 'FOUNDER'
       and (email like '%test%' or email like '%demo%' or first_name = 'Demo')`,
  );
  const testUserIds = testUsers.map((user) => user.id);

  let deletedOrdersCount = 0;
  if (testUserIds.length > 0) {
    const list = placeholders(testUserIds.length);
    await run(`update orders set manager_id_id = null where manager_id_id in (${list})`, testUserIds);
    const orders = await rows<{ id: string }>(`select id from orders where user_id_id in (${list})`, testUserIds);
    deletedOrdersCount = orders.length;
    await withTransaction(async (tx) => {
      // Позиции, связи и счета удаляются каскадом; рукой чистим только то,
      // что каскадом не покрыто.
      for (const order of orders) await tx.run(`delete from orders where id = ?`, [order.id]);
      await tx.run(`delete from activity_logs where actor_id_id in (${list})`, testUserIds);
    });
  }
  console.log(`Deleted ${deletedOrdersCount} test/demo orders`);

  const posts = await rows<{ id: string }>(
    `select id from posts
     where title like '%Test%' or title like '%Demo%'
        or slug like '%test%' or slug like '%demo%'
        or slug in (${placeholders(DEMO_POST_SLUGS.length)})`,
    DEMO_POST_SLUGS,
  );
  for (const post of posts) await run(`delete from posts where id = ?`, [post.id]);
  console.log(`Deleted ${posts.length} test/demo posts`);

  const services = await rows<{ id: string }>(
    `select id from services
     where title like '%Test%' or title like '%Demo%'
        or slug like '%test%' or slug like '%demo%'`,
  );
  for (const service of services) await run(`delete from services where id = ?`, [service.id]);
  console.log(`Deleted ${services.length} test/demo services`);

  // Аккаунты удаляются последними: на них ссылаются сессии и журнал.
  for (const id of testUserIds) await run(`delete from accounts where id = ?`, [id]);
  console.log(`Deleted ${testUserIds.length} test/demo users`);

  await run(
    `update accounts set first_name = ?, last_name = ?, updated_at = ?
     where role = 'FOUNDER' and first_name = 'Demo'`,
    ["Studio", "Founder", new Date().toISOString()],
  );
  console.log("Database cleanup completed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closeDb);
