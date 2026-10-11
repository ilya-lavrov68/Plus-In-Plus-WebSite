import "dotenv/config";

import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { defineConfig } from "prisma/config";

import { resolveDatabaseConfig } from "./lib/database";

// `engine: "js"` runs every Prisma CLI operation (generate/db push/studio) through
// the same driver adapter the app uses at runtime. This keeps the toolchain
// platform-independent: no native schema/query engine binaries are downloaded, so
// `prisma generate` and `prisma db push` also work in offline/sandboxed
// environments. The generated client itself stays on the WASM query compiler
// (generator `engineType = "client"` in prisma/schema.prisma).
//
// One configuration for development and production:
//   TURSO_DATABASE_URL="file:./prisma/dev.db"            → local SQLite file
//   TURSO_DATABASE_URL="libsql://…turso.io" + token      → Turso Cloud
export default defineConfig({
  engine: "js",
  experimental: { adapter: true },
  adapter: async () => {
    // Falls back to the local file in development so `npx prisma studio`,
    // `prisma db push` and `prisma generate` work before .env exists.
    const config = resolveDatabaseConfig({ allowDevelopmentFallback: true });
    if (!config) {
      throw new Error(
        "TURSO_DATABASE_URL is not set. Configure .env (see .env.example) or run with a local file: TURSO_DATABASE_URL=file:./prisma/dev.db",
      );
    }
    return new PrismaLibSQL({ url: config.url, authToken: config.authToken });
  },
});
