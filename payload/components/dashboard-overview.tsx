import Link from "next/link";
import type { Payload } from "payload";

import { getDailySeries, getOrderStats, getTrafficSummary, type DayStat, type OrderStats, type TrafficSummary } from "@/lib/admin-analytics";

const QUEUE = ["pending", "quote_requested", "negotiating", "priced", "awaiting_payment"];

type Props = {
  payload: Payload;
  user?: { role?: string } | null;
  locale?: { code?: string } | null;
};

const EMPTY_ORDER_STATS: OrderStats = { queue: 0, revenue: 0, paidCount: 0, averageOrder: 0 };
const EMPTY_TRAFFIC: TrafficSummary = { views: 0, visitors: 0, sessions: 0, avgSeconds: 0 };

export async function DashboardOverview({ payload, user, locale }: Props) {
  const role = user?.role;
  const isAdmin = role === "ADMIN" || role === "FOUNDER";
  const ru = locale?.code !== "en";
  const submitted = { status: { not_equals: "cart" } };

  // All independent reads start together; managers never trigger account or analytics queries.
  const [orders, queue, recent, services, posts, accounts, activity, orderStats, traffic, daily] = await Promise.all([
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
    isAdmin ? payload.count({ collection: "services", overrideAccess: true }) : Promise.resolve(null),
    isAdmin ? payload.count({ collection: "posts", overrideAccess: true }) : Promise.resolve(null),
    isAdmin ? payload.count({ collection: "accounts", overrideAccess: true }) : Promise.resolve(null),
    isAdmin ? payload.find({
      collection: "activity-logs",
      depth: 0,
      limit: 5,
      overrideAccess: true,
      select: { action: true, title: true },
      sort: "-createdAt",
    }) : Promise.resolve(null),
    isAdmin ? getOrderStats() : Promise.resolve(null),
    isAdmin ? getTrafficSummary(30) : Promise.resolve(null),
    isAdmin ? getDailySeries(7) : Promise.resolve(null),
  ]);

  const stats = orderStats ?? EMPTY_ORDER_STATS;
  const trafficStats = traffic ?? EMPTY_TRAFFIC;
  const days: DayStat[] = daily ?? [];
  const contentCounts: Array<[string, number]> = isAdmin ? [
    [ru ? "Услуги" : "Services", services?.totalDocs ?? 0],
    [ru ? "Материалы" : "Posts", posts?.totalDocs ?? 0],
    [ru ? "Аккаунты" : "Accounts", accounts?.totalDocs ?? 0],
  ] : [];
  const activities = activity?.docs.map((doc: { id: string | number; action: string; title: string }) => ({
    id: String(doc.id),
    action: doc.action,
    title: doc.title,
  })) ?? [];

  const money = new Intl.NumberFormat(ru ? "ru-RU" : "en-GB", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  });
  const number = new Intl.NumberFormat(ru ? "ru-RU" : "en-GB");

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
        {isAdmin ? (
          <>
            <div><dt>{ru ? "Выручка" : "Revenue"}</dt><dd>{money.format(stats.revenue / 100)}</dd></div>
            <div><dt>{ru ? "Оплаченные заказы" : "Paid orders"}</dt><dd>{stats.paidCount}</dd></div>
            <div><dt>{ru ? "Средний заказ" : "Average order"}</dt><dd>{money.format(stats.averageOrder / 100)}</dd></div>
            <div><dt>{ru ? "Просмотры за 30 дней" : "Views over 30 days"}</dt><dd>{number.format(trafficStats.views)}</dd></div>
            <div><dt>{ru ? "Посетители за 30 дней" : "Visitors over 30 days"}</dt><dd>{number.format(trafficStats.visitors)}</dd></div>
          </>
        ) : null}
        {contentCounts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
      <div className="pip-admin-overview__grid">
        <section aria-labelledby="pip-recent-orders">
          <h3 id="pip-recent-orders">{ru ? "Последние заказы" : "Recent orders"}</h3>
          {recent.docs.length ? (
            <ul className="pip-admin-list">
              {recent.docs.map((order: { id: string | number; number?: string | null; orderNumber?: string | null; status?: string | null; total?: number | null }) => (
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
        {isAdmin ? (
          <section aria-labelledby="pip-week-traffic">
            <h3 id="pip-week-traffic">{ru ? "Трафик за 7 дней" : "Traffic over 7 days"}</h3>
            <p>{ru ? `Средняя сессия за 30 дней: ${trafficStats.avgSeconds} с.` : `Average 30-day session: ${trafficStats.avgSeconds} s.`}</p>
            {days.length ? (
              <ul className="pip-admin-list pip-admin-list--plain">
                {days.map((day: DayStat) => (
                  <li key={day.date}>
                    <time dateTime={day.date}>{day.date.slice(5).split("-").reverse().join(".")}</time>
                    <span>{ru ? `${day.views} просм. · ${day.visitors} посет.` : `${day.views} views · ${day.visitors} visitors`}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="pip-admin-empty">{ru ? "Просмотров пока нет." : "No page views yet."}</p>}
          </section>
        ) : null}
      </div>
    </section>
  );
}
