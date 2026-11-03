import { NextResponse } from "next/server";

import { resolveDatabaseConfig } from "@/lib/database";
import { rows as queryPayloadRows } from "@/lib/db";
import { logServerError } from "@/lib/security-log";

/** Безопасный deployment check: только booleans и имена отсутствующих таблиц. */
export const dynamic = "force-dynamic";

const REQUIRED_TABLES = [
  "accounts",
  "pending_logins",
  "auth_sessions",
  "mfa_backup_codes",
  "webauthn_credentials",
  "services",
  "products",
  "posts",
  "media",
  "orders",
  "order_services",
  "order_items",
  "payments",
  "activity_logs",
  "page_views",
  "site_settings",
] as const;

export async function GET() {
  const config = resolveDatabaseConfig();
  if (!config) {
    return NextResponse.json(
      {
        status: "unavailable",
        database: "not-configured",
        hint: "Set PAYLOAD_DATABASE_URL (and PAYLOAD_DATABASE_AUTH_TOKEN for remote libSQL) and redeploy.",
      },
      { status: 503 },
    );
  }

  try {
    const rows = await queryPayloadRows<{ name: unknown }>(
      "select name from sqlite_master where type = 'table' and name not like 'sqlite_%'",
    );
    const present = new Set(rows.map((row) => String(row.name)));
    const missing = REQUIRED_TABLES.filter((table) => !present.has(table));
    if (missing.length > 0) {
      return NextResponse.json(
        {
          status: "schema-out-of-date",
          database: { driver: "payload-sqlite", remote: config.remote, missingTables: missing },
          hint: "Run `npm run payload:migrate` against this database.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({
      status: "ok",
      database: { driver: "payload-sqlite", remote: config.remote, tables: REQUIRED_TABLES.length },
    });
  } catch (error) {
    logServerError("health.check_failed", error);
    return NextResponse.json(
      {
        status: "unavailable",
        database: { driver: "payload-sqlite", remote: config.remote, reachable: false },
        hint: "Check PAYLOAD_DATABASE_URL / PAYLOAD_DATABASE_AUTH_TOKEN and the libSQL database.",
      },
      { status: 503 },
    );
  }
}
