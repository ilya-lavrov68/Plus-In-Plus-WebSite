import { auth } from "@/auth";
import { isAuthConfigured } from "@/lib/auth-secret";
import { prisma } from "@/lib/prisma";
import { roleLevel, type UserRole } from "@/lib/user-profile";

export type { UserRole } from "@/lib/user-profile";

/**
 * Управление сайтом. Основатель проходит сюда же — у него полный доступ,
 * а `isFounder` отличает его там, где обычному админу нельзя (финансы,
 * Settings, заблокированные заказы).
 */
export interface AdminSession {
  id: string;
  email: string;
  role: "ADMIN" | "FOUNDER";
  isFounder: boolean;
}

/** Только основатель: Settings, финансы, снятие блокировки с заказов. */
export interface FounderSession {
  id: string;
  email: string;
  role: "FOUNDER";
  isFounder: true;
}

/** Кто угодно из сотрудников: основатель, администратор или менеджер. */
export interface StaffSession {
  id: string;
  email: string;
  role: "FOUNDER" | "ADMIN" | "MANAGER";
  /** true для ADMIN и FOUNDER — им доступно управление сайтом. */
  isAdmin: boolean;
  /** true только для FOUNDER — ему можно то, что обычному админу нельзя. */
  isFounder: boolean;
}

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
  const level = Math.min(roleLevel(tokenRole), roleLevel(dbRole));
  return level === 3 ? "FOUNDER" : level === 2 ? "ADMIN" : level === 1 ? "MANAGER" : "USER";
}

/** Общая проверка для служебных страниц. */
async function resolveStaff(): Promise<{ id: string; email: string; role: UserRole } | null> {
  try {
    if (!isAuthConfigured() || !prisma) return null;
    const session = await auth();
    if (!session?.user?.id) return null;
    if (roleLevel(session.user.role) < 1) return null;

    const account = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, role: true },
    });
    if (!account?.email) return null;

    const role = effectiveRole(session.user.role, account.role);
    if (roleLevel(role) < 1) return null;

    return { id: account.id, email: account.email, role };
  } catch (error) {
    console.error("Failed to resolve staff session:", error);
    return null;
  }
}

/**
 * Управление сайтом: услуги, блог, пользователи.
 * Пускает администратора и основателя — менеджер не должен иметь
 * возможности что-то сломать на самом сайте.
 */
export async function requireAdmin(): Promise<AdminSession | null> {
  const staff = await resolveStaff();
  if (!staff || roleLevel(staff.role) < 2) return null;
  return {
    id: staff.id,
    email: staff.email,
    role: staff.role === "FOUNDER" ? "FOUNDER" : "ADMIN",
    isFounder: staff.role === "FOUNDER",
  };
}

/**
 * Только основатель: вкладка Settings (ключи Робокассы, токены), финансы
 * и снятие блокировки с заказов. Обычному админу сюда нельзя.
 */
export async function requireFounder(): Promise<FounderSession | null> {
  const staff = await resolveStaff();
  if (staff?.role !== "FOUNDER") return null;
  return { id: staff.id, email: staff.email, role: "FOUNDER", isFounder: true };
}

/**
 * Работа с заявками. Менеджер, администратор и основатель: все согласовывают
 * цену и выставляют счета.
 */
export async function requireStaff(): Promise<StaffSession | null> {
  const staff = await resolveStaff();
  if (!staff) return null;
  return {
    id: staff.id,
    email: staff.email,
    role: staff.role === "FOUNDER" ? "FOUNDER" : staff.role === "ADMIN" ? "ADMIN" : "MANAGER",
    isAdmin: roleLevel(staff.role) >= 2,
    isFounder: staff.role === "FOUNDER",
  };
}
