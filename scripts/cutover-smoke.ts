import { db } from "@/lib/payload-db";

async function main() {
  if (!db) throw new Error("db unavailable");
  const suffix = Date.now().toString(36);
  const user = await db.user.create({ data: { email: `smoke-${suffix}@example.test`, passwordHash: "not-a-real-password", role: "USER" } });
  const service = await db.service.create({
    data: {
      title: `Smoke ${suffix}`,
      slug: `smoke-${suffix}`,
      category: "small",
      shortDesc: "Smoke",
      fullDesc: "Smoke service",
      includes: JSON.stringify(["One"]),
      shapes: JSON.stringify(["Layout"]),
      resultText: "Ready",
      basePrice: 10000,
      priceType: "from",
      currency: "RUB",
      isOrderable: true,
      isPublished: true,
      isActive: true,
      optionGroups: [
        { name: "Size", required: true, sortOrder: 0, options: [{ label: "A", priceDelta: 100, priceFactor: 1, sortOrder: 0 }] },
      ],
    },
  });
  const loadedService = await db.service.findUnique({ where: { id: service.id }, include: { optionGroups: { include: { options: true } } } });
  if (!loadedService?.optionGroups?.[0]?.options?.length) throw new Error("nested service options were not loaded");
  const order = await db.order.create({
    data: {
      orderNumber: `SMOKE-${suffix}`,
      number: `SMOKE-${suffix}`,
      userId: user.id,
      status: "quote_requested",
      estimatedAmount: 10000,
      currency: "RUB",
      services: { create: { serviceId: service.id, quantity: 1 } },
      items: { create: { itemType: "service", itemId: service.id, serviceId: service.id, title: service.title, quantity: 1, estimatedUnitPrice: 10000, optionsSnapshot: "[]" } },
    },
  });
  const loadedOrder = await db.order.findUnique({ where: { id: order.id }, include: { items: true, services: true, user: true } });
  if (!loadedOrder || loadedOrder.items.length !== 1 || loadedOrder.services.length !== 1 || loadedOrder.user.id !== user.id) throw new Error("order relations were not loaded");
  await db.order.delete({ where: { id: order.id } });
  await db.service.delete({ where: { id: service.id } });
  await db.user.delete({ where: { id: user.id } });
  console.log(JSON.stringify({ ok: true, serviceOptions: loadedService.optionGroups[0].options.length, orderItems: loadedOrder.items.length }));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { await db?.close(); });
