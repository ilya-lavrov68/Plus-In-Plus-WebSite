import { APIError, type CollectionAfterChangeHook, type CollectionAfterReadHook, type CollectionBeforeChangeHook, type CollectionBeforeDeleteHook, type GlobalAfterChangeHook, type PayloadRequest } from "payload";

import { payloadRole } from "./access.ts";

const CLOSED_ORDER_STATUSES = new Set(["paid", "in_progress", "completed", "cancelled", "refunded"]);
const ORDER_TRANSITIONS: Record<string, readonly string[]> = {
  pending: ["quote_requested", "negotiating", "cancelled"],
  quote_requested: ["negotiating", "cancelled"],
  negotiating: ["quote_requested", "cancelled"],
  priced: ["awaiting_payment", "negotiating", "cancelled"],
  awaiting_payment: ["negotiating", "cancelled"],
  paid: ["in_progress"],
  in_progress: ["completed"],
  completed: [],
  cancelled: [],
  refunded: [],
};

function changed(data: Record<string, unknown>, original: Record<string, unknown>, key: string): boolean {
  return data[key] !== undefined && data[key] !== original[key];
}

export const protectAccount: CollectionBeforeChangeHook = async ({ data, operation, originalDoc, req }) => {
  if (operation !== "update" || !req.user || !originalDoc) return data;
  const original = originalDoc as Record<string, unknown>;
  const next = data as Record<string, unknown>;
  const actorId = String(req.user.id);
  const targetId = String(originalDoc.id);

  if (original.role === "FOUNDER" && (changed(next, original, "role") || next.isBlocked === true)) {
    throw new APIError("Роль и блокировка основателя изменяются только серверным runbook.", 403);
  }
  if (next.role === "FOUNDER" && original.role !== "FOUNDER") {
    throw new APIError("Роль FOUNDER назначается только через серверный runbook.", 403);
  }
  if (actorId === targetId && next.isBlocked === true) {
    throw new APIError("Нельзя заблокировать собственный аккаунт.", 400);
  }
  if (actorId === targetId && next.role && next.role !== original.role) {
    throw new APIError("Нельзя изменить собственную staff-роль.", 400);
  }
  return data;
};

export const revokeAccountSessions: CollectionAfterChangeHook = async ({ doc, operation, previousDoc, req }) => {
  if (operation !== "update" || !previousDoc) return doc;
  const securityChanged =
    doc.role !== previousDoc.role ||
    doc.isBlocked !== previousDoc.isBlocked ||
    doc.passwordHash !== previousDoc.passwordHash;
  if (!securityChanged) return doc;

  await req.payload.update({
    collection: "auth-sessions",
    data: {
      revokedAt: new Date().toISOString(),
      revokeReason: doc.isBlocked ? "account_blocked" : "account_security_changed",
    },
    overrideAccess: true,
    req,
    where: {
      and: [
        { userId: { equals: doc.id } },
        { revokedAt: { exists: false } },
      ],
    },
  });
  return doc;
};

/** Keep uploaded media on the existing safe, immutable public file route. */
export const mediaPublicUrl: CollectionAfterReadHook = ({ doc }) => {
  if (typeof doc.filename === "string" && doc.filename) {
    doc.url = `/uploads/media/${doc.filename}`;
  }
  return doc;
};

export const preparePost: CollectionBeforeChangeHook = ({ data }) => {
  if (data.isPublished && !data.publishedAt) data.publishedAt = new Date().toISOString();
  return data;
};

export const syncFeaturedPost: CollectionAfterChangeHook = async ({ doc, req }) => {
  if (!doc.isFeatured || req.context.skipFeaturedSync) return doc;
  if (!doc.isPublished || (doc.publishedAt && new Date(doc.publishedAt).getTime() > Date.now())) {
    throw new APIError("В избранное можно добавить только опубликованный материал.", 400);
  }
  await req.payload.update({
    collection: "posts",
    context: { skipFeaturedSync: true },
    data: { isFeatured: false },
    overrideAccess: true,
    req,
    where: {
      and: [
        { id: { not_equals: doc.id } },
        { isFeatured: { equals: true } },
      ],
    },
  });
  return doc;
};

