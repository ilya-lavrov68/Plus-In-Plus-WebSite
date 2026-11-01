import { auth } from "@/auth";
import { isAuthConfigured } from "@/lib/auth-secret";
import { getPayloadClient } from "@/lib/payload-native";
import { roleLevel, type UserRole } from "@/lib/user-profile";

export type { UserRole } from "@/lib/user-profile";
export interface AdminSession { id: string; email: string; role: "ADMIN" | "FOUNDER"; isFounder: boolean }
export interface FounderSession { id: string; email: string; role: "FOUNDER"; isFounder: true }
export interface StaffSession { id: string; email: string; role: "FOUNDER" | "ADMIN" | "MANAGER"; isAdmin: boolean; isFounder: boolean }

function effectiveRole(tokenRole: string | undefined, dbRole: string | undefined): UserRole {
  const level = Math.min(roleLevel(tokenRole), roleLevel(dbRole));
  return level === 3 ? "FOUNDER" : level === 2 ? "ADMIN" : level === 1 ? "MANAGER" : "USER";
}
async function resolveStaff(): Promise<{ id: string; email: string; role: UserRole } | null> {
  try {
    if (!isAuthConfigured()) return null;
    const session = await auth();
    if (!session?.user?.id || roleLevel(session.user.role) < 1) return null;
    const payload = await getPayloadClient();
    const result = await payload.find({ collection: "accounts", depth: 0, limit: 1, overrideAccess: true, where: { id: { equals: session.user.id } } });
    const account = result.docs[0];
    if (!account?.email || account.isBlocked) return null;
    const role = effectiveRole(session.user.role, account.role);
    if (roleLevel(role) < 1) return null;
    return { id: account.id, email: account.email, role };
  } catch (error) {
    console.error("Failed to resolve staff session:", error);
    return null;
  }
}
export async function requireAdmin(): Promise<AdminSession | null> {
  const staff = await resolveStaff();
  if (!staff || roleLevel(staff.role) < 2) return null;
  return { id: staff.id, email: staff.email, role: staff.role === "FOUNDER" ? "FOUNDER" : "ADMIN", isFounder: staff.role === "FOUNDER" };
}
export async function requireFounder(): Promise<FounderSession | null> {
  const staff = await resolveStaff();
  if (staff?.role !== "FOUNDER") return null;
  return { id: staff.id, email: staff.email, role: "FOUNDER", isFounder: true };
}
export async function requireStaff(): Promise<StaffSession | null> {
  const staff = await resolveStaff();
  if (!staff) return null;
  return { id: staff.id, email: staff.email, role: staff.role === "FOUNDER" ? "FOUNDER" : staff.role === "ADMIN" ? "ADMIN" : "MANAGER", isAdmin: roleLevel(staff.role) >= 2, isFounder: staff.role === "FOUNDER" };
}
