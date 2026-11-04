import { CredentialsSignin } from "next-auth";
import bcrypt from "bcryptjs";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { consumeBackupCode, findAccountWithPasskeysByEmail, updatePasskeyCounter } from "@/lib/accounts";
import { isAuthConfigured } from "@/lib/auth-secret";
import { rotateAuthSession } from "@/lib/auth-sessions";
import { parseJsonArray } from "@/lib/db-helpers";
import { hashBackupCode, normalizeBackupCode, verifyTotp } from "@/lib/mfa";
import {
  consumePendingLogin,
  createPendingLogin,
  readPendingLogin,
  recordPendingLoginFailure,
} from "@/lib/pending-login";
import { checkRateLimitAsync, getClientAddress, hashRateLimitIdentifier, progressiveLoginDelayMs } from "@/lib/rate-limit";
import { logSecurityEvent, logServerError } from "@/lib/security-log";
import { localAvatarPath } from "@/lib/upload-policy";
import { profileName, type UserRole } from "@/lib/user-profile";
import { webAuthnConfigFromRequest } from "@/lib/webauthn-config";
type AuthenticationResponseJSON = Parameters<typeof verifyAuthenticationResponse>[0]["response"];

const MAX_WEBAUTHN_RESPONSE_LENGTH = 16_384;

/** Auth.js delivers credentials text fields as strings, never as nested objects. */
function parseWebAuthnResponse(value: unknown): AuthenticationResponseJSON | null {
  if (typeof value !== "string" || !value || value.length > MAX_WEBAUTHN_RESPONSE_LENGTH) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as AuthenticationResponseJSON;
  } catch {
    return null;
  }
}

export class LoginRateLimited extends CredentialsSignin {
  code = "rate_limited";
}

export class MfaRequired extends CredentialsSignin {
  code = "mfa_required";
  pendingLoginId: string;
  pendingLoginSecret: string;
  hasTotp: boolean;
  hasPasskeys: boolean;

  constructor(
    pending: { pendingLoginId: string; pendingLoginSecret: string },
    factors: { hasTotp: boolean; hasPasskeys: boolean },
  ) {
    super();
    this.pendingLoginId = pending.pendingLoginId;
    this.pendingLoginSecret = pending.pendingLoginSecret;
    this.hasTotp = factors.hasTotp;
    this.hasPasskeys = factors.hasPasskeys;
  }
}

