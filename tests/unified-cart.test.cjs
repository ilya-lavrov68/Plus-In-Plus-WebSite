const assert = require("node:assert/strict");
const { test, beforeEach } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) =>
  module._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        esModuleInterop: true,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    filename
  );

let currentUser = null;
let usersMap;
let servicesMap;
let productsMap;
let ordersMap;
let orderItemsMap;
let orderServicesList;
let activityLogs;
let seq;

function resetStore() {
  seq = 0;
  usersMap = new Map([
    [
      "usr-1",
      {
        id: "usr-1",
        email: "client@example.com",
        firstName: "Ivan",
        lastName: "Petrov",
        role: "USER",
        isBlocked: false,
      },
    ],
  ]);
  servicesMap = new Map([
    [
      "svc-sign",
      {
        id: "svc-sign",
        title: "Sign Design",
        slug: "sign-design",
        shortDesc: "Custom exterior signage",
        category: "small",
        coverImage: "/assets/shop/sign-design.jpg",
        basePrice: 500_000, // 5 000 ₽ in kopecks
        priceType: "from",
        currency: "RUB",
        isOrderable: true,
        isPublished: true,
        isActive: true,
      },
    ],
  ]);
  productsMap = new Map([
    [
      "prd-hoodie",
      {
        id: "prd-hoodie",
        name: "PIP Studio Hoodie",
        slug: "pip-studio-hoodie",
        description: "Heavyweight cotton hoodie",
        price: 4500, // 4 500 ₽
        coverImage: "/assets/shop/bag-design.jpg",
        category: "apparel",
        isActive: true,
        stock: 15,
      },
    ],
  ]);
  ordersMap = new Map();
  orderItemsMap = new Map();
  orderServicesList = [];
  activityLogs = [];
}

function itemsForOrder(orderId) {
  return [...orderItemsMap.values()]
    .filter((i) => i.orderId === orderId)
    .map((item) => ({
      ...structuredClone(item),
      service: item.serviceId
        ? structuredClone(servicesMap.get(item.serviceId) ?? null)
        : null,
      product: item.productId
        ? structuredClone(productsMap.get(item.productId) ?? null)
        : null,
    }));
}

