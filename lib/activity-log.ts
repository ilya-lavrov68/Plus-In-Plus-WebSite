import type { Prisma } from "@/lib/generated/prisma/client";

export interface ActivityInput {
  action: string;
  /** "order" добавлен вместе с заявками на расчёт и заказами. */
  entityType: "service" | "post" | "user" | "setting" | "order";
  entityId: string;
  title: string;
  actorId: string;
}

/** Use the mutation's transaction: an audit entry must not outlive a failed write. */
export async function recordActivity(tx: Prisma.TransactionClient, activity: ActivityInput) {
  await tx.activityLog.create({ data: activity });
}
