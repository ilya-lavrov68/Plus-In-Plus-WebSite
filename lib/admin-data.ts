import { redirect } from "next/navigation";

import { requireAdmin, requireFounder, requireStaff } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";

/** Protect data access itself: App Router layouts and pages can render in parallel. */
async function adminDatabase() {
  if (!(await requireAdmin())) redirect("/");
  if (!prisma) throw new Error("Database is not configured.");
  return prisma;
}

export async function getAllServices() {
  const db = await adminDatabase();
  return db.service.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] });
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

export async function getAllServicesWithActiveOrders() {
  const db = await adminDatabase();
  const services = await db.service.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  const counts = new Map<string, number>();
  const dbWithOrder = db as typeof db & {
    order?: {
      findMany?: (args: unknown) => Promise<
        Array<{
          services?: Array<{ serviceId: string }>;
          items?: Array<{ serviceId: string | null }>;
        }>
      >;
    };
  };

  if (typeof dbWithOrder.order?.findMany === "function") {
    try {
      const activeOrders = await dbWithOrder.order.findMany({
        where: { status: { in: ACTIVE_ORDER_STATUSES_ADMIN } },
        select: {
          services: { select: { serviceId: true } },
          items: { select: { serviceId: true } },
        },
      });
      for (const order of activeOrders) {
        const linked = new Set<string>();
        for (const s of order.services ?? []) {
          if (s.serviceId) linked.add(s.serviceId);
        }
        for (const item of order.items ?? []) {
          if (item.serviceId) linked.add(item.serviceId);
        }
        for (const serviceId of linked) {
          counts.set(serviceId, (counts.get(serviceId) ?? 0) + 1);
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
  return db.service.findUnique({ where: { id } });
}

export async function getAllPosts() {
  const db = await adminDatabase();
  return db.post.findMany({ orderBy: { createdAt: "desc" } });
}

export async function getAdminPost(id: string) {
  const db = await adminDatabase();
  return db.post.findUnique({ where: { id } });
}

export async function getAllUsers() {
  const db = await adminDatabase();
  return db.user.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, firstName: true, lastName: true, role: true, createdAt: true },
  });
}

/** Read-only user directory for staff; never returns credentials or account settings. */
export async function getStaffUserDirectory() {
  // The separate staff guard permits a read-only directory in the manager area.
  // Keep the admin guard as a fallback for isolated legacy test doubles.
  const staffGuard = typeof requireStaff === "function" ? requireStaff : requireAdmin;
  if (!(await staffGuard())) redirect("/");
  if (!prisma) throw new Error("Database is not configured.");
  return prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, firstName: true, lastName: true, role: true, createdAt: true },
  });
}

export async function getAdminStats() {
  const db = await adminDatabase();
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const [services, publishedServices, posts, publishedPosts, users, admins] = await Promise.all([
    db.service.count(), db.service.count({ where: { isPublished: true } }),
    db.post.count(), db.post.count({ where: { isPublished: true } }),
    db.user.count(), db.user.count({ where: { role: { in: ["ADMIN", "FOUNDER"] } } }),
  ]);

  let views7d = 0;
  let views30d = 0;
  let recentViews: { createdAt: Date }[] = [];
  try {
    [views7d, views30d, recentViews] = await Promise.all([
      db.pageView.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      db.pageView.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      db.pageView.findMany({ where: { createdAt: { gte: thirtyDaysAgo } }, select: { createdAt: true }, orderBy: { createdAt: "asc" } }),
    ]);
  } catch {
    // The app can be deployed before the optional metrics table is pushed.
  }

  const activityByDay = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(now);
    day.setUTCHours(0, 0, 0, 0);
    day.setUTCDate(day.getUTCDate() - (6 - index));
    const next = new Date(day);
    next.setUTCDate(next.getUTCDate() + 1);
    return {
      label: new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" }).format(day),
      value: recentViews.filter((view) => view.createdAt >= day && view.createdAt < next).length,
    };
  });
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

export async function getUserActivity(userId: string) {
  const db = await adminDatabase();
  return db.activityLog.findMany({
    where: { actorId: userId },
    take: 50,
    orderBy: { createdAt: "desc" },
    select: { id: true, action: true, entityType: true, title: true, createdAt: true },
  });
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
  try {
    const rows = await prisma.siteSetting.findMany();
    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  } catch {
    return {};
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
