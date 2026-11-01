import { closePayloadClient, getPayloadClient, payloadId, withPayloadTransaction } from "@/lib/payload-native";

async function main() {
  const payload = await getPayloadClient();
  const suffix = Date.now().toString(36);
  const user = await payload.create({
    collection: "accounts",
    data: { email: `smoke-${suffix}@example.test`, passwordHash: "not-a-real-password", role: "USER" },
    overrideAccess: true,
  });
  const service = await payload.create({
    collection: "services",
    data: {
      title: `Smoke ${suffix}`,
      slug: `smoke-${suffix}`,
      category: "small",
      shortDesc: "Smoke",
      fullDesc: "Smoke service",
      includes: [{ value: "One" }],
      shapes: [{ value: "Layout" }],
      resultText: "Ready",
      basePrice: 10000,
      priceType: "from",
      currency: "RUB",
      isOrderable: true,
      isPublished: true,
      isActive: true,
      sortOrder: 0,
      optionGroups: [{
        name: "Size",
        required: true,
        sortOrder: 0,
        options: [{ label: "A", priceDelta: 100, priceFactor: 1, isDefault: true, sortOrder: 0 }],
      }],
    },
    overrideAccess: true,
  });
  const loadedServiceResult = await payload.find({
    collection: "services",
    depth: 2,
    limit: 1,
    overrideAccess: true,
    where: { id: { equals: service.id } },
  });
  const loadedService = loadedServiceResult.docs[0];
  if (!loadedService?.optionGroups?.[0]?.options?.length) {
    throw new Error("nested service options were not loaded");
  }

  const order = await withPayloadTransaction(payload, async (req) => {
    const created = await payload.create({
      collection: "orders",
      data: {
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
      depth: 0,
      overrideAccess: true,
      req,
    });
    await payload.create({
      collection: "order-services",
      data: { orderId: created.id, serviceId: service.id, quantity: 1 },
      overrideAccess: true,
      req,
    });
    await payload.create({
      collection: "order-items",
      data: {
        orderId: created.id,
        itemType: "service",
        itemId: service.id,
        serviceId: service.id,
        title: service.title,
        quantity: 1,
        estimatedUnitPrice: 10000,
        unitPrice: 0,
        totalPrice: 0,
        optionsSnapshot: "[]",
      },
      overrideAccess: true,
      req,
    });
    return created;
  });

  const [items, services, loadedOrder] = await Promise.all([
    payload.find({ collection: "order-items", depth: 0, pagination: false, overrideAccess: true, where: { orderId: { equals: order.id } } }),
    payload.find({ collection: "order-services", depth: 0, pagination: false, overrideAccess: true, where: { orderId: { equals: order.id } } }),
    payload.find({ collection: "orders", depth: 0, limit: 1, overrideAccess: true, where: { id: { equals: order.id } } }),
  ]);
  if (
    items.docs.length !== 1 ||
    services.docs.length !== 1 ||
    payloadId(loadedOrder.docs[0]?.userId) !== user.id
  ) {
    throw new Error("order relations were not loaded");
  }

  await payload.delete({ collection: "orders", id: order.id, overrideAccess: true });
  await payload.delete({ collection: "services", id: service.id, overrideAccess: true });
  await payload.delete({ collection: "accounts", id: user.id, overrideAccess: true });
  console.log(JSON.stringify({
    ok: true,
    serviceOptions: loadedService.optionGroups[0].options.length,
    orderItems: items.docs.length,
  }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closePayloadClient);
