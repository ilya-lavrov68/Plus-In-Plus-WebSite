import type { CollectionConfig, Field } from "payload";

import { founderOnly, readSubmittedOrders, serverOnly, staffOnly } from "../access.ts";
import { activityAfterChange, cascadeOrderDeletion, distributeOrderPrice, prepareOrder } from "../hooks.ts";

type NamedField = Extract<Field, { type: "text" | "number" | "date" | "relationship" | "textarea" }>;

const serverUpdated = (field: NamedField): NamedField => ({
  ...field,
  access: { ...(field.access ?? {}), update: () => false },
});

const orderStatuses = [
  "cart",
  "pending",
  "quote_requested",
  "negotiating",
  "priced",
  "awaiting_payment",
  "paid",
  "in_progress",
  "completed",
  "cancelled",
  "refunded",
];

export const Orders: CollectionConfig = {
  slug: "orders",
  labels: {
    singular: { en: "Order", ru: "Заказ" },
    plural: { en: "Orders", ru: "Заказы" },
  },
  admin: {
    useAsTitle: "number",
    defaultColumns: ["number", "status", "userId", "total", "managerId", "createdAt"],
    group: { en: "Commerce", ru: "Продажи" },
    pagination: { defaultLimit: 50, limits: [25, 50, 100] },
    description: {
      en: "Submitted orders only. Price, status and lock transitions are validated against actual payments.",
      ru: "Только оформленные заказы. Цена, статусы и блокировка проверяются с учётом фактических платежей.",
    },
  },
  access: {
    read: readSubmittedOrders,
    create: () => false,
    update: staffOnly,
    delete: founderOnly,
  },
  hooks: {
    beforeChange: [prepareOrder],
    afterChange: [distributeOrderPrice, activityAfterChange("order", "number")],
    beforeDelete: [cascadeOrderDeletion],
  },
  fields: [
    serverUpdated({ name: "orderNumber", type: "text", unique: true, admin: { readOnly: true } }),
    serverUpdated({ name: "number", type: "text", unique: true, admin: { readOnly: true } }),
    serverUpdated({ name: "userId", type: "relationship", relationTo: "accounts", required: true, index: true, label: { en: "Customer", ru: "Клиент" } }),
    { name: "cartKey", type: "text", unique: true, admin: { hidden: true }, access: { update: () => false } },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "cart",
      options: orderStatuses.map((value) => ({ label: value, value })),
      admin: { position: "sidebar" },
    },
    serverUpdated({ name: "estimatedAmount", type: "number", required: true, defaultValue: 0, label: { en: "Estimate (kopecks)", ru: "Оценка (копейки)" } }),
    serverUpdated({ name: "subtotal", type: "number", required: true, defaultValue: 0 }),
    serverUpdated({ name: "discount", type: "number", required: true, defaultValue: 0 }),
    serverUpdated({ name: "total", type: "number", required: true, defaultValue: 0, label: { en: "Total (kopecks)", ru: "Итого (копейки)" } }),
    serverUpdated({ name: "currency", type: "text", required: true, defaultValue: "RUB" }),
    { name: "deadline", type: "date", label: { en: "Deadline", ru: "Срок" } },
    serverUpdated({ name: "description", type: "textarea", maxLength: 5000 }),
    { name: "finalPrice", type: "number", min: 0, max: 100_000_000, label: { en: "Agreed price (RUB)", ru: "Согласованная цена (₽)" } },
    serverUpdated({ name: "customerNote", type: "textarea", maxLength: 5000, label: { en: "Customer note", ru: "Комментарий клиента" } }),
    { name: "managerNote", type: "textarea", maxLength: 5000, label: { en: "Manager note", ru: "Комментарий менеджера" } },
    serverUpdated({ name: "managerId", type: "relationship", relationTo: "accounts", index: true, label: { en: "Manager", ru: "Менеджер" } }),
    serverUpdated({ name: "priceAgreedAt", type: "date" }),
    { name: "isLocked", type: "checkbox", defaultValue: false, label: { en: "Locked", ru: "Заблокирован" }, admin: { position: "sidebar" } },
    serverUpdated({ name: "lockedAt", type: "date" }),
    serverUpdated({ name: "lockedById", type: "relationship", relationTo: "accounts" }),
    serverUpdated({ name: "paidAt", type: "date", admin: { position: "sidebar" } }),
    { name: "items", type: "join", collection: "order-items", on: "orderId", defaultLimit: 50, label: { en: "Order items", ru: "Позиции" } },
    { name: "services", type: "join", collection: "order-services", on: "orderId", defaultLimit: 50, label: { en: "Service links", ru: "Связи услуг" } },
    { name: "payments", type: "join", collection: "payments", on: "orderId", defaultLimit: 20, label: { en: "Payments", ru: "Платежи" } },
  ],
};

