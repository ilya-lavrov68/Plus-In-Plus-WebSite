import path from "node:path";

import { APIError, type CollectionConfig } from "payload";

import { adminOnly, visibleToAdmin } from "../access.ts";
import { activityAfterChange, cascadeServiceDeletion, mediaPublicUrl, prepareService, protectServiceDeletion, protectServicePricing } from "../hooks.ts";

const contentGroup = { en: "Content", ru: "Контент" };
const commerceGroup = { en: "Commerce", ru: "Продажи" };

export const Media: CollectionConfig = {
  slug: "media",
  labels: {
    singular: { en: "Media", ru: "Медиа" },
    plural: { en: "Media library", ru: "Медиатека" },
  },
  admin: {
    useAsTitle: "alt",
    defaultColumns: ["filename", "alt", "kind", "updatedAt"],
    group: contentGroup,
    hidden: ({ user }) => !visibleToAdmin(user),
  },
  access: { read: adminOnly, create: adminOnly, update: adminOnly, delete: adminOnly },
  hooks: { afterRead: [mediaPublicUrl] },
  upload: {
    staticDir: path.join(process.cwd(), "public", "uploads", "media"),
    mimeTypes: ["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"],
  },
  fields: [
    {
      name: "alt",
      type: "text",
      required: true,
      maxLength: 240,
      label: { en: "Alternative text", ru: "Альтернативный текст" },
    },
    {
      name: "kind",
      type: "select",
      required: true,
      defaultValue: "general",
      options: [
        { label: { en: "General", ru: "Общее" }, value: "general" },
        { label: { en: "Blog", ru: "Блог" }, value: "blog" },
        { label: { en: "Services", ru: "Услуги" }, value: "services" },
        { label: { en: "Avatars", ru: "Аватары" }, value: "avatars" },
      ],
      admin: { position: "sidebar" },
    },
  ],
};

