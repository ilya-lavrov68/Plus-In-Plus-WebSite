import type { Access, PayloadRequest } from "payload";

export const ACCOUNTS_SLUG = "accounts" as const;

export type StaffRole = "ADMIN" | "FOUNDER" | "MANAGER";

export function payloadRole(req: PayloadRequest): string | null {
  return req.user?.collection === ACCOUNTS_SLUG && typeof req.user.role === "string"
    ? req.user.role
    : null;
}

export function hasPayloadStaff(req: PayloadRequest): boolean {
  const role = payloadRole(req);
  return role === "FOUNDER" || role === "ADMIN" || role === "MANAGER";
}

export function hasPayloadAdmin(req: PayloadRequest): boolean {
  const role = payloadRole(req);
  return role === "FOUNDER" || role === "ADMIN";
}

export function hasPayloadFounder(req: PayloadRequest): boolean {
  return payloadRole(req) === "FOUNDER";
}

export const staffOnly: Access = ({ req }) => hasPayloadStaff(req);
export const adminOnly: Access = ({ req }) => hasPayloadAdmin(req);
export const founderOnly: Access = ({ req }) => hasPayloadFounder(req);
export const serverOnly: Access = () => false;

/** Managers receive customers only when at least one submitted order links them. */
export const readAccounts: Access = async ({ req }) => {
  if (hasPayloadAdmin(req)) return true;
  if (payloadRole(req) !== "MANAGER") return false;

  const orders = await req.payload.find({
    collection: "orders",
    depth: 0,
    overrideAccess: true,
    pagination: false,
    req,
    select: { userId: true },
    where: { status: { not_equals: "cart" } },
  });
  const ids = [...new Set(orders.docs.map((order) => String(order.userId)).filter(Boolean))];
  if (ids.length === 0) return { id: { equals: "__no_customer__" } } as any;
  return {
    and: [
      { id: { in: ids } },
      { role: { equals: "USER" } },
    ],
  } as any;
};

export const readSubmittedOrders: Access = ({ req }) =>
  hasPayloadStaff(req) ? { status: { not_equals: "cart" } } : false;

export function visibleToAdmin(user: object | null | undefined): boolean {
  // ClientUser intentionally exposes only the common Payload shape; the Auth.js
  // strategy adds the current effective role from the accounts collection.
  return (user as { role?: string } | null | undefined)?.role !== "MANAGER";
}
