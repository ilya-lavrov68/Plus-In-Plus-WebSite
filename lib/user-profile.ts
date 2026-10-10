export const userProfileSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  avatar: true,
  role: true,
} as const;

export interface UserProfile {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatar: string | null;
  /** Effective session role; a regular login never grants admin privileges. */
  role: "USER" | "ADMIN";
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
