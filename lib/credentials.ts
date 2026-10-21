import { CredentialsSignin } from "next-auth";
import bcrypt from "bcryptjs";

import { isAuthConfigured } from "@/lib/auth-secret";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientAddress, hashRateLimitIdentifier } from "@/lib/rate-limit";
import { localAvatarPath } from "@/lib/upload-policy";
import { profileName } from "@/lib/user-profile";

export class AdminAccountNotFound extends CredentialsSignin {
  code = "admin_account_not_found";
}

export class LoginRateLimited extends CredentialsSignin {
  code = "rate_limited";
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
// A timing-only hash, not an account or a usable fallback credential.
const DUMMY_PASSWORD_HASH = "$2b$12$qnL7tEhdPNWWPbkgx8fMpe5U3xM1IRqTjZma3qx4rlEztpzpV21QO";

export async function authorizeCredentials(
  credentials: Partial<Record<"email" | "password" | "adminMode", unknown>>,
  request: Request,
) {
  const email = typeof credentials.email === "string" ? credentials.email.trim().toLowerCase() : "";
  const password = typeof credentials.password === "string" ? credentials.password : "";
  const adminMode = credentials.adminMode === "true";
  const address = getClientAddress(
    request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for"),
  );
  const addressLimit = checkRateLimit(hashRateLimitIdentifier(`login-address:${address}`), 30, LOGIN_WINDOW_MS);
  const accountLimit = checkRateLimit(hashRateLimitIdentifier(`login-account:${address}:${email}`), 8, LOGIN_WINDOW_MS);
  if (!addressLimit.allowed || !accountLimit.allowed) throw new LoginRateLimited();

  if (!isAuthConfigured() || !prisma) return null;
  if (!EMAIL_PATTERN.test(email) || email.length > 254 || !password || Buffer.byteLength(password, "utf8") > 72) {
    if (Buffer.byteLength(password, "utf8") <= 72) await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
    return null;
  }

  let account;
  try {
    account = await prisma.user.findUnique({ where: { email } });
  } catch (error) {
    console.error("Credential lookup failed:", error);
    await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
    return null;
  }

  // Always compare before reporting a failed admin lookup, including for unknown emails.
  const validPassword = await bcrypt.compare(password, account?.passwordHash ?? DUMMY_PASSWORD_HASH);
  // Вход в служебную часть — явный opt-in. FOUNDER, ADMIN и MANAGER
  // проходят, обычный USER нет, даже если включит переключатель.
  const isStaffRole =
    account?.role === "FOUNDER" || account?.role === "ADMIN" || account?.role === "MANAGER";
  if (adminMode && !isStaffRole) {
    throw new AdminAccountNotFound();
  }
  if (!account || !validPassword) return null;
  if (account.isBlocked) return null;

  return {
    id: account.id,
    email: account.email,
    firstName: account.firstName,
    lastName: account.lastName,
    avatar: localAvatarPath(account.avatar),
    name: profileName(account),
    image: localAvatarPath(account.avatar),
    // Staff mode is an explicit privilege opt-in, never a database role mutation.
    // Роль берётся из базы, а не выдумывается: менеджер получает MANAGER,
    // администратор — ADMIN, основатель — FOUNDER. Без opt-in все входят
    // как USER.
    role:
      adminMode && isStaffRole
        ? (account.role as "FOUNDER" | "ADMIN" | "MANAGER")
        : ("USER" as const),
  };
}
