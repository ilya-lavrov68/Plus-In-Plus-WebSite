import type { CollectionConfig, GlobalConfig } from "payload";

import { isSiteSettingKey } from "@/lib/site-settings";
import { adminOnly, founderOnly, serverOnly, visibleToAdmin } from "../access.ts";
import { activityAfterChange, activityAfterStoryChange } from "../hooks.ts";

export const ActivityLogs: CollectionConfig = {
  slug: "activity-logs",
  labels: {
    singular: { en: "Activity", ru: "Событие" },
    plural: { en: "Activity log", ru: "Журнал действий" },
  },
  admin: {
    useAsTitle: "title",
    defaultColumns: ["createdAt", "action", "entityType", "title", "actorId"],
    group: { en: "Analytics", ru: "Аналитика" },
    hidden: ({ user }) => !visibleToAdmin(user),
    pagination: { defaultLimit: 50, limits: [50, 100] },
    description: {
      en: "Append-only audit history. Values and secrets are never copied into entries.",
      ru: "Неизменяемый журнал. Значения настроек и секреты в записи не копируются.",
    },
  },
  access: { read: adminOnly, create: serverOnly, update: serverOnly, delete: serverOnly },
  fields: [
    { name: "action", type: "text", required: true },
    { name: "entityType", type: "select", required: true, options: ["service", "post", "user", "setting", "order", "media"] },
    { name: "entityId", type: "text", required: true },
    { name: "title", type: "text", required: true },
    { name: "actorId", type: "relationship", relationTo: "accounts", index: true },
    { name: "actorPseudonym", type: "text" },
  ],
};

export const PageViews: CollectionConfig = {
  slug: "page-views",
  labels: {
    singular: { en: "Page view", ru: "Просмотр" },
    plural: { en: "Page views", ru: "Просмотры" },
  },
  admin: {
    useAsTitle: "path",
    defaultColumns: ["createdAt", "path", "device", "utmSource", "durationMs"],
    group: { en: "Analytics", ru: "Аналитика" },
    hidden: ({ user }) => !visibleToAdmin(user),
    pagination: { defaultLimit: 50, limits: [50, 100] },
  },
  access: { read: adminOnly, create: serverOnly, update: serverOnly, delete: serverOnly },
  fields: [
    { name: "path", type: "text", required: true, index: true },
    { name: "sessionId", type: "text", index: true, access: { read: () => false } },
    { name: "visitorId", type: "text", index: true, access: { read: () => false } },
    { name: "referrer", type: "text" },
    { name: "utmSource", type: "text" },
    { name: "userAgent", type: "textarea", access: { read: () => false } },
    { name: "device", type: "select", options: ["desktop", "mobile", "tablet"] },
    { name: "durationMs", type: "number", min: 0 },
  ],
};

export const SiteSettings: CollectionConfig = {
  slug: "site-settings",
  labels: {
    singular: { en: "Setting", ru: "Настройка" },
    plural: { en: "Site settings", ru: "Настройки сайта" },
  },
  admin: {
    useAsTitle: "key",
    defaultColumns: ["key", "updatedAt"],
    group: { en: "Settings", ru: "Настройки" },
    hidden: ({ user }) => user?.role !== "FOUNDER",
    description: {
      en: "Founder-only configuration, including Robokassa and support integrations. Empty secret fields in server actions mean keep the existing value.",
      ru: "Настройки только для основателя, включая Robokassa и поддержку. Пустое секретное значение в server action означает сохранить прежнее.",
    },
  },
  access: { read: founderOnly, create: founderOnly, update: founderOnly, delete: founderOnly },
  hooks: { afterChange: [activityAfterChange("setting", "key")] },
  fields: [
    {
      name: "key",
      type: "text",
      required: true,
      unique: true,
      index: true,
      access: { update: () => false },
      validate: (value: unknown) => typeof value === "string" && isSiteSettingKey(value) || "Unknown site setting.",
    },
    { name: "value", type: "textarea", required: true, maxLength: 5000 },
  ],
};

export const Story: GlobalConfig = {
  slug: "story",
  label: { en: "Landing story", ru: "История на главной" },
  admin: {
    group: { en: "Content", ru: "Контент" },
    hidden: ({ user }) => !visibleToAdmin(user),
    description: {
      en: "Database-authoritative timeline. No invented milestones are shown when the list is empty.",
      ru: "Таймлайн из базы. При пустом списке сайт не подставляет выдуманные события.",
    },
  },
  access: { read: adminOnly, update: adminOnly },
  hooks: { afterChange: [activityAfterStoryChange] },
  fields: [
    { name: "heading", type: "text", maxLength: 120, label: { en: "Heading", ru: "Заголовок" } },
    { name: "description", type: "textarea", maxLength: 600, label: { en: "Description", ru: "Описание" } },
    {
      name: "events",
      type: "array",
      maxRows: 20,
      labels: { singular: { en: "Event", ru: "Событие" }, plural: { en: "Events", ru: "События" } },
      fields: [
        { name: "period", type: "text", required: true, maxLength: 48 },
        { name: "title", type: "text", required: true, maxLength: 160 },
        { name: "description", type: "textarea", required: true, maxLength: 1000 },
      ],
    },
  ],
};
