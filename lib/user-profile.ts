/**
 * Ролевая модель (по возрастанию прав):
 *
 * USER    — клиент: создаёт заявки и видит только свои.
 * MANAGER — только заявки: согласование цены, выставление счёта и блокировка
 *           заказа после фиксации цены. Управление сайтом ему недоступно.
 * ADMIN   — управление сайтом и пользователями (назначает менеджеров),
 *           работает с заявками. НЕ видит финансы и вкладку Settings,
 *           НЕ может трогать основателя и заблокированные заказы.
 * FOUNDER — основатель: полный доступ, включая Settings, финансы и
 *           редактирование заблокированных заказов. Неуязвим: его нельзя
 *           понизить, заблокировать или сбросить ему пароль из админки.
 *           Назначается только скриптом db:promote-admin, не через UI.
 */
export type UserRole = "USER" | "MANAGER" | "ADMIN" | "FOUNDER";

/** Ступень роли: больше — больше прав. Незнакомая строка — всегда 0 (USER). */
export function roleLevel(role: string | null | undefined): number {
  switch (role) {
    case "FOUNDER":
      return 3;
    case "ADMIN":
      return 2;
    case "MANAGER":
      return 1;
    default:
      return 0;
  }
}

/** Строка из базы/токена → роль. Всё незнакомое сводится к USER. */
export function normalizeRole(role: string | null | undefined): UserRole {
  return role === "FOUNDER" || role === "ADMIN" || role === "MANAGER" ? role : "USER";
}

export const userProfileSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  avatar: true,
  role: true,
  isBlocked: true,
} as const;

export interface UserProfile {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatar: string | null;
  /** Effective session role; a regular login never grants staff privileges. */
  role: UserRole;
}

export function profileName(user: { firstName?: string | null; lastName?: string | null }): string {
  return [user.firstName?.trim(), user.lastName?.trim()].filter(Boolean).join(" ");
}

export function profileInitials(user: Pick<UserProfile, "firstName" | "lastName" | "email">): string {
  return [user.firstName?.trim(), user.lastName?.trim()]
    .filter(Boolean)
    .map((name) => Array.from(name!)[0])
    .join("")
    .toLocaleUpperCase() || Array.from(user.email)[0]?.toLocaleUpperCase() || "?";
}
