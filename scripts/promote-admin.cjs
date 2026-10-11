// Grants or revokes the ADMIN role for an existing account.
//
//   npm run db:promote-admin                              → list accounts (id, email, role)
//   npm run db:promote-admin -- owner@example.com          → promote to ADMIN
//   npm run db:promote-admin -- owner@example.com --revoke → back to USER
//
// The app never creates administrators itself (registration always writes USER), so
// this is the supported manual step. It writes directly to the database, bypassing
// validation and the activity log; the change applies to the next login, never to a
// live session. Add the production TURSO_DATABASE_URL / TURSO_AUTH_TOKEN to target
// Turso instead of the local file.
const { loadDatabaseModule } = require("./lib/database-module.cjs");

async function main() {
  const [emailArg, ...flags] = process.argv.slice(2);
  const email = emailArg?.trim().toLowerCase();
  const revoke = flags.includes("--revoke");

  const { resolveDatabaseConfig, describeDatabaseUrl } = loadDatabaseModule();
  const config = resolveDatabaseConfig({ allowDevelopmentFallback: true });
  if (!config) {
    console.error("[admin] No database target. Set TURSO_DATABASE_URL in .env (see .env.example).");
    process.exit(1);
  }

  const { createClient } = require("@libsql/client");
  const client = createClient({ url: config.url, authToken: config.authToken });
  console.log(`[admin] Database: ${describeDatabaseUrl(config.url)}`);

  try {
    if (!email) {
      const rows = await client.execute("select id, email, role, createdAt from users order by createdAt");
      if (rows.rows.length === 0) {
        console.log("[admin] No accounts yet — register in the site first, then promote that email.");
        return;
      }
      for (const row of rows.rows) {
        console.log(`  ${String(row.role).padEnd(5)} ${String(row.email).padEnd(32)} ${String(row.createdAt)}  ${String(row.id)}`);
      }
      console.log("[admin] Promote with: npm run db:promote-admin -- <email>");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      console.error("[admin] Pass a full email address.");
      process.exit(1);
    }

    const existing = await client.execute({ sql: "select id, role from users where email = ?", args: [email] });
    if (existing.rows.length === 0) {
      console.error(`[admin] No account with email ${email}. Register it in the site first.`);
      process.exit(1);
    }

    const role = revoke ? "USER" : "ADMIN";
    if (existing.rows[0].role === role) {
      console.log(`[admin] ${email} already has the ${role} role — nothing to do.`);
      return;
    }

    await client.execute({ sql: "update users set role = ?, updatedAt = ? where email = ?", args: [role, new Date().toISOString().replace("Z", "+00:00"), email] });
    console.log(`[admin] ${email} is now ${role}. Log out, reopen "Log in", enable Admin mode, and log in again.`);
  } finally {
    client.close();
  }
}

main().catch((error) => {
  console.error(`[admin] Failed: ${error.message}`);
  process.exit(1);
});
