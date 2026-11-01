import type { CollectionConfig } from "payload";

import { serverOnly } from "../access.ts";

const systemCollection = (
  slug: string,
  labels: { en: string; ru: string },
  fields: CollectionConfig["fields"],
): CollectionConfig => ({
  slug,
  labels: { singular: labels, plural: labels },
  admin: { hidden: true, group: false },
  access: { read: serverOnly, create: serverOnly, update: serverOnly, delete: serverOnly },
  fields,
});

const accountRelation = {
  name: "userId",
  type: "relationship",
  relationTo: "accounts",
  required: true,
  index: true,
  label: { en: "Account", ru: "Аккаунт" },
} as const;

export const PendingLogins = systemCollection("pending-logins", { en: "Pending login", ru: "Ожидание MFA" }, [
  accountRelation,
  { name: "role", type: "select", required: true, defaultValue: "USER", options: ["USER", "MANAGER", "ADMIN", "FOUNDER"] },
  { name: "secretHash", type: "text", required: true },
  { name: "webAuthnChallenge", type: "text" },
  { name: "attempts", type: "number", required: true, defaultValue: 0, min: 0 },
  { name: "expiresAt", type: "date", required: true, index: true },
]);

export const AuthSessions = systemCollection("auth-sessions", { en: "Auth session", ru: "Сессия" }, [
  accountRelation,
  { name: "refreshHash", type: "text", required: true, unique: true },
  { name: "deviceHash", type: "text", required: true },
  { name: "role", type: "select", required: true, defaultValue: "USER", options: ["USER", "MANAGER", "ADMIN", "FOUNDER"] },
  { name: "lastUsedAt", type: "date", required: true },
  { name: "expiresAt", type: "date", required: true, index: true },
  { name: "revokedAt", type: "date", index: true },
  { name: "revokeReason", type: "text", maxLength: 64 },
]);

export const MfaBackupCodes = systemCollection("mfa-backup-codes", { en: "MFA backup code", ru: "Резервный код MFA" }, [
  accountRelation,
  { name: "codeHash", type: "text", required: true, unique: true },
  { name: "usedAt", type: "date", index: true },
]);

export const WebAuthnCredentials = systemCollection("webauthn-credentials", { en: "Passkey", ru: "Passkey" }, [
  accountRelation,
  { name: "publicKey", type: "textarea", required: true },
  { name: "counter", type: "text", required: true, defaultValue: "0" },
  { name: "transports", type: "textarea", required: true, defaultValue: "[]" },
  { name: "name", type: "text", required: true, defaultValue: "Passkey", maxLength: 80 },
  { name: "lastUsedAt", type: "date" },
]);
