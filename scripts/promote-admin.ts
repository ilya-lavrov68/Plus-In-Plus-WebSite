import { closePayloadClient, getPayloadClient } from "@/lib/payload-native";

// Server-only runbook. Registration still creates USER; FOUNDER cannot be
// assigned through Admin Panel. Local API hooks revoke existing sessions.
async function main(): Promise<void> {
  const [emailArg, ...flags] = process.argv.slice(2);
  const email = emailArg?.trim().toLowerCase();
  const revoke = flags.includes("--revoke");
  const founder = flags.includes("--founder");
  const manager = flags.includes("--manager");
  if ([revoke, founder, manager].filter(Boolean).length > 1) {
    throw new Error("Choose only one of --founder, --manager or --revoke.");
  }

  const payload = await getPayloadClient();
  if (!email) {
    const accounts = await payload.find({
      collection: "accounts",
      depth: 0,
      pagination: false,
      sort: "createdAt",
      overrideAccess: true,
      select: { email: true, role: true, createdAt: true },
    });
    if (accounts.docs.length === 0) {
      console.log("[admin] No accounts yet — register in the site first, then promote that email.");
      return;
    }
    for (const account of accounts.docs) {
      console.log(`  ${String(account.role).padEnd(7)} ${String(account.email).padEnd(32)} ${String(account.createdAt)}  ${String(account.id)}`);
    }
    console.log("[admin] Promote with: npm run db:promote-admin -- <email> [--founder|--manager|--revoke]");
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Pass a full email address.");
  }
  const existing = await payload.find({
    collection: "accounts",
    depth: 0,
    limit: 1,
    overrideAccess: true,
    select: { role: true },
    where: { email: { equals: email } },
  });
  const account = existing.docs[0];
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

  await payload.update({
    collection: "accounts",
    id: account.id,
    data: { role },
    depth: 0,
    overrideAccess: true,
  });
  console.log(`[admin] ${email} is now ${role}. Existing sessions were revoked; log in again with the required staff mode and MFA.`);
}

main()
  .catch((error) => {
    console.error(`[admin] Failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    process.exitCode = 1;
  })
  .finally(closePayloadClient);
