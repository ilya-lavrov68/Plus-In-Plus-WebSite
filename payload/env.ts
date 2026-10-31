function requiredSecret(): string {
  const value = process.env.PAYLOAD_SECRET?.trim();
  if (!value || value.length < 32) {
    throw new Error("PAYLOAD_SECRET must be configured with at least 32 characters.");
  }
  return value;
}

function isolatedDatabaseUrl(): string {
  const value = process.env.PAYLOAD_DATABASE_URL?.trim();
  if (!value) {
    throw new Error("PAYLOAD_DATABASE_URL must point to the dedicated CMS database.");
  }
  if (
    value === process.env.TURSO_DATABASE_URL ||
    value === process.env.DATABASE_URL ||
    (value.startsWith("file:") && /prisma[\\/]/i.test(value))
  ) {
    throw new Error("PAYLOAD_DATABASE_URL must not reuse the application Prisma database.");
  }
  return value;
}

export const payloadEnv = {
  databaseAuthToken: process.env.PAYLOAD_DATABASE_AUTH_TOKEN,
  databaseUrl: isolatedDatabaseUrl(),
  secret: requiredSecret(),
};
