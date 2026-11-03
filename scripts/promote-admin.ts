import { findAccountByEmail, updateAccount } from "@/lib/accounts";
import { revokeAllAuthSessions } from "@/lib/auth-session-revoke";
import { closeDb, rows } from "@/lib/db";

// Server-only runbook. Registration still creates USER; FOUNDER cannot be
// assigned through the admin panel. Role changes revoke every live session.
async function main(): Promise<void> {
  const [emailArg, ...flags] = process.argv.slice(2);
  const email = emailArg?.trim().toLowerCase();
  const revoke = flags.includes("--revoke");
  const founder = flags.includes("--founder");
  const manager = flags.includes("--manager");
  if ([revoke, founder, manager].filter(Boolean).length > 1) {
    throw new Error("Choose only one of --founder, --manager or --revoke.");
  }

  if (!email) {
    const accounts = await rows<{ id: string; email: string; role: string; created_at: string }>(
      `select id, email, role, created_at from accounts order by created_at`,
    );
    if (accounts.length === 0) {
      console.log("[admin] No accounts yet — register in the site first, then promote that email.");
      return;
    }
    for (const account of accounts) {
      console.log(`  ${String(account.role).padEnd(7)} ${String(account.email).padEnd(32)} ${String(account.created_at)}  ${account.id}`);
    }
    console.log("[admin] Promote with: npm run db:promote-admin -- <email> [--founder|--manager|--revoke]");
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Pass a full email address.");
  }
  const account = await findAccountByEmail(email);
  if (!account) throw new Error("No account with this email. Register it in the site first.");

  const role = revoke ? "USER" : founder ? "FOUNDER" : manager ? "MANAGER" : "ADMIN";
  if (account.role === role) {
    console.log(`[admin] ${email} already has the ${role} role — nothing to do.`);
    return;
  }
  if (account.role === "FOUNDER" && role !== "FOUNDER") {
    console.warn(`[admin] WARNING: ${email} is the FOUNDER. Demoting to ${role} removes founder protection (Settings, finances, locked orders).`);
  }
  if (role === "FOUNDER") {
    console.warn(`[admin] NOTE: FOUNDER is invulnerable in the admin UI and sees Settings/finances. Keep exactly one founder account.`);
  }

  await updateAccount(account.id, { role });
  // Раньше сессии отзывал Payload-хук; теперь это явное действие.
  await revokeAllAuthSessions(account.id, "role_changed");
  console.log(`[admin] ${email} is now ${role}. Existing sessions were revoked; log in again with the required staff mode and MFA.`);
}

main()
  .catch((error) => {
    console.error(`[admin] Failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    process.exitCode = 1;
  })
  .finally(closeDb);
