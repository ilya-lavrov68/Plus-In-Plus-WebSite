import { NextResponse } from "next/server";

import { resolveDatabaseConfig } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/security-log";

/**
 * Deployment check: `curl https://<your-domain>/api/health`.
 *
 * Answers the two questions that used to fail silently in production:
 *   1. is the configured libSQL/Turso database reachable?
 *   2. are all tables present (did `npm run db:push` run after the last schema change)?
 *
 * It reports booleans only — no connection string, token, table contents or user data.
 */
export const dynamic = "force-dynamic";

const REQUIRED_TABLES = [
  "users",
  "pending_logins",
  "auth_sessions",
  "mfa_backup_codes",
  "webauthn_credentials",
  "services",
  "products",
  "service_option_groups",
  "service_options",
  "posts",
  "activity_logs",
  "page_views",
  "orders",
  "order_services",
  "order_items",
  "payments",
  "site_settings",
] as const;

export async function GET() {
  const config = resolveDatabaseConfig();

  if (!config || !prisma) {
    return NextResponse.json(
      {
        status: "unavailable",
        database: "not-configured",
        hint: "Set TURSO_DATABASE_URL (and TURSO_AUTH_TOKEN for Turso) and redeploy.",
      },
      { status: 503 },
    );
  }

  try {
    const rows = await prisma.$queryRaw<Array<{ name: unknown }>>`
      select name from sqlite_master where type = 'table' and name not like 'sqlite_%'
    `;
    const present = new Set(rows.map((row) => String(row.name)));
    const missing = REQUIRED_TABLES.filter((table) => !present.has(table));

    if (missing.length > 0) {
      return NextResponse.json(
        {
          status: "schema-out-of-date",
          database: { driver: "libsql", remote: config.remote, missingTables: missing },
          hint: "Run `npm run db:push` against this database.",
        },
        { status: 503 },
      );
    }

    return NextResponse.json({
      status: "ok",
      database: { driver: "libsql", remote: config.remote, tables: REQUIRED_TABLES.length },
    });
  } catch (error) {
    logServerError("health.check_failed", error);
    return NextResponse.json(
      {
        status: "unavailable",
        database: { driver: "libsql", remote: config.remote, reachable: false },
        hint: "Check TURSO_DATABASE_URL / TURSO_AUTH_TOKEN and that the Turso database still exists.",
      },
      { status: 503 },
    );
  }
}
