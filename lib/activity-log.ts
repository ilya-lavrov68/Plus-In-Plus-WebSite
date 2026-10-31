import type { PayloadTransactionClient } from "@/lib/payload-db";

export interface ActivityInput {
  action: string;
  /** "order" добавлен вместе с заявками на расчёт и заказами. */
  entityType: "service" | "post" | "user" | "setting" | "order";
  entityId: string;
  title: string;
  /** Кто сделал. Пусто у системных событий — например, оплата пришла через
   *  уведомление платёжного шлюза, и вошедшего пользователя в этот момент нет. */
  actorId?: string | null;
}

/** Use the mutation's transaction: an audit entry must not outlive a failed write. */
export async function recordActivity(tx: PayloadTransactionClient, activity: ActivityInput) {
  await tx.activityLog.create({ data: activity });
}
