import { auth } from "@/auth";
import { isAuthConfigured } from "@/lib/auth-secret";
import { prisma } from "@/lib/prisma";

export interface AdminSession {
  id: string;
  email: string;
  role: "ADMIN";
}

/** Кто угодно из сотрудников: администратор или менеджер. */
export interface StaffSession {
  id: string;
  email: string;
  role: "ADMIN" | "MANAGER";
  /** true, если это администратор — ему доступно управление сайтом. */
  isAdmin: boolean;
}

export type UserRole = "USER" | "MANAGER" | "ADMIN";

/**
 * Эффективная роль — меньшая из двух: что в подписанном токене и что сейчас
 * в базе.
 *
 * Две ступени нужны по разным причинам. Токен не даёт повыситься задним
 * числом: если вошли менеджером, а в базе потом поставили ADMIN, доступ
 * останется менеджерским до нового входа — иначе токен можно было бы
 * «прокачать», не перелогиниваясь. База не даёт сохранить доступ после
 * увольнения: сняли роль — и токен уже не поможет.
 */
function effectiveRole(tokenRole: string | undefined, dbRole: string | undefined): UserRole {
  const token = tokenRole === "ADMIN" ? 2 : tokenRole === "MANAGER" ? 1 : 0;
  const db = dbRole === "ADMIN" ? 2 : dbRole === "MANAGER" ? 1 : 0;
  const level = Math.min(token, db);
  return level === 2 ? "ADMIN" : level === 1 ? "MANAGER" : "USER";
}

/** Общая проверка для служебных страниц. */
async function resolveStaff(): Promise<{ id: string; email: string; role: UserRole } | null> {
  try {
    if (!isAuthConfigured() || !prisma) return null;
    const session = await auth();
    if (!session?.user?.id) return null;
    if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") return null;

    const account = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, role: true },
    });
    if (!account?.email) return null;

    const role = effectiveRole(session.user.role, account.role);
    if (role !== "ADMIN" && role !== "MANAGER") return null;

    return { id: account.id, email: account.email, role };
  } catch (error) {
    console.error("Failed to resolve staff session:", error);
    return null;
  }
}

/**
 * Управление сайтом: услуги, блог, пользователи, настройки.
 * Сюда пускает только администратора — менеджер не должен иметь возможности
 * что-то сломать на самом сайте.
 */
export async function requireAdmin(): Promise<AdminSession | null> {
  const staff = await resolveStaff();
  if (staff?.role !== "ADMIN") return null;
  return { id: staff.id, email: staff.email, role: "ADMIN" };
}

/**
 * Работа с заявками. Менеджер и администратор: оба согласовывают цену и
 * выставляют счета.
 */
export async function requireStaff(): Promise<StaffSession | null> {
  const staff = await resolveStaff();
  if (!staff) return null;
  return {
    id: staff.id,
    email: staff.email,
    role: staff.role === "ADMIN" ? "ADMIN" : "MANAGER",
    isAdmin: staff.role === "ADMIN",
  };
}