export const prepareOrder: CollectionBeforeChangeHook = async ({ data, operation, originalDoc, req }) => {
  if (operation !== "update" || !originalDoc) return data;
  const original = originalDoc as Record<string, unknown>;
  const next = data as Record<string, unknown>;
  const originalStatus = String(original.status ?? "");
  const originalId = String(original.id);
  const role = payloadRole(req);
  // Native customer workflows intentionally have no req.user; staff requests do,
  // and must never turn the shared cart document into an editable admin record.
  if (original.status === "cart" && req.user) throw new APIError("Корзина редактируется только клиентским сценарием.", 400);
  if (!req.user) return data;
  if (original.isLocked && role !== "FOUNDER" && next.isLocked !== false) {
    throw new APIError("Заблокированный заказ может изменить только основатель.", 403);
  }

  if (changed(next, original, "isLocked")) {
    if (next.isLocked === false && role !== "FOUNDER") {
      throw new APIError("Снять блокировку может только основатель.", 403);
    }
    next.lockedAt = next.isLocked ? new Date().toISOString() : null;
    next.lockedById = next.isLocked ? req.user.id : null;
  }

  const nextStatus = next.status as string | undefined;
  if (nextStatus && nextStatus !== originalStatus) {
    if (nextStatus === "paid") throw new APIError("Оплату подтверждает только webhook Robokassa.", 400);
    if (!ORDER_TRANSITIONS[originalStatus]?.includes(nextStatus)) {
      throw new APIError(`Недопустимый переход ${originalStatus} → ${nextStatus}.`, 400);
    }
    if (nextStatus === "in_progress" || nextStatus === "completed") {
      const paid = await req.payload.count({
        collection: "payments",
        overrideAccess: true,
        req,
        where: { and: [{ orderId: { equals: original.id } }, { status: { equals: "succeeded" } }] },
      });
      if (paid.totalDocs === 0) throw new APIError("Для работы по заказу нужен успешный платёж.", 400);
    }
  }

  if (changed(next, original, "finalPrice")) {
    if (CLOSED_ORDER_STATUSES.has(originalStatus)) throw new APIError("Цена закрытого заказа неизменна.", 400);
    const rubles = Number(next.finalPrice);
    if (!Number.isFinite(rubles) || rubles < 0 || rubles > 100_000_000) {
      throw new APIError("Укажите цену от 0 до 100 000 000 ₽.", 400);
    }
    const paid = await req.payload.count({
      collection: "payments",
      overrideAccess: true,
      req,
      where: { and: [{ orderId: { equals: original.id } }, { status: { equals: "succeeded" } }] },
    });
    if (paid.totalDocs > 0) throw new APIError("После успешного платежа цена неизменна.", 400);
    const total = Math.round(rubles * 100);
    next.total = total;
    next.subtotal = total;
    next.status = "awaiting_payment";
    next.managerId = req.user.id;
    next.priceAgreedAt = new Date().toISOString();
    req.context.distributeOrderPrice = { orderId: originalId, total };
  }
  return data;
};

export const distributeOrderPrice: CollectionAfterChangeHook = async ({ doc, req }) => {
  const pending = req.context.distributeOrderPrice as { orderId: string; total: number } | undefined;
  if (!pending || pending.orderId !== doc.id) return doc;
  delete req.context.distributeOrderPrice;

  const items = await req.payload.find({
    collection: "order-items",
    depth: 0,
    overrideAccess: true,
    pagination: false,
    req,
    where: { orderId: { equals: doc.id } },
  });
  const estimatedTotal = items.docs.reduce(
    (sum, item) => sum + Number(item.estimatedUnitPrice || 0) * Number(item.quantity || 0),
    0,
  );
  let allocated = 0;
  for (const [index, item] of items.docs.entries()) {
    const share = estimatedTotal
      ? (Number(item.estimatedUnitPrice || 0) * Number(item.quantity || 0)) / estimatedTotal
      : 1 / Math.max(1, items.docs.length);
    // Последняя позиция получает остаток, чтобы округление не меняло сумму заказа.
    const itemTotal = index === items.docs.length - 1 ? pending.total - allocated : Math.round(pending.total * share);
    allocated += itemTotal;
    await req.payload.update({
      id: item.id,
      collection: "order-items",
      data: {
        unitPrice: item.quantity ? Math.round(itemTotal / Number(item.quantity)) : itemTotal,
        totalPrice: itemTotal,
      },
      overrideAccess: true,
      req,
    });
  }

  // Динамический import не создаёт цикл payload.config → hooks → payload-native.
  const { issueInvoice } = await import("@/lib/payments/invoice");
  const invoice = await issueInvoice({
    orderId: String(doc.id),
    orderNumber: String(doc.orderNumber ?? doc.number ?? doc.id),
    amount: pending.total,
    currency: String(doc.currency ?? "RUB"),
    customerEmail: doc.userId && typeof doc.userId === "object" ? doc.userId.email ?? null : null,
  }, req.payload, req);
  if (!invoice) throw new APIError("Счёт не выставлен: проверьте успешные платежи по заказу.", 409);
  return doc;
};