const mockPrisma = {
  user: {
    findUnique: async ({ where }) =>
      structuredClone(usersMap.get(where.id) ?? null),
  },
  service: {
    findFirst: async ({ where }) => {
      const s = servicesMap.get(where.id);
      if (!s) return null;
      if (where.isActive !== undefined && s.isActive !== where.isActive) {
        return null;
      }
      return structuredClone(s);
    },
    findMany: async ({ where = {} } = {}) => {
      const ids = where.id?.in ?? null;
      return [...servicesMap.values()]
        .filter((s) => (!ids || ids.includes(s.id)) && (where.isActive === undefined || s.isActive === where.isActive))
        .map((s) => structuredClone(s));
    },
  },
  product: {
    findFirst: async ({ where }) => {
      const p = productsMap.get(where.id);
      if (!p) return null;
      if (where.isActive !== undefined && p.isActive !== where.isActive) {
        return null;
      }
      return structuredClone(p);
    },
    findMany: async ({ where = {} } = {}) => {
      const ids = where.id?.in ?? null;
      return [...productsMap.values()]
        .filter((p) => (!ids || ids.includes(p.id)) && (where.isActive === undefined || p.isActive === where.isActive))
        .map((p) => structuredClone(p));
    },
  },
  order: {
    findFirst: async ({ where = {}, include } = {}) => {
      const match = [...ordersMap.values()].find(
        (o) =>
          (!where.userId || o.userId === where.userId) &&
          (!where.status || o.status === where.status)
      );
      if (!match) return null;
      const copy = structuredClone(match);
      if (include?.items) copy.items = itemsForOrder(copy.id);
      return copy;
    },
    findMany: async ({ where = {} } = {}) => {
      return [...ordersMap.values()]
        .filter((o) => {
          if (where.userId && o.userId !== where.userId) return false;
          if (where.status?.not && o.status === where.status.not) return false;
          return true;
        })
        .map((o) => ({
          ...structuredClone(o),
          items: itemsForOrder(o.id),
          services: orderServicesList
            .filter((os) => os.orderId === o.id)
            .map((os) => ({
              ...structuredClone(os),
              service: structuredClone(servicesMap.get(os.serviceId)),
            })),
          payments: [],
        }));
    },
    create: async ({ data, include }) => {
      const id = `ord-${++seq}`;
      const now = new Date();
      const row = {
        id,
        orderNumber: data.orderNumber ?? null,
        number: data.number ?? null,
        userId: data.userId,
        cartKey: data.cartKey ?? null,
        status: data.status ?? "cart",
        estimatedAmount: data.estimatedAmount ?? 0,
        subtotal: 0,
        discount: 0,
        total: 0,
        currency: "RUB",
        deadline: data.deadline ?? null,
        description: data.description ?? null,
        finalPrice: null,
        customerNote: null,
        managerNote: null,
        isLocked: false,
        createdAt: now,
        updatedAt: now,
        paidAt: null,
      };
      ordersMap.set(id, row);
      const copy = structuredClone(row);
      if (include?.items) copy.items = [];
      return copy;
    },
    upsert: async ({ where, create, include }) => {
      const existing = [...ordersMap.values()].find((order) => order.cartKey === where.cartKey);
      if (existing) {
        const copy = structuredClone(existing);
        if (include?.items) copy.items = itemsForOrder(copy.id);
        return copy;
      }
      return mockPrisma.order.create({ data: create, include });
    },
    update: async ({ where, data }) => {
      const row = ordersMap.get(where.id);
      if (!row) throw new Error("Order not found");
      Object.assign(row, structuredClone(data), { updatedAt: new Date() });
      return structuredClone(row);
    },
    updateMany: async ({ where, data }) => {
      let count = 0;
      for (const row of ordersMap.values()) {
        if (where.id && row.id !== where.id) continue;
        if (where.status && row.status !== where.status) continue;
        Object.assign(row, structuredClone(data), { updatedAt: new Date() });
        count += 1;
      }
      return { count };
    },
    count: async ({ where = {} } = {}) => {
      return [...ordersMap.values()].filter((o) => {
        if (where.status?.not && o.status === where.status.not) return false;
        return true;
      }).length;
    },
  },
  orderItem: {
    findFirst: async ({ where }) => {
      const found = [...orderItemsMap.values()].find((i) => {
        if (where.id && i.id !== where.id) return false;
        if (where.orderId && i.orderId !== where.orderId) return false;
        if (where.itemType && i.itemType !== where.itemType) return false;
        if (where.itemId && i.itemId !== where.itemId) return false;
        if (where.optionsSnapshot !== undefined && i.optionsSnapshot !== where.optionsSnapshot) return false;
        return true;
      });
      return found ? structuredClone(found) : null;
    },
    findMany: async ({ where }) => {
      return [...orderItemsMap.values()]
        .filter((i) => i.orderId === where.orderId)
        .map((i) => structuredClone(i));
    },
    create: async ({ data }) => {
      const id = `oi-${++seq}`;
      const row = {
        id,
        orderId: data.orderId,
        itemType: data.itemType,
        itemId: data.itemId,
        serviceId: data.serviceId ?? null,
        productId: data.productId ?? null,
        title: data.title ?? "",
        quantity: data.quantity ?? 1,
        estimatedUnitPrice: data.estimatedUnitPrice ?? 0,
        unitPrice: 0,
        totalPrice: 0,
        optionsSnapshot: data.optionsSnapshot ?? "[]",
      };
      orderItemsMap.set(id, row);
      return structuredClone(row);
    },
    update: async ({ where, data }) => {
      const row = orderItemsMap.get(where.id);
      Object.assign(row, structuredClone(data));
      return structuredClone(row);
    },
    updateMany: async ({ where, data }) => {
      let count = 0;
      for (const row of orderItemsMap.values()) {
        if (
          (!where.orderId || row.orderId === where.orderId) &&
          (!where.itemId || row.itemId === where.itemId) &&
          (!where.itemType || row.itemType === where.itemType) &&
          (where.optionsSnapshot === undefined || row.optionsSnapshot === where.optionsSnapshot)
        ) {
          Object.assign(row, structuredClone(data));
          count += 1;
        }
      }
      return { count };
    },
    deleteMany: async ({ where }) => {
      let count = 0;
      for (const [id, row] of orderItemsMap.entries()) {
        if (
          (!where.id || row.id === where.id) &&
          (!where.orderId || row.orderId === where.orderId) &&
          (!where.itemId || row.itemId === where.itemId) &&
          (!where.itemType || row.itemType === where.itemType)
        ) {
          orderItemsMap.delete(id);
          count += 1;
        }
      }
      return { count };
    },
    aggregate: async ({ where }) => {
      const sum = [...orderItemsMap.values()]
        .filter((i) => i.orderId === where.orderId)
        .reduce((acc, i) => acc + i.quantity, 0);
      return { _sum: { quantity: sum } };
    },
  },
  orderService: {
    deleteMany: async ({ where }) => {
      orderServicesList = orderServicesList.filter(
        (os) => os.orderId !== where.orderId
      );
    },
    createMany: async ({ data }) => {
      for (const entry of data) {
        orderServicesList.push({ id: `os-${++seq}`, ...entry });
      }
    },
  },
  activityLog: {
    create: async ({ data }) => {
      activityLogs.push(data);
      return data;
    },
  },
};
mockPrisma.$transaction = async (cb) => cb(mockPrisma);

