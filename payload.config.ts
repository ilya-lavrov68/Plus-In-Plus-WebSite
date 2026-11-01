import path from "node:path";
import { fileURLToPath } from "node:url";

import { sqliteAdapter } from "@payloadcms/db-sqlite";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { en } from "@payloadcms/translations/languages/en";
import { ru } from "@payloadcms/translations/languages/ru";
import { buildConfig } from "payload";
import sharp from "sharp";

import { Accounts } from "./payload/collections/accounts.ts";
import { AuthSessions, MfaBackupCodes, PendingLogins, WebAuthnCredentials } from "./payload/collections/auth-stores.ts";
import { Media, Products, Services } from "./payload/collections/catalog.ts";
import { OrderItems, Orders, OrderServices, Payments } from "./payload/collections/commerce.ts";
import { Posts } from "./payload/collections/posts.ts";
import { ActivityLogs, PageViews, SiteSettings, Story } from "./payload/collections/system.ts";
import { payloadEnv } from "./payload/env.ts";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default buildConfig({
  admin: {
    user: Accounts.slug,
    avatar: "default",
    importMap: { baseDir: dirname },
    components: {
      Nav: "/payload/components/admin-nav#AdminNav",
      header: ["/payload/components/admin-menu-button#AdminMenuButton"],
      graphics: {
        Icon: "/payload/components/admin-brand#AdminIcon",
        Logo: "/payload/components/admin-brand#AdminLogo",
      },
      logout: { Button: "/payload/components/auth-logout#AuthLogout" },
      providers: ["/payload/components/admin-a11y-provider#AdminA11yProvider"],
      beforeDashboard: ["/payload/components/dashboard-overview#DashboardOverview"],
    },
    meta: { titleSuffix: " — Plus In Plus" },
  },
  collections: [
    Accounts,
    Services,
    Products,
    Posts,
    Media,
    Orders,
    OrderServices,
    OrderItems,
    Payments,
    ActivityLogs,
    PageViews,
    SiteSettings,
    PendingLogins,
    AuthSessions,
    MfaBackupCodes,
    WebAuthnCredentials,
  ],
  globals: [Story],
  editor: lexicalEditor(),
  db: sqliteAdapter({
    idType: "uuid",
    allowIDOnCreate: true,
    client: {
      url: payloadEnv.databaseUrl,
      authToken: payloadEnv.databaseAuthToken,
    },
    transactionOptions: { behavior: "immediate" },
    busyTimeout: 5000,
    wal: true,
    push: false,
    migrationDir: path.resolve(dirname, "payload/migrations"),
  }),
  graphQL: { disable: true },
  i18n: {
    supportedLanguages: { en, ru },
    fallbackLanguage: "ru",
  },
  localization: {
    locales: [
      { label: "Русский", code: "ru" },
      { label: "English", code: "en" },
    ],
    defaultLocale: "ru",
    fallback: true,
  },
  routes: {
    admin: "/admin",
    api: "/api/payload",
  },
  cors: [],
  csrf: [],
  secret: payloadEnv.secret,
  sharp,
  telemetry: false,
  typescript: {
    outputFile: path.resolve(dirname, "payload/payload-types.ts"),
  },
});
