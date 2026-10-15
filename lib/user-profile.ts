/**
 * ADMIN — полный доступ к сайту и к заявкам.
 * MANAGER — только заявки: согласование цены и выставление счёта. Управление
 * сайтом (услуги, блог, пользователи, настройки) ему недоступно.
 */
export type UserRole = "USER" | "MANAGER" | "ADMIN";

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

export function profileName(user: Pick<UserProfile, "firstName" | "lastName">): string {
  return [user.firstName?.trim(), user.lastName?.trim()].filter(Boolean).join(" ");
}

export function profileInitials(user: Pick<UserProfile, "firstName" | "lastName" | "email">): string {
  return [user.firstName?.trim(), user.lastName?.trim()]
    .filter(Boolean)
    .map((name) => Array.from(name!)[0])
    .join("")
    .toLocaleUpperCase() || Array.from(user.email)[0]?.toLocaleUpperCase() || "?";
}