const originalLoad = Module._load;
Module._load = function (name, parent, isMain) {
  if (name === "@/lib/prisma") return { prisma: mockPrisma };
  if (name === "@/lib/auth-secret") return { isAuthConfigured: () => true };
  if (name === "@/auth") {
    return {
      auth: async () => (currentUser ? { user: currentUser } : null),
    };
  }
  if (name === "@/lib/request-locale") {
    return { getRequestLocale: async () => "en" };
  }
  if (name === "next/cache") {
    return { revalidatePath: () => {} };
  }
  if (name.startsWith("@/")) {
    name = path.resolve(__dirname, "..", name.slice(2));
  }
  return originalLoad.call(this, name, parent, isMain);
};

const cartGetRoute = require("../app/api/cart/route.ts");
const cartItemRoute = require("../app/api/cart/item/route.ts");
const cartCheckoutRoute = require("../app/api/cart/checkout/route.ts");
const cartCountRoute = require("../app/api/cart/count/route.ts");
const { getCustomerOrders } = require("../lib/customer-orders.ts");

beforeEach(() => {
  resetStore();
  currentUser = { id: "usr-1", email: "client@example.com", role: "USER" };
});

test("schema defines single Order model (status default cart), OrderItem.itemType, Product, and no duplicate CartItem model", () => {
  const schema = fs.readFileSync(
    path.join(__dirname, "..", "prisma", "schema.prisma"),
    "utf8"
  );
  assert.doesNotMatch(schema, /model\s+CartItem\b/);
  assert.match(schema, /model\s+Product\s*\{/);
  assert.match(schema, /status\s+String\s+@default\("cart"\)/);
  assert.match(schema, /orderNumber\s+String\?\s+@unique/);
  assert.match(schema, /cartKey\s+String\?\s+@unique/);
  assert.match(schema, /itemType\s+String/);
  assert.match(schema, /itemId\s+String/);

  // /profile source has zero orders display or /orders links
  const profileFormSrc = fs.readFileSync(
    path.join(__dirname, "..", "components", "site", "profile-form.tsx"),
    "utf8"
  );
  assert.doesNotMatch(profileFormSrc, /\/orders/);
});

test("unified cart stores both services and products in one Order (status='cart') and checks out to status='pending'", async () => {
  // Unauthenticated access rejected
  currentUser = null;
  const unauthRes = await cartGetRoute.GET();
  assert.equal(unauthRes.status, 401);

  currentUser = { id: "usr-1", email: "client@example.com", role: "USER" };

  // Add a service (5 000 ₽)
  const addSvcRes = await cartItemRoute.POST(
    new Request("http://localhost/api/cart/item", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemType: "service",
        itemId: "svc-sign",
        quantity: 1,
      }),
    })
  );
  assert.equal(addSvcRes.status, 200);

  // Add a product (4 500 ₽ × 2)
  const addPrdRes = await cartItemRoute.POST(
    new Request("http://localhost/api/cart/item", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemType: "product",
        itemId: "prd-hoodie",
        quantity: 2,
      }),
    })
  );
  assert.equal(addPrdRes.status, 200);

  // Only ONE Order row exists in DB and its status is 'cart'
  assert.equal(ordersMap.size, 1);
  const draftCart = [...ordersMap.values()][0];
  assert.equal(draftCart.status, "cart");
  assert.equal(draftCart.cartKey, "usr-1");
  assert.equal(draftCart.orderNumber, null);

  // While status='cart', /orders (getCustomerOrders) returns 0 orders!
  const beforeCheckoutOrders = await getCustomerOrders();
  assert.equal(beforeCheckoutOrders.length, 0);

  // GET /api/cart returns both service and product enriched in rubles
  const getCartRes = await cartGetRoute.GET();
  assert.equal(getCartRes.status, 200);
  const cartPayload = await getCartRes.json();
  assert.equal(cartPayload.items.length, 2);
  assert.equal(cartPayload.count, 3);

  const svcLine = cartPayload.items.find((i) => i.itemType === "service");
  const prdLine = cartPayload.items.find((i) => i.itemType === "product");
  assert.equal(svcLine.name, "Sign Design");
  assert.equal(svcLine.price, 5000);
  assert.equal(prdLine.name, "PIP Studio Hoodie");
  assert.equal(prdLine.price, 4500);
  assert.equal(prdLine.quantity, 2);
  assert.equal(svcLine.unavailable, false);
  assert.equal(svcLine.maxQuantity, 99);
  assert.equal(prdLine.unavailable, false);
  assert.equal(prdLine.maxQuantity, 15);

  // Header badge count endpoint returns 3
  const countBefore = await (await cartCountRoute.GET()).json();
  assert.equal(countBefore.count, 3);

  // Checkout transitions the SAME Order row to status='pending' with ПИП-000001
  const futureDate = new Date(Date.now() + 7 * 86_400_000)
    .toISOString()
    .split("T")[0];
  const checkoutRes = await cartCheckoutRoute.POST(
    new Request("http://localhost/api/cart/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deadline: futureDate,
        description: "Storefront sign + 2 studio hoodies",
      }),
    })
  );
  assert.equal(checkoutRes.status, 200);
  const checkoutData = await checkoutRes.json();
  assert.equal(checkoutData.success, true);
  assert.equal(checkoutData.orderNumber, "ПИП-000001");

  // Still only 1 Order row — transitioned in place to status='pending'!
  assert.equal(ordersMap.size, 1);
  assert.equal(ordersMap.get(draftCart.id).status, "pending");
  assert.equal(ordersMap.get(draftCart.id).cartKey, null);
  assert.equal(ordersMap.get(draftCart.id).orderNumber, "ПИП-000001");

  // Header cart count is now 0
  const countAfter = await (await cartCountRoute.GET()).json();
  assert.equal(countAfter.count, 0);

  // /orders (getCustomerOrders) now returns the submitted order with both items!
  const submittedOrders = await getCustomerOrders();
  assert.equal(submittedOrders.length, 1);
  assert.equal(submittedOrders[0].orderNumber, "ПИП-000001");
  assert.equal(submittedOrders[0].status, "pending");
  assert.equal(submittedOrders[0].items.length, 2);
});

