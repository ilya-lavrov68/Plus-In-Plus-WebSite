import { db } from "@/lib/payload-db";

const DEMO_POST_SLUGS = [
  "how-exterior-signage-shapes-first-impressions",
  "designing-large-format-billboards-that-read-in-three-seconds",
  "print-and-packaging-systems-for-events-and-retail",
];

async function main() {
  if (!db) {
    throw new Error(
      "Database client is not configured. Run `npm run payload:migrate` first."
    );
  }

  console.log("Starting Payload database cleanup…");

  // 1. Find test/demo users (all non-FOUNDER accounts with test/demo emails or Demo names)
  const testUsers = await db.user.findMany({
    where: {
      AND: [
        { role: { not: "FOUNDER" } },
        {
          OR: [
            { email: { contains: "test" } },
            { email: { contains: "demo" } },
            { firstName: "Demo" },
          ],
        },
      ],
    },
    select: { id: true, email: true },
  });
  const testUserIds = testUsers.map((u) => u.id);

  // Clean up test/demo orders (including draft carts) and logs tied to test users first
  let deletedOrdersCount = 0;
  if (testUserIds.length > 0) {
    // Detach managerId references from test staff before deleting orders/users
    await db.order.updateMany({
      where: { managerId: { in: testUserIds } },
      data: { managerId: null },
    });
    const deletedOrders = await db.order.deleteMany({
      where: { userId: { in: testUserIds } },
    });
    deletedOrdersCount = deletedOrders.count;
    await db.activityLog.deleteMany({
      where: { actorId: { in: testUserIds } },
    });
  }
  console.log(`Deleted ${deletedOrdersCount} test/demo orders`);

  // 2. Delete test/demo posts
  const deletedPosts = await db.post.deleteMany({
    where: {
      OR: [
        { title: { contains: "Test" } },
        { title: { contains: "Demo" } },
        { slug: { contains: "test" } },
        { slug: { contains: "demo" } },
        { slug: { in: DEMO_POST_SLUGS } },
      ],
    },
  });
  console.log(`Deleted ${deletedPosts.count} test/demo posts`);

  // 3. Delete test/demo services
  const deletedServices = await db.service.deleteMany({
    where: {
      OR: [
        { title: { contains: "Test" } },
        { title: { contains: "Demo" } },
        { slug: { contains: "test" } },
        { slug: { contains: "demo" } },
      ],
    },
  });
  console.log(`Deleted ${deletedServices.count} test/demo services`);

  // 4. Delete test/demo users (preserving FOUNDER)
  const deletedUsers =
    testUserIds.length > 0
      ? await db.user.deleteMany({
          where: { id: { in: testUserIds } },
        })
      : { count: 0 };
  console.log(`Deleted ${deletedUsers.count} test/demo users`);

  // Normalize FOUNDER display name if it was left as "Demo" by an old seed
  await db.user.updateMany({
    where: { role: "FOUNDER", firstName: "Demo" },
    data: { firstName: "Studio", lastName: "Founder" },
  });

  console.log("Database cleanup completed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db?.close();
  });
