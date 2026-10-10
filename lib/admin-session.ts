import { getServerSession } from "next-auth";

import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";

export interface AdminSession {
  id: string;
  email: string;
  role: "USER" | "ADMIN";
}

/**
 * Server-side guard for admin-only operations (server actions and pages).
 * Returns the admin's session user, or null when the caller is not an ADMIN.
 */
export async function requireAdmin(): Promise<AdminSession | null> {
  try {
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret || secret.length < 32) return null;

    const session = await getServerSession(authOptions);
    const user = session?.user;
    if (!user?.id || user.role !== "ADMIN" || !prisma) {
      return null;
    }
    // JWT roles may be stale after an account is demoted or deleted. Enforce
    // current database role on every privileged request, not just at login.
    const account = await prisma.user.findUnique({ where: { id: user.id } });
    if (account?.role !== "ADMIN") return null;
    return { id: account.id, email: account.email, role: account.role };
  } catch (error) {
    console.error("Failed to resolve admin session:", error);
    return null;
  }
}