test("concurrent first cart writes converge on one cart and checkout releases its unique key", async () => {
  const [serviceResponse, productResponse] = await Promise.all([
    cartItemRoute.POST(new Request("http://localhost/api/cart/item", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemType: "service", itemId: "svc-sign", quantity: 1 }),
    })),
    cartItemRoute.POST(new Request("http://localhost/api/cart/item", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemType: "product", itemId: "prd-hoodie", quantity: 1 }),
    })),
  ]);
  assert.equal(serviceResponse.status, 200);
  assert.equal(productResponse.status, 200);
  assert.equal(ordersMap.size, 1);
  const firstCart = [...ordersMap.values()][0];
  assert.equal(firstCart.cartKey, "usr-1");

  const checkout = await cartCheckoutRoute.POST(new Request("http://localhost/api/cart/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  }));
  assert.equal(checkout.status, 200);
  assert.equal(ordersMap.get(firstCart.id).cartKey, null);

  const nextCart = await cartGetRoute.GET();
  assert.equal(nextCart.status, 200);
  assert.equal(ordersMap.size, 2);
  const activeCarts = [...ordersMap.values()].filter((order) => order.status === "cart");
  assert.equal(activeCarts.length, 1);
  assert.equal(activeCarts[0].cartKey, "usr-1");
  assert.notEqual(activeCarts[0].id, firstCart.id);
});

