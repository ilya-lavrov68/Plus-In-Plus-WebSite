function requiredSecret(): string {
  const value = process.env.PAYLOAD_SECRET?.trim();
  if (!value || value.length < 32) {
    throw new Error("PAYLOAD_SECRET must be configured with at least 32 characters.");
  }
  return value;
}

/** Одна БД для Payload, публичного сайта, auth и commerce. Никакой второй Prisma-БД. */
function databaseUrl(): string {
  const configured = process.env.PAYLOAD_DATABASE_URL?.trim() || process.env.TURSO_DATABASE_URL?.trim();
  if (configured) {
    if (!/^(?:file:|libsql:|https?:|:memory:)/i.test(configured)) {
      throw new Error("PAYLOAD_DATABASE_URL must be a SQLite/libSQL URL (file:, libsql:, http(s): or :memory:).");
    }
    return configured;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("PAYLOAD_DATABASE_URL (or TURSO_DATABASE_URL) must be configured in production.");
  }
  return "file:./payload/pip.db";
}

export const payloadEnv = {
  databaseAuthToken: process.env.PAYLOAD_DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN,
  databaseUrl: databaseUrl(),
  secret: requiredSecret(),
};
