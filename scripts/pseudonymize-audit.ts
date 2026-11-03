import { looksLikeContactOrNetworkText, pseudonymizeActivityRecord } from "@/lib/audit-retention";
import { closeDb, rows, withTransaction } from "@/lib/db";

const BATCH_SIZE = 500;

function argument(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.slice(3).find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

async function main(): Promise<void> {
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

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  let cursor: string | undefined;
  let scanned = 0;
  let candidates = 0;
  let changed = 0;
  do {
    // Курсорная пагинация по id: батч не сдвигается, пока идут правки.
    const batch = await rows<{ id: string; actorId: string | null; actorPseudonym: string | null; title: string }>(
      `select id, actor_id_id as actorId, actor_pseudonym as actorPseudonym, title
       from activity_logs
       where created_at < ? ${cursor ? "and id > ?" : ""}
       order by id
       limit ?`,
      cursor ? [cutoff, cursor, BATCH_SIZE] : [cutoff, BATCH_SIZE],
    );
    if (!batch.length) break;
    scanned += batch.length;
    const updates = batch.flatMap((row) => {
      const candidate = row.actorId !== null || looksLikeContactOrNetworkText(row.title);
      if (candidate) candidates += 1;
      if (!apply || !candidate) return [];
      const next = pseudonymizeActivityRecord(row, key!);
      if (!next.changed) return [];
      changed += 1;
      return [{ id: row.id, actorPseudonym: next.actorPseudonym, title: next.title }];
    });
    if (updates.length) {
      await withTransaction(async (tx) => {
        for (const update of updates) {
          await tx.run(
            `update activity_logs set actor_id_id = null, actor_pseudonym = ?, title = ?, updated_at = ?
             where id = ?`,
            [update.actorPseudonym, update.title, new Date().toISOString(), update.id],
          );
        }
      });
    }
    cursor = batch[batch.length - 1]?.id;
    if (batch.length < BATCH_SIZE) break;
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
  .finally(closeDb);
