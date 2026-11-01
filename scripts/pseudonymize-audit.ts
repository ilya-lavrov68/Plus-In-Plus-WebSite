import { looksLikeContactOrNetworkText, pseudonymizeActivityRecord } from "@/lib/audit-retention";
import { closePayloadClient, getPayloadClient, payloadId, withPayloadTransaction } from "@/lib/payload-native";

const BATCH_SIZE = 500;

function argument(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.slice(3).find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

async function main(): Promise<void> {
  const payload = await getPayloadClient();
  const days = Number(argument("older-than-days") ?? "365");
  if (!Number.isSafeInteger(days) || days < 1 || days > 3650) {
    throw new Error("older-than-days must be an integer from 1 to 3650");
  }
  const apply = process.argv.includes("--apply");
  if (apply && argument("confirm") !== "PSEUDONYMIZE") {
    throw new Error("Apply requires --confirm=PSEUDONYMIZE");
  }
  const key = process.env.AUDIT_PSEUDONYM_KEY;
  if (apply && (!key || key.length < 32)) {
    throw new Error("Apply requires AUDIT_PSEUDONYM_KEY with at least 32 characters");
  }

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  let cursor: string | undefined;
  let scanned = 0;
  let candidates = 0;
  let changed = 0;
  do {
    const result = await payload.find({
      collection: "activity-logs",
      depth: 0,
      limit: BATCH_SIZE,
      sort: "id",
      overrideAccess: true,
      select: { actorId: true, actorPseudonym: true, title: true },
      where: {
        and: [
          { createdAt: { less_than: cutoff.toISOString() } },
          ...(cursor ? [{ id: { greater_than: cursor } }] : []),
        ],
      },
    });
    const rows = result.docs.map((row) => ({
      ...row,
      actorId: payloadId(row.actorId),
      actorPseudonym: row.actorPseudonym ?? null,
    }));
    if (!rows.length) break;
    scanned += rows.length;
    const updates = rows.flatMap((row) => {
      const candidate = row.actorId !== null || looksLikeContactOrNetworkText(row.title);
      if (candidate) candidates += 1;
      if (!apply || !candidate) return [];
      const next = pseudonymizeActivityRecord(row, key!);
      if (!next.changed) return [];
      changed += 1;
      return [{ id: row.id, actorPseudonym: next.actorPseudonym, title: next.title }];
    });
    if (updates.length) {
      await withPayloadTransaction(payload, async (req) => {
        for (const update of updates) {
          await payload.update({
            collection: "activity-logs",
            id: update.id,
            data: { actorId: null, actorPseudonym: update.actorPseudonym, title: update.title },
            overrideAccess: true,
            req,
          });
        }
      });
    }
    cursor = rows[rows.length - 1]?.id;
    if (rows.length < BATCH_SIZE) break;
  } while (true);

  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    olderThanDays: days,
    scanned,
    candidates,
    changed,
    note: apply
      ? "Direct actor links were removed and identifiers were pseudonymized. Verify application audit views."
      : "No rows were changed. Review the retention policy and take a verified backup before applying.",
  }));
}

main()
  .catch(() => {
    console.error("Audit retention job failed. Check the runbook and database health without exposing secrets.");
    process.exitCode = 1;
  })
  .finally(closePayloadClient);
