import { APIError, type CollectionAfterChangeHook, type CollectionBeforeChangeHook, type CollectionBeforeDeleteHook } from "payload";

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
  const original = originalDoc as Record<string, any>;
  const next = data as Record<string, any>;
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
  if (nextStatus && nextStatus !== original.status) {
    if (nextStatus === "paid") throw new APIError("Оплату подтверждает только webhook Robokassa.", 400);
    if (!ORDER_TRANSITIONS[original.status]?.includes(nextStatus)) {
      throw new APIError(`Недопустимый переход ${original.status} → ${nextStatus}.`, 400);
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
    if (CLOSED_ORDER_STATUSES.has(original.status)) throw new APIError("Цена закрытого заказа неизменна.", 400);
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
    req.context.distributeOrderPrice = { orderId: original.id, total };
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
  for (const item of items.docs) {
    const share = estimatedTotal
      ? (Number(item.estimatedUnitPrice || 0) * Number(item.quantity || 0)) / estimatedTotal
      : 1 / Math.max(1, items.docs.length);
    const itemTotal = Math.round(pending.total * share);
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

export const protectServiceDeletion: CollectionBeforeDeleteHook = async ({ id, req }) => {
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
  if (orderIds.length) {
    const active = await req.payload.count({
      collection: "orders",
      overrideAccess: true,
      req,
      where: { and: [{ id: { in: orderIds } }, { status: { in: activeStatuses } }] },
    });
    if (active.totalDocs > 0) throw new APIError("Услугу с активными заказами нельзя удалить.", 400);
  }
};

export const cascadeOrderDeletion: CollectionBeforeDeleteHook = async ({ id, req }) => {
  for (const collection of ["order-items", "order-services", "payments"] as const) {
    await req.payload.delete({ collection, overrideAccess: true, req, where: { orderId: { equals: id } } });
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
