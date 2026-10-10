import { auth } from "@/auth";
import { isAuthConfigured } from "@/lib/auth-secret";
import { prisma } from "@/lib/prisma";

export interface AdminSession {
  id: string;
  email: string;
  role: "ADMIN";
}

/** Defense in depth: JWT privilege AND current DB role, on every privileged operation. */
export async function requireAdmin(): Promise<AdminSession | null> {
  try {
    if (!isAuthConfigured() || !prisma) return null;
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") return null;

    const account = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, role: true },
    });
    if (account?.role !== "ADMIN") return null;
    return { id: account.id, email: account.email, role: "ADMIN" };
  } catch (error) {
    console.error("Failed to resolve admin session:", error);
    return null;
  }
}
