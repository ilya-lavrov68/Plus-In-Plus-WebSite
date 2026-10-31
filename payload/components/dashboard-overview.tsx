import Link from "next/link";
import type { Payload } from "payload";

const QUEUE = ["pending", "quote_requested", "negotiating", "priced", "awaiting_payment"];

type Props = {
  payload: Payload;
  user?: { role?: string } | null;
  locale?: { code?: string } | null;
};

export async function DashboardOverview({ payload, user, locale }: Props) {
  const role = user?.role;
  const isAdmin = role === "ADMIN" || role === "FOUNDER";
  const ru = locale?.code !== "en";
  const submitted = { status: { not_equals: "cart" } };

  const [orders, queue, recent] = await Promise.all([
    payload.count({ collection: "orders", overrideAccess: true, where: submitted }),
    payload.count({ collection: "orders", overrideAccess: true, where: { status: { in: QUEUE } } }),
    payload.find({
      collection: "orders",
      depth: 0,
      limit: 5,
      overrideAccess: true,
      select: { number: true, orderNumber: true, status: true, total: true },
      sort: "-createdAt",
      where: submitted,
    }),
  ]);

  let contentCounts: Array<[string, number]> = [];
  let activities: Array<{ id: string; action: string; title: string }> = [];
  if (isAdmin) {
    const [services, posts, accounts, activity] = await Promise.all([
      payload.count({ collection: "services", overrideAccess: true }),
      payload.count({ collection: "posts", overrideAccess: true }),
      payload.count({ collection: "accounts", overrideAccess: true }),
      payload.find({
        collection: "activity-logs",
        depth: 0,
        limit: 5,
        overrideAccess: true,
        select: { action: true, title: true },
        sort: "-createdAt",
      }),
    ]);
    contentCounts = [
      [ru ? "Услуги" : "Services", services.totalDocs],
      [ru ? "Материалы" : "Posts", posts.totalDocs],
      [ru ? "Аккаунты" : "Accounts", accounts.totalDocs],
    ];
    activities = activity.docs.map((doc) => ({ id: String(doc.id), action: doc.action, title: doc.title }));
  }

  const money = new Intl.NumberFormat(ru ? "ru-RU" : "en-GB", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  });

  return (
    <section className="pip-admin-overview" aria-labelledby="pip-admin-overview-title">
      <div className="pip-admin-overview__heading">
        <div>
          <p className="pip-admin-eyebrow">Plus In Plus</p>
          <h2 id="pip-admin-overview-title">{ru ? "Рабочий обзор" : "Operations overview"}</h2>
        </div>
        <Link href="/admin/collections/orders">{ru ? "Все заказы" : "All orders"}</Link>
      </div>
      <dl className="pip-admin-metrics">
        <div><dt>{ru ? "Оформленные заказы" : "Submitted orders"}</dt><dd>{orders.totalDocs}</dd></div>
        <div><dt>{ru ? "Требуют решения" : "In the queue"}</dt><dd>{queue.totalDocs}</dd></div>
        {contentCounts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
      <div className="pip-admin-overview__grid">
        <section aria-labelledby="pip-recent-orders">
          <h3 id="pip-recent-orders">{ru ? "Последние заказы" : "Recent orders"}</h3>
          {recent.docs.length ? (
            <ul className="pip-admin-list">
              {recent.docs.map((order) => (
                <li key={String(order.id)}>
                  <Link href={`/admin/collections/orders/${order.id}`}>
                    <span>{order.number ?? order.orderNumber ?? order.id}</span>
                    <span>{order.status} · {money.format(Number(order.total ?? 0) / 100)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="pip-admin-empty">{ru ? "Оформленных заказов пока нет." : "No submitted orders yet."}</p>}
        </section>
        {isAdmin ? (
          <section aria-labelledby="pip-recent-activity">
            <h3 id="pip-recent-activity">{ru ? "Последние действия" : "Recent activity"}</h3>
            {activities.length ? (
              <ul className="pip-admin-list pip-admin-list--plain">
                {activities.map((item) => <li key={item.id}><span>{item.title}</span><span>{item.action}</span></li>)}
              </ul>
            ) : <p className="pip-admin-empty">{ru ? "Журнал пока пуст." : "No activity yet."}</p>}
          </section>
        ) : null}
      </div>
    </section>
  );
}
