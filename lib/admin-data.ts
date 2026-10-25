import { redirect } from "next/navigation";

import { requireAdmin, requireFounder, requireStaff } from "@/lib/admin-session";
import { paginationOffset, ADMIN_PAGE_SIZE } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { SECRET_SITE_SETTING_KEYS, isSecretSiteSettingKey, isSiteSettingKey } from "@/lib/site-settings";
import { parseStoredStoryContent, STORY_SETTING_KEY } from "@/lib/story-content";

/** Protect data access itself: App Router layouts and pages can render in parallel. */
async function adminDatabase() {
  if (!(await requireAdmin())) redirect("/");
  if (!prisma) throw new Error("Database is not configured.");
  return prisma;
}

export async function getAllServices(page = 1) {
  const db = await adminDatabase();
  return db.service.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }, { id: "desc" }],
    skip: paginationOffset(page),
    take: ADMIN_PAGE_SIZE,
  });
}

export async function getAdminServiceCount() {
  const db = await adminDatabase();
  return db.service.count();
}

const ACTIVE_ORDER_STATUSES_ADMIN = [
  "pending",
  "quote_requested",
  "negotiating",
  "priced",
  "awaiting_payment",
  "paid",
  "in_progress",
];

export async function getAllServicesWithActiveOrders(page = 1) {
  const db = await adminDatabase();
  const services = await db.service.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }, { id: "desc" }],
    skip: paginationOffset(page),
    take: ADMIN_PAGE_SIZE,
  });

  const counts = new Map<string, number>();
  const serviceIds = services.map((service) => service.id);
  const dbWithRelations = db as typeof db & {
    orderService?: {
      groupBy?: (args: unknown) => Promise<Array<{ serviceId: string; orderId: string }>>;
    };
    orderItem?: {
      groupBy?: (args: unknown) => Promise<Array<{ serviceId: string | null; orderId: string }>>;
    };
    order?: {
      findMany?: (args: unknown) => Promise<Array<{
        services?: Array<{ serviceId: string }>;
        items?: Array<{ serviceId: string | null }>;
      }>>;
    };
  };

  if (serviceIds.length > 0) {
    try {
      if (
        typeof dbWithRelations.orderService?.groupBy === "function" &&
        typeof dbWithRelations.orderItem?.groupBy === "function"
      ) {
        // Group by both keys so multiple configured lines in one order still
        // count as one active order. No unbounded order/relation rows are read.
        const [legacyLinks, itemLinks] = await Promise.all([
          dbWithRelations.orderService.groupBy({
            by: ["serviceId", "orderId"],
            where: {
              serviceId: { in: serviceIds },
              order: { status: { in: ACTIVE_ORDER_STATUSES_ADMIN } },
            },
          }),
          dbWithRelations.orderItem.groupBy({
            by: ["serviceId", "orderId"],
            where: {
              serviceId: { in: serviceIds },
              order: { status: { in: ACTIVE_ORDER_STATUSES_ADMIN } },
            },
          }),
        ]);
        // A legacy and a unified link can refer to the same order. Usually the
        // order id differs per row here, so deduplicate each service/order pair.
        const linkedOrders = new Set<string>();
        for (const row of [...legacyLinks, ...itemLinks]) {
          if (row.serviceId) linkedOrders.add(`${row.serviceId}:${row.orderId}`);
        }
        for (const key of linkedOrders) {
          const serviceId = key.slice(0, key.indexOf(":"));
          counts.set(serviceId, (counts.get(serviceId) ?? 0) + 1);
        }
      } else if (typeof dbWithRelations.order?.findMany === "function") {
        // Compatibility for legacy isolated test doubles; real Prisma uses
        // the grouped path above.
        const activeOrders = await dbWithRelations.order.findMany({
          where: { status: { in: ACTIVE_ORDER_STATUSES_ADMIN } },
          select: {
            services: { select: { serviceId: true } },
            items: { select: { serviceId: true } },
          },
        });
        for (const order of activeOrders) {
          const linked = new Set<string>();
          for (const link of order.services ?? []) linked.add(link.serviceId);
          for (const item of order.items ?? []) {
            if (item.serviceId) linked.add(item.serviceId);
          }
          for (const serviceId of linked) {
            counts.set(serviceId, (counts.get(serviceId) ?? 0) + 1);
          }
        }
      }
    } catch {
      // Fall back to 0 active order badges if order tables aren't initialized yet.
    }
  }

  return services.map((service) => ({
    ...service,
    activeOrderCount: counts.get(service.id) ?? 0,
  }));
}

export async function getAdminService(id: string) {
  const db = await adminDatabase();
  return db.service.findUnique({
    where: { id },
    include: {
      optionGroups: {
        orderBy: { sortOrder: "asc" },
        include: { options: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });
}

export async function getAllPosts(page = 1) {
  const db = await adminDatabase();
  return db.post.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: paginationOffset(page),
    take: ADMIN_PAGE_SIZE,
  });
}

export async function getAdminPostCount() {
  const db = await adminDatabase();
  return db.post.count();
}

export async function getAdminPost(id: string) {
  const db = await adminDatabase();
  return db.post.findUnique({ where: { id } });
}

export async function getAllUsers(page = 1) {
  const db = await adminDatabase();
  return db.user.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: paginationOffset(page),
    take: ADMIN_PAGE_SIZE,
    select: { id: true, email: true, firstName: true, lastName: true, role: true, createdAt: true },
  });
}

export async function getAdminUserCount() {
  const db = await adminDatabase();
  return db.user.count();
}