export const Services: CollectionConfig = {
  slug: "services",
  labels: {
    singular: { en: "Service", ru: "Услуга" },
    plural: { en: "Services", ru: "Услуги" },
  },
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "category", "priceType", "basePrice", "isPublished", "isOrderable", "sortOrder"],
    group: contentGroup,
    hidden: ({ user }) => !visibleToAdmin(user),
    pagination: { defaultLimit: 50, limits: [25, 50, 100] },
  },
  access: { read: adminOnly, create: adminOnly, update: adminOnly, delete: adminOnly },
  hooks: {
    beforeChange: [prepareService, protectServicePricing],
    afterChange: [activityAfterChange("service", "title")],
    beforeDelete: [protectServiceDeletion, cascadeServiceDeletion],
  },
  fields: [
    { name: "title", type: "text", required: true, maxLength: 160, label: { en: "Title", ru: "Название" } },
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      index: true,
      validate: (value: unknown) => typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) || "Используйте строчные латинские буквы, цифры и дефисы.",
    },
    {
      name: "category",
      type: "select",
      required: true,
      options: [
        { label: { en: "Small format", ru: "Малый формат" }, value: "small" },
        { label: { en: "Large format", ru: "Крупный формат" }, value: "large" },
      ],
      admin: { position: "sidebar" },
    },
    { name: "shortDesc", type: "textarea", required: true, maxLength: 600, label: { en: "Short description", ru: "Краткое описание" } },
    { name: "fullDesc", type: "textarea", required: true, maxLength: 10_000, label: { en: "Full description", ru: "Полное описание" } },
    {
      name: "includes",
      type: "array",
      labels: { singular: { en: "Included item", ru: "Что входит" }, plural: { en: "Included items", ru: "Что входит" } },
      fields: [{ name: "value", type: "text", required: true, maxLength: 500 }],
    },
    {
      name: "shapes",
      type: "array",
      labels: { singular: { en: "Format", ru: "Формат" }, plural: { en: "Formats", ru: "Форматы" } },
      fields: [{ name: "value", type: "text", required: true, maxLength: 200 }],
    },
    { name: "resultText", type: "textarea", required: true, maxLength: 2000, label: { en: "Result", ru: "Результат" } },
    { name: "coverImage", type: "text", admin: { hidden: true } },
    { name: "cover", type: "upload", relationTo: "media", label: { en: "Cover", ru: "Обложка" } },
    {
      name: "basePrice",
      type: "number",
      required: true,
      defaultValue: 0,
      min: 0,
      label: { en: "Base price (kopecks)", ru: "Базовая цена (копейки)" },
      admin: { description: { en: "Integer kopecks only.", ru: "Только целые копейки, без дробных значений." } },
      validate: (value: unknown) => value === undefined || value === null || Number.isInteger(value) || "Укажите целое число копеек.",
    },
    {
      name: "priceType",
      type: "select",
      required: true,
      defaultValue: "quote",
      options: [
        { label: { en: "Fixed", ru: "Фиксированная" }, value: "fixed" },
        { label: { en: "From", ru: "От" }, value: "from" },
        { label: { en: "Quote", ru: "По расчёту" }, value: "quote" },
      ],
      admin: { position: "sidebar" },
    },
    { name: "currency", type: "text", required: true, defaultValue: "RUB", maxLength: 3, admin: { position: "sidebar", readOnly: true } },
    { name: "isOrderable", type: "checkbox", defaultValue: false, label: { en: "Can be ordered", ru: "Можно заказать" }, admin: { position: "sidebar" } },
    { name: "isPublished", type: "checkbox", defaultValue: false, label: { en: "Published", ru: "Опубликована" }, admin: { position: "sidebar" } },
    { name: "isActive", type: "checkbox", defaultValue: true, label: { en: "Active", ru: "Активна" }, admin: { position: "sidebar" } },
    { name: "sortOrder", type: "number", required: true, defaultValue: 0, admin: { position: "sidebar" } },
    {
      name: "optionGroups",
      type: "array",
      labels: { singular: { en: "Option group", ru: "Группа опций" }, plural: { en: "Option groups", ru: "Группы опций" } },
      fields: [
        { name: "name", type: "text", required: true, maxLength: 120 },
        { name: "required", type: "checkbox", defaultValue: true },
        { name: "sortOrder", type: "number", required: true, defaultValue: 0 },
        {
          name: "options",
          type: "array",
          minRows: 1,
          fields: [
            { name: "label", type: "text", required: true, maxLength: 160 },
            { name: "priceDelta", type: "number", required: true, defaultValue: 0, validate: (value: unknown) => value === undefined || value === null || Number.isInteger(value) || "Только целые копейки." },
            { name: "priceFactor", type: "number", required: true, defaultValue: 1, min: 0.0001 },
            { name: "isDefault", type: "checkbox", defaultValue: false },
            { name: "sortOrder", type: "number", required: true, defaultValue: 0 },
          ],
        },
      ],
    },
  ],
};

export const Products: CollectionConfig = {
  slug: "products",
  labels: {
    singular: { en: "Product", ru: "Товар" },
    plural: { en: "Products", ru: "Товары" },
  },
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "category", "price", "stock", "isActive"],
    group: commerceGroup,
    hidden: ({ user }) => !visibleToAdmin(user),
  },
  access: { read: adminOnly, create: adminOnly, update: adminOnly, delete: adminOnly },
  hooks: {
    beforeDelete: [async ({ id, req }) => {
      await req.payload.update({
        collection: "order-items",
        data: { productId: null },
        overrideAccess: true,
        req,
        where: { productId: { equals: id } },
      });
    }],
  },
  fields: [
    { name: "name", type: "text", required: true, maxLength: 160 },
    { name: "slug", type: "text", required: true, unique: true, index: true },
    { name: "description", type: "textarea", maxLength: 10_000 },
    { name: "price", type: "number", required: true, min: 0, label: { en: "Price (RUB)", ru: "Цена (₽)" } },
    { name: "coverImage", type: "text", admin: { hidden: true } },
    { name: "cover", type: "upload", relationTo: "media", label: { en: "Cover", ru: "Обложка" } },
    { name: "category", type: "text", maxLength: 80 },
    { name: "isActive", type: "checkbox", defaultValue: true, admin: { position: "sidebar" } },
    { name: "stock", type: "number", required: true, defaultValue: 0, min: 0, validate: (value: unknown) => value === undefined || value === null || Number.isInteger(value) || "Остаток должен быть целым числом." },
  ],
};

export async function preventOrderItemDeletionError(message: string): Promise<never> {
  throw new APIError(message, 400);
}
