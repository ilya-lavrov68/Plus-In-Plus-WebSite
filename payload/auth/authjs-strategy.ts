import type { AuthStrategyFunction } from "payload";

import { roleLevel } from "@/lib/user-profile";
import { ACCOUNTS_SLUG } from "../access.ts";

/**
 * Единый staff-вход остаётся в Auth.js: пароль, обязательная MFA, passkeys и
 * revocable refresh-сессии проверяются до создания Payload request user.
 * Payload не заводит второй пароль и не доверяет роли только из JWT.
 */
export const authenticateAuthJsStaff: AuthStrategyFunction = async ({ payload }) => {
  const { requireStaff } = await import("@/lib/admin-session");
  const staff = await requireStaff();
  if (!staff) return { user: null };

  const result = await payload.find({
    collection: ACCOUNTS_SLUG,
    depth: 0,
    limit: 1,
    overrideAccess: true,
    showHiddenFields: true,
    where: { id: { equals: staff.id } },
  });
  const account = result.docs[0];
  if (!account || account.isBlocked) return { user: null };

  // Effective role is the lower of the Auth.js session role and current DB role.
  const level = Math.min(roleLevel(staff.role), roleLevel(account.role));
  if (level < 1) return { user: null };
  const role = level === 3 ? "FOUNDER" : level === 2 ? "ADMIN" : "MANAGER";
  return {
    user: {
      id: account.id,
      email: account.email,
      firstName: account.firstName ?? null,
      lastName: account.lastName ?? null,
      avatar: account.avatar ?? null,
      avatarMedia: account.avatarMedia ?? null,
      isBlocked: false,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
      role,
      collection: ACCOUNTS_SLUG,
      _strategy: "authjs-staff",
    },
  };
};
