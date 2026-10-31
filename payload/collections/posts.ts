import type { CollectionConfig } from "payload";

import { adminOnly, visibleToAdmin } from "../access.ts";
import { activityAfterChange, preparePost, syncFeaturedPost } from "../hooks.ts";

export const Posts: CollectionConfig = {
  slug: "posts",
  labels: {
    singular: { en: "Post", ru: "Материал" },
    plural: { en: "Posts", ru: "Материалы" },
  },
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "isPublished", "isFeatured", "publishedAt", "updatedAt"],
    group: { en: "Content", ru: "Контент" },
    hidden: ({ user }) => !visibleToAdmin(user),
    pagination: { defaultLimit: 50, limits: [25, 50, 100] },
    preview: (doc) => `/blog/${String(doc.slug ?? "")}`,
    description: {
      en: "Author-controlled articles. Use the Lexical editor and media library; scripts and arbitrary embeds are not accepted.",
      ru: "Авторские материалы. Используйте Lexical и медиатеку; скрипты и произвольные embeds не принимаются.",
    },
  },
  access: { read: adminOnly, create: adminOnly, update: adminOnly, delete: adminOnly },
  hooks: {
    beforeChange: [preparePost],
    afterChange: [syncFeaturedPost, activityAfterChange("post", "title")],
  },
  fields: [
    { name: "title", type: "text", required: true, maxLength: 180, label: { en: "Title", ru: "Заголовок" } },
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      index: true,
      label: { en: "Slug", ru: "Адрес" },
      validate: (value: unknown) => typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) || "Use lowercase Latin letters, numbers and single hyphens.",
    },
    { name: "excerpt", type: "textarea", required: true, maxLength: 1000, label: { en: "Excerpt", ru: "Краткое описание" } },
    { name: "content", type: "richText", required: true, label: { en: "Content", ru: "Содержание" } },
    { name: "coverImage", type: "text", admin: { hidden: true } },
    { name: "cover", type: "upload", relationTo: "media", label: { en: "Cover", ru: "Обложка" } },
    { name: "images", type: "textarea", admin: { hidden: true } },
    {
      name: "gallery",
      type: "upload",
      relationTo: "media",
      hasMany: true,
      label: { en: "Gallery", ru: "Галерея" },
    },
    { name: "readTime", type: "number", required: true, defaultValue: 5, min: 1, max: 180, admin: { position: "sidebar" } },
    {
      name: "source",
      type: "select",
      required: true,
      defaultValue: "manual",
      options: [
        { label: "Manual", value: "manual" },
        { label: "VK", value: "vk" },
        { label: "Telegram", value: "telegram" },
        { label: "YouTube", value: "youtube" },
      ],
      admin: { position: "sidebar" },
    },
    { name: "sourceUrl", type: "text", maxLength: 2000, label: { en: "Source URL", ru: "Ссылка на источник" } },
    { name: "isFeatured", type: "checkbox", defaultValue: false, label: { en: "Featured", ru: "Избранный" }, admin: { position: "sidebar" } },
    { name: "isPublished", type: "checkbox", defaultValue: false, label: { en: "Published", ru: "Опубликован" }, admin: { position: "sidebar" } },
    { name: "publishedAt", type: "date", label: { en: "Published at", ru: "Дата публикации" }, admin: { position: "sidebar" } },
  ],
};