export class MfaInvalid extends CredentialsSignin {
  code = "mfa_invalid";
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_ADDRESS_LIMIT = 10;
const LOGIN_ACCOUNT_LIMIT = 5;
const MFA_LIMIT = 5;
// A timing-only hash, not an account or a usable fallback credential.
const DUMMY_PASSWORD_HASH = "$2b$12$qnL7tEhdPNWWPbkgx8fMpe5U3xM1IRqTjZma3qx4rlEztpzpV21QO";

type CredentialFields =
  | "email"
  | "password"
  | "adminMode"
  | "refreshToken"
  | "deviceId"
  | "pendingLoginId"
  | "pendingLoginSecret"
  | "mfaCode"
  | "webAuthnResponse";

function sessionUser(account: {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  avatar?: string | null;
}, role: UserRole) {
  const firstName = account.firstName ?? null;
  const lastName = account.lastName ?? null;
  const avatar = localAvatarPath(account.avatar ?? null);
  return {
    id: account.id,
    email: account.email,
    firstName,
    lastName,
    avatar,
    name: profileName({ firstName, lastName }),
    image: avatar,
    role,
  };
}

async function authorizeRefresh(credentials: Partial<Record<CredentialFields, unknown>>) {
  if (typeof credentials.refreshToken !== "string" || typeof credentials.deviceId !== "string") return null;
  try {
    const rotated = await rotateAuthSession(credentials.refreshToken, credentials.deviceId);
    if (!rotated) return null;
    return {
      ...sessionUser(rotated.user, rotated.role),
      sessionId: rotated.sessionId,
      deviceHash: rotated.deviceHash,
      refreshEstablished: true,
    };
  } catch (error) {
    logServerError("auth.session.refresh_failed", error);
    return null;
  }
}

async function authorizePendingLogin(
  credentials: Partial<Record<CredentialFields, unknown>>,
  request: Request,
) {
  const pendingLoginId = typeof credentials.pendingLoginId === "string" ? credentials.pendingLoginId : "";
  const pendingLoginSecret = typeof credentials.pendingLoginSecret === "string" ? credentials.pendingLoginSecret : "";
  const address = getClientAddress(request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for"));
  const limit = await checkRateLimitAsync(
    hashRateLimitIdentifier(`mfa:${address}:${pendingLoginId.slice(0, 128)}`),
    MFA_LIMIT,
    LOGIN_WINDOW_MS,
  );
  if (!limit.allowed) {
    logSecurityEvent("auth.mfa.rate_limited");
    throw new LoginRateLimited();
  }
  const pending = await readPendingLogin(pendingLoginId, pendingLoginSecret);
  if (!pending) return null;

  let verified = false;
  const rawResponse = credentials.webAuthnResponse;
  const hasWebAuthnResponse = rawResponse !== undefined && rawResponse !== null && rawResponse !== "";
  if (hasWebAuthnResponse) {
    // A malformed passkey payload must not silently fall back to the TOTP/backup
    // branch. In particular, "[object Object]" is the legacy serialization bug,
    // not an empty authenticator code.
    const assertion = parseWebAuthnResponse(rawResponse);
    const stored = assertion
      ? pending.user.webAuthnCredentials.find((credential: { id: string }) => credential.id === assertion.id)
      : undefined;
    if (assertion && stored && pending.webAuthnChallenge) {
      try {
        const config = webAuthnConfigFromRequest(request);
        const verification = await verifyAuthenticationResponse({
          response: assertion,
          expectedChallenge: pending.webAuthnChallenge,
          expectedOrigin: config.origin,
          expectedRPID: config.rpID,
          requireUserVerification: true,
          credential: {
            id: stored.id,
            publicKey: Buffer.from(stored.publicKey, "base64url"),
            counter: Number(stored.counter),
            transports: parseJsonArray(stored.transports),
          },
        });
        if (verification.verified) {
          await updatePasskeyCounter(stored.id, String(verification.authenticationInfo.newCounter));
          verified = true;
        }
      } catch (error) {
        logServerError("auth.mfa.verify_failed", error);
      }
    }
  } else {
    const code = typeof credentials.mfaCode === "string" ? credentials.mfaCode : "";
    if (pending.user.mfaSecret && verifyTotp(pending.user.mfaSecret, code)) {
      verified = true;
    } else {
      const normalized = normalizeBackupCode(code);
      if (normalized.length === 12) {
        verified = await consumeBackupCode(pending.user.id, hashBackupCode(normalized));
      }
    }
  }

  if (!verified || !(await consumePendingLogin(pending.id, pending.secretHash))) {
    await recordPendingLoginFailure(pending.id);
    logSecurityEvent("auth.mfa.failed", { staffMode: pending.role !== "USER" });
    throw new MfaInvalid();
  }

  // A role change after the password step takes effect immediately. Promotion
  // never upgrades a pending ordinary login into Admin mode.
  const role: UserRole =
    pending.role !== "USER" && pending.role === pending.user.role
      ? pending.role as UserRole
      : "USER";
  return sessionUser(pending.user, role);
}

export async function authorizeCredentials(
  credentials: Partial<Record<CredentialFields, unknown>>,
  request: Request,
) {
  if (!isAuthConfigured()) return null;
  if (credentials.refreshToken !== undefined || credentials.deviceId !== undefined) {
    return authorizeRefresh(credentials);
  }
  if (credentials.pendingLoginId !== undefined || credentials.pendingLoginSecret !== undefined) {
    return authorizePendingLogin(credentials, request);
  }

  const email = typeof credentials.email === "string" ? credentials.email.trim().toLowerCase() : "";
  const password = typeof credentials.password === "string" ? credentials.password : "";
  const adminMode = credentials.adminMode === "true";
  const address = getClientAddress(
    request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for"),
  );
  const [addressLimit, accountLimit] = await Promise.all([
    checkRateLimitAsync(hashRateLimitIdentifier(`login-address:${address}`), LOGIN_ADDRESS_LIMIT, LOGIN_WINDOW_MS),
    checkRateLimitAsync(hashRateLimitIdentifier(`login-account:${address}:${email}`), LOGIN_ACCOUNT_LIMIT, LOGIN_WINDOW_MS),
  ]);
  if (!addressLimit.allowed || !accountLimit.allowed) throw new LoginRateLimited();

  // Delay rises before the hard block and remains bounded to avoid a cheap DoS vector.
  const delayMs = progressiveLoginDelayMs(accountLimit.attempts);
  if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));

  if (!EMAIL_PATTERN.test(email) || email.length > 254 || !password || Buffer.byteLength(password, "utf8") > 72) {
    if (Buffer.byteLength(password, "utf8") <= 72) await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
    return null;
  }

  let account: Awaited<ReturnType<typeof findAccountWithPasskeysByEmail>> = null;
  try {
    account = await findAccountWithPasskeysByEmail(email);
  } catch (error) {
    logServerError("auth.credentials.lookup_failed", error);
    await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
    return null;
  }

  // Always compare before reporting a failed admin lookup, including for unknown emails.
  const validPassword = await bcrypt.compare(password, account?.passwordHash ?? DUMMY_PASSWORD_HASH);
  const isStaffRole =
    account?.role === "FOUNDER" || account?.role === "ADMIN" || account?.role === "MANAGER";
  if (!account || !validPassword || account.isBlocked) return null;
  if (adminMode && !isStaffRole) return null;

  const hasTotp = Boolean(account.mfaSecret);
  const hasPasskeys = account.webAuthnCredentials.length > 0;
  const desiredRole: UserRole = adminMode && isStaffRole ? account.role : "USER";

  // Staff without MFA may still enter ordinary customer mode to enroll. Admin
  // mode deliberately receives only a USER session until enrollment completes.
  if (!hasTotp && !hasPasskeys) return sessionUser(account, "USER");
  const pending = await createPendingLogin(account.id, desiredRole);
  throw new MfaRequired(pending, { hasTotp, hasPasskeys });
}
