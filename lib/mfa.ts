import {
  createCipheriv,
  createDecipheriv,
  createHash,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

import { Secret, TOTP } from "otpauth";

import { getAuthSecret, isAuthConfigured } from "@/lib/auth-secret";

const MFA_KEY_INFO = "plus-in-plus/mfa-encryption/v1";
const BACKUP_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const BACKUP_CODE_COUNT = 10;
export const BACKUP_CODE_LENGTH = 12;

function encryptionKey(): Buffer {
  const secret = getAuthSecret();
  if (!isAuthConfigured() || !secret) throw new Error("MFA encryption is not configured.");
  // HKDF separates MFA encryption from Auth.js token signing even though the
  // deployment already has one high-entropy AUTH_SECRET. Rotating it requires
  // MFA re-enrollment; this is called out in the operations guide.
  return Buffer.from(hkdfSync("sha256", secret, "plus-in-plus-mfa-v1", MFA_KEY_INFO, 32));
}

export function encryptMfaSecret(secret: string): string {
  if (!/^[A-Z2-7]{16,128}$/i.test(secret)) throw new Error("Invalid TOTP secret.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret.toUpperCase(), "utf8"), cipher.final()]);
  return ["v1", iv, cipher.getAuthTag(), encrypted]
    .map((part) => (typeof part === "string" ? part : part.toString("base64url")))
    .join(".");
}

export function decryptMfaSecret(payload: string): string {
  const [version, ivValue, tagValue, encryptedValue, extra] = payload.split(".");
  if (version !== "v1" || !ivValue || !tagValue || !encryptedValue || extra) {
    throw new Error("Unsupported MFA secret format.");
  }
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  const secret = Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
  if (!/^[A-Z2-7]{16,128}$/.test(secret)) throw new Error("Invalid decrypted TOTP secret.");
  return secret;
}

export function createTotpSecret(): string {
  return new Secret({ size: 20 }).base32;
}

export function totpUri(secret: string, email: string): string {
  return new TOTP({
    issuer: "Plus In Plus",
    label: email.slice(0, 254),
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret,
  }).toString();
}

export function normalizeTotpCode(value: unknown): string {
  return typeof value === "string" ? value.replace(/[\s-]/g, "") : "";
}

export function verifyTotp(payload: string, value: unknown, timestamp = Date.now()): boolean {
  const token = normalizeTotpCode(value);
  if (!/^\d{6}$/.test(token)) return false;
  try {
    const totp = new TOTP({
      issuer: "Plus In Plus",
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: decryptMfaSecret(payload),
    });
    // One adjacent step tolerates small clock drift without accepting a broad window.
    return totp.validate({ token, timestamp, window: 1 }) !== null;
  } catch {
    return false;
  }
}

function randomBackupCharacter(): string {
  // Rejection sampling avoids modulo bias while keeping an unambiguous alphabet.
  const limit = 256 - (256 % BACKUP_ALPHABET.length);
  for (;;) {
    const value = randomBytes(1)[0];
    if (value < limit) return BACKUP_ALPHABET[value % BACKUP_ALPHABET.length];
  }
}

export function normalizeBackupCode(value: unknown): string {
  return typeof value === "string"
    ? value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, BACKUP_CODE_LENGTH)
    : "";
}

export function hashBackupCode(value: string): string {
  return createHash("sha256").update(normalizeBackupCode(value), "utf8").digest("hex");
}

export function hashesEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function generateBackupCodes(): { codes: string[]; hashes: string[] } {
  const codes = Array.from({ length: BACKUP_CODE_COUNT }, () => {
    const raw = Array.from({ length: BACKUP_CODE_LENGTH }, randomBackupCharacter).join("");
    return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`;
  });
  return { codes, hashes: codes.map(hashBackupCode) };
}
