import type { Payload, PayloadRequest } from "payload";

export interface ActivityInput {
  action: string;
  /** "order" добавлен вместе с заявками на расчёт и заказами. */
  entityType: "service" | "post" | "user" | "setting" | "order" | "media";
  entityId: string;
  title: string;
  /** Пусто у системных событий, например у серверного уведомления платёжного шлюза. */
  actorId?: string | null;
}

/** Запись создаётся в transaction исходной mutation через native Payload Local API. */
export async function recordActivity(
  payload: Payload,
  req: PayloadRequest,
  activity: ActivityInput,
): Promise<void> {
  await payload.create({
    collection: "activity-logs",
    data: activity,
    overrideAccess: true,
    req,
  });
}
