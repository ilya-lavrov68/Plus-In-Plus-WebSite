import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";

/** Protect data access itself: App Router layouts and pages can render in parallel. */
async function adminDatabase() {
  if (!(await requireAdmin())) redirect("/");
  if (!prisma) throw new Error("Database is not configured.");
  return prisma;
}

export async function getAllServices() {
  const db = await adminDatabase();
  return db.service.findMany({ orderBy: { createdAt: "desc" } });
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

export async function getAdminStats() {
  const db = await adminDatabase();
  const [services, publishedServices, posts, publishedPosts, users, admins] = await Promise.all([
    db.service.count(), db.service.count({ where: { isPublished: true } }),
    db.post.count(), db.post.count({ where: { isPublished: true } }),
    db.user.count(), db.user.count({ where: { role: "ADMIN" } }),
  ]);
  return { services, publishedServices, posts, publishedPosts, users, admins };
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