test("configured service lines keep immutable identities for independent update and delete", async () => {
  servicesMap.get("svc-sign").optionGroups = [{
    id: "group-finish",
    serviceId: "svc-sign",
    name: "Finish",
    required: false,
    sortOrder: 0,
    options: [
      { id: "option-matte", groupId: "group-finish", label: "Matte", priceDelta: 0, priceFactor: 1, isDefault: true, sortOrder: 0 },
      { id: "option-gloss", groupId: "group-finish", label: "Gloss", priceDelta: 10_000, priceFactor: 1, isDefault: false, sortOrder: 1 },
    ],
  }];
  for (const optionIds of [["option-matte"], ["option-gloss"]]) {
    const response = await cartItemRoute.POST(new Request("http://localhost/api/cart/item", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemType: "service", itemId: "svc-sign", optionIds }),
    }));
    assert.equal(response.status, 200, JSON.stringify(await response.json()));
  }
  assert.equal(orderItemsMap.size, 2, "different configurations are separate rows");
  const payload = await (await cartGetRoute.GET()).json();
  const [first, second] = payload.items;
  assert.notEqual(first.id, second.id);
  const update = await cartItemRoute.PATCH(new Request("http://localhost/api/cart/item", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: first.id, quantity: 3 }),
  }));
  assert.equal(update.status, 200);
  assert.equal(orderItemsMap.get(first.id).quantity, 3);
  assert.equal(orderItemsMap.get(second.id).quantity, 1);
  const remove = await cartItemRoute.DELETE(new Request("http://localhost/api/cart/item", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: second.id }),
  }));
  assert.equal(remove.status, 200);
  assert.equal(orderItemsMap.has(first.id), true);
  assert.equal(orderItemsMap.has(second.id), false);
});

test("direct cart mutations reject unavailable services and excess product stock", async () => {
  servicesMap.get("svc-sign").isPublished = false;
  const unavailable = await cartItemRoute.POST(new Request("http://localhost/api/cart/item", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ itemType: "service", itemId: "svc-sign" }),
  }));
  assert.equal(unavailable.status, 400);
  servicesMap.get("svc-sign").isPublished = true;
  servicesMap.get("svc-sign").isOrderable = false;
  const quoteOnly = await cartItemRoute.POST(new Request("http://localhost/api/cart/item", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ itemType: "service", itemId: "svc-sign" }),
  }));
  assert.equal(quoteOnly.status, 400);
  const excessStock = await cartItemRoute.POST(new Request("http://localhost/api/cart/item", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ itemType: "product", itemId: "prd-hoodie", quantity: 16 }),
  }));
  assert.equal(excessStock.status, 400);
  assert.equal(orderItemsMap.size, 0);
});

test("existing cart lines expose stale catalog eligibility and cannot be checked out", async () => {
  await cartItemRoute.POST(new Request("http://localhost/api/cart/item", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ itemType: "service", itemId: "svc-sign" }),
  }));
  servicesMap.get("svc-sign").isPublished = false;
  const payload = await (await cartGetRoute.GET()).json();
  assert.equal(payload.items[0].unavailable, true);
  const checkout = await cartCheckoutRoute.POST(new Request("http://localhost/api/cart/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  }));
  assert.equal(checkout.status, 400);
  assert.equal([...ordersMap.values()][0].status, "cart");
});

test("DELETE /api/cart/item removes individual item and checkout rejects empty cart", async () => {
  await cartItemRoute.POST(
    new Request("http://localhost/api/cart/item", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemType: "service", itemId: "svc-sign" }),
    })
  );

  const cartPayload = await (await cartGetRoute.GET()).json();
  const line = cartPayload.items.find((item) => item.itemId === "svc-sign");
  assert.ok(line?.id, "the API exposes the immutable order-item id");
  const delRes = await cartItemRoute.DELETE(
    new Request("http://localhost/api/cart/item", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: line.id }),
    })
  );
  assert.equal(delRes.status, 200);

  const emptyCheckout = await cartCheckoutRoute.POST(
    new Request("http://localhost/api/cart/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
  );
  assert.equal(emptyCheckout.status, 400);
});
