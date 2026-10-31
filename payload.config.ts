import path from "node:path";
import { fileURLToPath } from "node:url";

import { sqliteAdapter } from "@payloadcms/db-sqlite";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { en } from "@payloadcms/translations/languages/en";
import { ru } from "@payloadcms/translations/languages/ru";
import { buildConfig } from "payload";
import sharp from "sharp";

import { PayloadUsers } from "./payload/collections/payload-users.ts";
import { Posts } from "./payload/collections/posts.ts";
import { payloadEnv } from "./payload/env.ts";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default buildConfig({
  admin: {
    user: PayloadUsers.slug,
    avatar: "default",
    importMap: { baseDir: dirname },
    components: {
      logout: { Button: "/payload/components/auth-logout#AuthLogout" },
      providers: ["/payload/components/admin-a11y-provider#AdminA11yProvider"],
    },
    meta: { titleSuffix: " — Plus In Plus" },
  },
  collections: [PayloadUsers, Posts],
  editor: lexicalEditor(),
  db: sqliteAdapter({
    client: {
      url: payloadEnv.databaseUrl,
      authToken: payloadEnv.databaseAuthToken,
    },
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
    admin: "/payload",
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