async function staffDatabase() {
  const staffGuard = typeof requireStaff === "function" ? requireStaff : requireAdmin;
  if (!(await staffGuard())) redirect("/");
  if (!prisma) throw new Error("Database is not configured.");
  return prisma;
}

/** Read-only customers attached to non-cart orders; never a general staff/user directory. */
export async function getStaffUserDirectory(page = 1) {
  const db = await staffDatabase();
  const customers = await db.user.findMany({
    where: { role: "USER", orders: { some: { status: { not: "cart" } } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: paginationOffset(page),
    take: ADMIN_PAGE_SIZE,
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      createdAt: true,
      _count: { select: { orders: { where: { status: { not: "cart" } } } } },
    },
  });
  return customers.map(({ _count, ...customer }) => ({
    ...customer,
    orderCount: _count.orders,
  }));
}

export async function getStaffUserCount() {
  const db = await staffDatabase();
  return db.user.count({
    where: { role: "USER", orders: { some: { status: { not: "cart" } } } },
  });
}

export async function getAdminStats(locale = "en") {
  const db = await adminDatabase();
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const [services, publishedServices, posts, publishedPosts, users, admins] = await Promise.all([
    db.service.count(), db.service.count({ where: { isPublished: true } }),
    db.post.count(), db.post.count({ where: { isPublished: true } }),
    db.user.count(), db.user.count({ where: { role: { in: ["ADMIN", "FOUNDER"] } } }),
  ]);

  const days = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(now);
    day.setUTCHours(0, 0, 0, 0);
    day.setUTCDate(day.getUTCDate() - (6 - index));
    const next = new Date(day);
    next.setUTCDate(next.getUTCDate() + 1);
    return {
      day,
      next,
      label: new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-GB", { weekday: "short", timeZone: "UTC" }).format(day),
    };
  });
  let views7d = 0;
  let views30d = 0;
  let dailyViews: number[] = Array.from({ length: 7 }, () => 0);
  try {
    [views7d, views30d, ...dailyViews] = await Promise.all([
      db.pageView.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      db.pageView.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      ...days.map(({ day, next }) => db.pageView.count({
        where: { createdAt: { gte: day, lt: next } },
      })),
    ]);
  } catch {
    // The app can be deployed before the optional metrics table is pushed.
  }

  // Seven aggregate results replace an unbounded read of raw page-view rows.
  const activityByDay = days.map((day, index) => ({
    label: day.label,
    value: dailyViews[index] ?? 0,
  }));
  return { services, publishedServices, posts, publishedPosts, users, admins, views7d, views30d, activityByDay };
}

export async function getRecentActivity() {
  const db = await adminDatabase();
  return db.activityLog.findMany({
    take: 20,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true, action: true, entityType: true, title: true, createdAt: true,
      actor: { select: { email: true } },
    },
  });
}

export async function getUserBlockStatuses(ids: string[]) {
  const db = await adminDatabase();
  const rows = await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, isBlocked: true } });
  return Object.fromEntries(rows.map((row) => [row.id, row.isBlocked]));
}

/** Relation pagination returns 50 entries per user, not 50 across the whole page. */
export async function getUserActivities(userIds: string[]) {
  const db = await adminDatabase();
  const ids = [...new Set(userIds)].slice(0, ADMIN_PAGE_SIZE);
  if (ids.length === 0) return {} as Record<string, never[]>;
  const rows = await db.user.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      activities: {
        take: 50,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { id: true, action: true, entityType: true, title: true, createdAt: true },
      },
    },
  });
  const grouped = new Map(rows.map((row) => [row.id, row.activities]));
  return Object.fromEntries(ids.map((id) => [id, grouped.get(id) ?? []]));
}

export async function getUserActivity(userId: string) {
  const db = await adminDatabase();
  return db.activityLog.findMany({
    where: { actorId: userId },
    take: 50,
    orderBy: { createdAt: "desc" },
    select: { id: true, action: true, entityType: true, title: true, createdAt: true },
  });
}

export async function getAdminStoryContent() {
  const db = await adminDatabase();
  const row = await db.siteSetting.findUnique({
    where: { key: STORY_SETTING_KEY },
    select: { value: true },
  });
  return parseStoredStoryContent(row?.value);
}

export async function getSiteSettings() {
  const founderGuard =
    typeof requireFounder === "function"
      ? requireFounder
      : async () => {
          const account = await requireAdmin();
          return account && account.role === "FOUNDER" ? account : null;
        };
  if (!(await founderGuard())) redirect("/");
  if (!prisma) throw new Error("Database is not configured.");
  const emptySecrets = () => Object.fromEntries(SECRET_SITE_SETTING_KEYS.map((key) => [key, false]));
  try {
    const rows = await prisma.siteSetting.findMany({ select: { key: true, value: true } });
    const values: Record<string, string> = {};
    const secrets: Record<string, boolean> = emptySecrets();
    for (const row of rows) {
      if (!isSiteSettingKey(row.key)) continue;
      if (isSecretSiteSettingKey(row.key)) secrets[row.key] = Boolean(row.value);
      else values[row.key] = row.value;
    }
    return { values, secrets };
  } catch {
    return { values: {}, secrets: emptySecrets() };
  }
}

export async function getFeaturedCandidates() {
  const db = await adminDatabase();
  return db.post.findMany({
    where: { isPublished: true, OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }] },
    orderBy: [{ isFeatured: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
    select: { id: true, title: true, isFeatured: true },
  });
}
