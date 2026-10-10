import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { defineConfig } from "prisma/config";

// `engine: "js"` runs all Prisma CLI operations (generate/migrate) through the
// same driver adapter the app uses at runtime. This keeps the toolchain
// platform-independent: no native schema/query engine binaries are downloaded,
// so `prisma generate` also works in offline/sandboxed environments. The
// generated client itself stays on the WASM query compiler
// (generator `engineType = "client"` in prisma/schema.prisma).
export default defineConfig({
  engine: "js",
  experimental: { adapter: true },
  adapter: async () =>
    new PrismaPg({
      connectionString:
        process.env.DATABASE_URL ??
        "postgresql://postgres:postgres@localhost:5432/plus_in_plus?schema=public",
    }),
});