export function activityAfterChange(entityType: "service" | "post" | "user" | "setting" | "order" | "media", titleField = "id"): CollectionAfterChangeHook {
  return async ({ doc, operation, req }) => {
    if (!req.user) return doc;
    await req.payload.create({
      collection: "activity-logs",
      data: {
        action: operation === "create" ? "created" : "updated",
        entityType,
        entityId: String(doc.id),
        title: String(doc[titleField] ?? doc.number ?? doc.orderNumber ?? doc.email ?? doc.id),
        actorId: req.user.id,
      },
      overrideAccess: true,
      req,
    });
    return doc;
  };
}

export const activityAfterStoryChange: GlobalAfterChangeHook = async ({ doc, req }) => {
  if (!req.user) return doc;
  await req.payload.create({
    collection: "activity-logs",
    data: {
      action: "updated",
      entityType: "setting",
      entityId: "story",
      title: String(doc.heading || "Landing story"),
      actorId: req.user.id,
    },
    overrideAccess: true,
    req,
  });
  return doc;
};

export const prepareService: CollectionBeforeChangeHook = ({ data }) => {
  if (data.priceType === "quote") data.isOrderable = false;
  return data;
};

async function countActiveServiceOrders(id: string | number, req: PayloadRequest): Promise<number> {
  const activeStatuses = ["pending", "quote_requested", "negotiating", "priced", "awaiting_payment", "paid", "in_progress"];
  const [legacy, unified] = await Promise.all([
    req.payload.find({
      collection: "order-services",
      depth: 0,
      overrideAccess: true,
      pagination: false,
      req,
      select: { orderId: true },
      where: { serviceId: { equals: id } },
    }),
    req.payload.find({
      collection: "order-items",
      depth: 0,
      overrideAccess: true,
      pagination: false,
      req,
      select: { orderId: true },
      where: { serviceId: { equals: id } },
    }),
  ]);
  const orderIds = [...new Set([...legacy.docs, ...unified.docs].map((row) => String(row.orderId)))];
  if (!orderIds.length) return 0;
  const active = await req.payload.count({
    collection: "orders",
    overrideAccess: true,
    req,
    where: { and: [{ id: { in: orderIds } }, { status: { in: activeStatuses } }] },
  });
  return active.totalDocs;
}

export const protectServiceDeletion: CollectionBeforeDeleteHook = async ({ id, req }) => {
  if (await countActiveServiceOrders(id, req) > 0) {
    throw new APIError("Услугу с активными заказами нельзя удалить.", 400);
  }
};

export const protectServicePricing: CollectionBeforeChangeHook = async ({ data, operation, originalDoc, req }) => {
  if (operation !== "update" || !originalDoc || !req.user) return data;
  const original = originalDoc as Record<string, unknown>;
  const next = data as Record<string, unknown>;
  const pricingChanged = ["basePrice", "priceType", "currency"].some((key) => changed(next, original, key)) ||
    (next.optionGroups !== undefined && JSON.stringify(next.optionGroups) !== JSON.stringify(original.optionGroups));
  if (pricingChanged && await countActiveServiceOrders(originalDoc.id, req) > 0) {
    throw new APIError("Цену и варианты услуги с активными заказами нельзя изменить.", 400);
  }
  return data;
};

export const cascadeOrderDeletion: CollectionBeforeDeleteHook = async ({ id, req }) => {
  for (const collection of ["order-items", "order-services", "payments"] as const) {
    await req.payload.delete({ collection, overrideAccess: true, req, where: { orderId: { equals: id } } });
  }
};

export const protectAccountDeletion: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const result = await req.payload.find({
    collection: "accounts",
    depth: 0,
    limit: 1,
    overrideAccess: true,
    req,
    select: { role: true },
    where: { id: { equals: id } },
  });
  if (result.docs[0]?.role === "FOUNDER") {
    throw new APIError("Аккаунт основателя нельзя удалить из админки.", 403);
  }
};

export const cascadeAccountDeletion: CollectionBeforeDeleteHook = async ({ id, req }) => {
  await req.payload.delete({ collection: "orders", overrideAccess: true, req, where: { userId: { equals: id } } });
  for (const collection of ["auth-sessions", "pending-logins", "mfa-backup-codes", "webauthn-credentials"] as const) {
    await req.payload.delete({ collection, overrideAccess: true, req, where: { userId: { equals: id } } });
  }
  await req.payload.update({
    collection: "activity-logs",
    data: { actorId: null },
    overrideAccess: true,
    req,
    where: { actorId: { equals: id } },
  });
};

export const cascadeServiceDeletion: CollectionBeforeDeleteHook = async ({ id, req }) => {
  await req.payload.delete({ collection: "order-services", overrideAccess: true, req, where: { serviceId: { equals: id } } });
  await req.payload.update({
    collection: "order-items",
    data: { serviceId: null },
    overrideAccess: true,
    req,
    where: { serviceId: { equals: id } },
  });
};
