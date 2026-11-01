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

/** Customer directory is staff-admin only; managers work with submitted orders, not accounts. */
export const readAccounts: Access = ({ req }) => hasPayloadAdmin(req);

export const readSubmittedOrders: Access = ({ req }) =>
  hasPayloadStaff(req) ? { status: { not_equals: "cart" } } : false;

export function visibleToAdmin(user: object | null | undefined): boolean {
  // ClientUser intentionally exposes only the common Payload shape; the Auth.js
  // strategy adds the current effective role from the accounts collection.
  return (user as { role?: string } | null | undefined)?.role !== "MANAGER";
}
