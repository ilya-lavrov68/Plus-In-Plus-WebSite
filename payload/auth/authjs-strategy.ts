import type { AuthStrategyFunction } from "payload";

import { PAYLOAD_USERS_SLUG } from "../constants.ts";

type StaffRole = "ADMIN" | "FOUNDER";

type PayloadStaffUser = {
  id: number;
  authJsId: string;
  email: string;
  role: StaffRole;
  updatedAt: string;
  createdAt: string;
};

async function findShadowUser(
  payload: Parameters<AuthStrategyFunction>[0]["payload"],
  authJsId: string
): Promise<PayloadStaffUser | null> {
  const result = await payload.find({
    collection: PAYLOAD_USERS_SLUG,
    depth: 0,
    limit: 1,
    // Local API не связан с публичным запросом; вызывается только после requireAdmin().
    overrideAccess: true,
    where: { authJsId: { equals: authJsId } },
  });
  return (result.docs[0] as PayloadStaffUser | undefined) ?? null;
}

/**
 * Payload не получает собственный парольный вход. Каждый запрос заново проверяет
 * revocable Auth.js-сессию и effective role (min из JWT и текущей роли в БД).
 */
export const authenticateAuthJsStaff: AuthStrategyFunction = async ({ payload }) => {
  const { requireAdmin } = await import("@/lib/admin-session");
  const staff = await requireAdmin();
  if (!staff) return { user: null };

  let user = await findShadowUser(payload, staff.id);
  const data = { authJsId: staff.id, email: staff.email, role: staff.role };

  if (!user) {
    try {
      user = (await payload.create({
        collection: PAYLOAD_USERS_SLUG,
        data,
        depth: 0,
        overrideAccess: true,
      })) as PayloadStaffUser;
    } catch (error) {
      // Параллельный первый запрос мог создать ту же уникальную shadow-запись.
      user = await findShadowUser(payload, staff.id);
      if (!user) throw error;
    }
  } else if (user.email !== staff.email || user.role !== staff.role) {
    user = (await payload.update({
      id: user.id,
      collection: PAYLOAD_USERS_SLUG,
      data: { email: staff.email, role: staff.role },
      depth: 0,
      overrideAccess: true,
    })) as PayloadStaffUser;
  }

  return {
    user: {
      ...user,
      collection: PAYLOAD_USERS_SLUG,
      _strategy: "authjs-staff",
    },
  };
};
