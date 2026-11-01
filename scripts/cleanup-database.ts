import { closePayloadClient, getPayloadClient } from "@/lib/payload-native";

const DEMO_POST_SLUGS = [
  "how-exterior-signage-shapes-first-impressions",
  "designing-large-format-billboards-that-read-in-three-seconds",
  "print-and-packaging-systems-for-events-and-retail",
];

async function main() {
  const payload = await getPayloadClient();
  console.log("Starting Payload database cleanup…");

  const testUsers = await payload.find({
    collection: "accounts",
    depth: 0,
    pagination: false,
    overrideAccess: true,
    select: {},
    where: {
      and: [
        { role: { not_equals: "FOUNDER" } },
        {
          or: [
            { email: { contains: "test" } },
            { email: { contains: "demo" } },
            { firstName: { equals: "Demo" } },
          ],
        },
      ],
    },
  });
  const testUserIds = testUsers.docs.map((user) => user.id);

  let deletedOrdersCount = 0;
  if (testUserIds.length > 0) {
    await payload.update({
      collection: "orders",
      data: { managerId: null },
      overrideAccess: true,
      where: { managerId: { in: testUserIds } },
    });
    const orders = await payload.find({
      collection: "orders",
      depth: 0,
      pagination: false,
      overrideAccess: true,
      where: { userId: { in: testUserIds } },
    });
    for (const order of orders.docs) {
      await payload.delete({ collection: "orders", id: order.id, overrideAccess: true });
      deletedOrdersCount += 1;
    }
    await payload.delete({
      collection: "activity-logs",
      overrideAccess: true,
      where: { actorId: { in: testUserIds } },
    });
  }
  console.log(`Deleted ${deletedOrdersCount} test/demo orders`);

  const posts = await payload.find({
    collection: "posts",
    depth: 0,
    pagination: false,
    overrideAccess: true,
    select: {},
    where: {
      or: [
        { title: { contains: "Test" } },
        { title: { contains: "Demo" } },
        { slug: { contains: "test" } },
        { slug: { contains: "demo" } },
        { slug: { in: DEMO_POST_SLUGS } },
      ],
    },
  });
  for (const post of posts.docs) {
    await payload.delete({ collection: "posts", id: post.id, overrideAccess: true });
  }
  console.log(`Deleted ${posts.docs.length} test/demo posts`);

  const services = await payload.find({
    collection: "services",
    depth: 0,
    pagination: false,
    overrideAccess: true,
    select: {},
    where: {
      or: [
        { title: { contains: "Test" } },
        { title: { contains: "Demo" } },
        { slug: { contains: "test" } },
        { slug: { contains: "demo" } },
      ],
    },
  });
  for (const service of services.docs) {
    await payload.delete({ collection: "services", id: service.id, overrideAccess: true });
  }
  console.log(`Deleted ${services.docs.length} test/demo services`);

  for (const id of testUserIds) {
    await payload.delete({ collection: "accounts", id, overrideAccess: true });
  }
  console.log(`Deleted ${testUserIds.length} test/demo users`);

  await payload.update({
    collection: "accounts",
    data: { firstName: "Studio", lastName: "Founder" },
    overrideAccess: true,
    where: { and: [{ role: { equals: "FOUNDER" } }, { firstName: { equals: "Demo" } }] },
  });
  console.log("Database cleanup completed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closePayloadClient);