const childAccess: CollectionConfig["access"] = {
  read: staffOnly,
  create: serverOnly,
  update: serverOnly,
  delete: serverOnly,
};

export const OrderServices: CollectionConfig = {
  slug: "order-services",
  labels: {
    singular: { en: "Order service", ru: "Услуга заказа" },
    plural: { en: "Order services", ru: "Услуги заказов" },
  },
  admin: { hidden: true, group: false },
  access: childAccess,
  hooks: {
    beforeValidate: [({ data }) => {
      if (data) data.serviceKey = data.orderId && data.serviceId ? `${data.orderId}:${data.serviceId}` : null;
      return data;
    }],
  },
  fields: [
    { name: "orderId", type: "relationship", relationTo: "orders", required: true, index: true },
    { name: "serviceId", type: "relationship", relationTo: "services", required: true, index: true },
    { name: "serviceKey", type: "text", unique: true, admin: { hidden: true } },
    { name: "quantity", type: "number", required: true, defaultValue: 1, min: 1 },
  ],
};

export const OrderItems: CollectionConfig = {
  slug: "order-items",
  labels: {
    singular: { en: "Order item", ru: "Позиция заказа" },
    plural: { en: "Order items", ru: "Позиции заказов" },
  },
  admin: { hidden: true, group: false },
  access: childAccess,
  fields: [
    { name: "orderId", type: "relationship", relationTo: "orders", required: true, index: true },
    { name: "itemType", type: "select", required: true, defaultValue: "service", options: ["service", "product"] },
    { name: "itemId", type: "text", required: true, defaultValue: "" },
    { name: "serviceId", type: "relationship", relationTo: "services", index: true },
    { name: "productId", type: "relationship", relationTo: "products", index: true },
    { name: "title", type: "text", required: true, defaultValue: "" },
    { name: "quantity", type: "number", required: true, defaultValue: 1, min: 1 },
    { name: "estimatedUnitPrice", type: "number", required: true, defaultValue: 0 },
    { name: "unitPrice", type: "number", required: true, defaultValue: 0 },
    { name: "totalPrice", type: "number", required: true, defaultValue: 0 },
    { name: "optionsSnapshot", type: "textarea", required: true, defaultValue: "[]", admin: { readOnly: true } },
  ],
};

export const Payments: CollectionConfig = {
  slug: "payments",
  labels: {
    singular: { en: "Payment", ru: "Платёж" },
    plural: { en: "Payments", ru: "Платежи" },
  },
  admin: {
    useAsTitle: "externalId",
    defaultColumns: ["externalId", "orderId", "status", "amount", "createdAt", "paidAt"],
    group: { en: "Commerce", ru: "Продажи" },
  },
  access: childAccess,
  hooks: {
    beforeValidate: [({ data }) => {
      if (data) data.providerKey = data.externalId ? `${data.provider}:${data.externalId}` : null;
      return data;
    }],
  },
  fields: [
    { name: "orderId", type: "relationship", relationTo: "orders", required: true, index: true },
    { name: "provider", type: "select", required: true, options: ["robokassa"], admin: { readOnly: true } },
    { name: "externalId", type: "text", admin: { readOnly: true } },
    { name: "providerKey", type: "text", unique: true, admin: { hidden: true } },
    { name: "status", type: "select", required: true, defaultValue: "pending", options: ["pending", "succeeded", "failed", "cancelled"], admin: { readOnly: true } },
    { name: "amount", type: "number", required: true, min: 0, label: { en: "Amount (kopecks)", ru: "Сумма (копейки)" } },
    { name: "currency", type: "text", required: true, defaultValue: "RUB" },
    { name: "paymentUrl", type: "text" },
    { name: "rawPayload", type: "textarea", access: { read: () => false } },
    { name: "paidAt", type: "date" },
  ],
};
