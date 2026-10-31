import type { CollectionConfig } from "payload";

import { hasPayloadAdmin } from "../access.ts";
import { PAYLOAD_POSTS_SLUG } from "../constants.ts";

const staffOnly = ({ req }: { req: Parameters<typeof hasPayloadAdmin>[0] }) =>
  hasPayloadAdmin(req);

export const Posts: CollectionConfig = {
  slug: PAYLOAD_POSTS_SLUG,
  labels: {
    singular: { en: "Post", ru: "Материал" },
    plural: { en: "Posts", ru: "Материалы" },
  },
  admin: {
    useAsTitle: "title",
    defaultColumns: ["title", "status", "publishedAt", "updatedAt"],
    description: {
      en: "Isolated Payload content. Public-site cutover is a separate reviewed step.",
      ru: "Изолированный контент Payload. Подключение к публичному сайту — отдельный согласованный этап.",
    },
  },
  access: {
    read: staffOnly,
    create: staffOnly,
    update: staffOnly,
    delete: staffOnly,
  },
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
      localized: true,
      label: { en: "Title", ru: "Заголовок" },
    },
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      index: true,
      label: { en: "Slug", ru: "Адрес" },
      validate: (value: unknown) =>
        typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
          ? true
          : "Use lowercase Latin letters, numbers and single hyphens.",
    },
    {
      name: "excerpt",
      type: "textarea",
      localized: true,
      label: { en: "Excerpt", ru: "Краткое описание" },
    },
    {
      name: "content",
      type: "richText",
      localized: true,
      label: { en: "Content", ru: "Содержание" },
    },
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "draft",
      options: [
        { label: { en: "Draft", ru: "Черновик" }, value: "draft" },
        { label: { en: "Published", ru: "Опубликован" }, value: "published" },
      ],
      admin: { position: "sidebar" },
    },
    {
      name: "publishedAt",
      type: "date",
      label: { en: "Published at", ru: "Дата публикации" },
      admin: { position: "sidebar" },
    },
  ],
};
