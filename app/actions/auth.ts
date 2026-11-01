"use server";

import bcrypt from "bcryptjs";
import { AuthError, CredentialsSignin } from "next-auth";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { auth, signIn, signOut } from "@/auth";
import { getActionTranslator } from "@/lib/action-i18n";
import { isAuthConfigured } from "@/lib/auth-secret";
import { assertPasswordNotCompromised, CompromisedPasswordError } from "@/lib/password-breach";
import { readPendingLogin } from "@/lib/pending-login";
import { getPayloadClient, isPayloadUniqueError, type PayloadTransactionRequest, withPayloadTransaction } from "@/lib/payload-native";
import { getClientAddress, checkRateLimitAsync, hashRateLimitIdentifier } from "@/lib/rate-limit";
import { logSecurityEvent, logServerError } from "@/lib/security-log";
import { cleanupUpload, saveImageUpload, UploadValidationError } from "@/lib/uploads";
import { firstIssueMessage, loginSchema, profileSchema, registerSchema } from "@/lib/validators";
import type { Account } from "@/payload/payload-types";

export interface LoginInput {
  email?: string;
  password?: string;
  /** Boolean form used by the typed client components. */
  adminMode?: boolean;
  /** String form ("true" / "false") used by plain FormData submissions. */
  isAdminMode?: string;
  /** Second step: password was already verified and only this challenge remains. */
  pendingLoginId?: string;
  pendingLoginSecret?: string;
  mfaCode?: string;
  webAuthnResponse?: unknown;
}

export interface RegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface AuthActionResult {
  /** Canonical result flag of the account forms. */
  success: boolean;
  /** Alias of `success`, kept for callers written in earlier stages. */
  ok: boolean;
  error?: string;
  /** Служебный дом после входа: админка или рабочее место менеджера. */
  redirectTo?: "/admin" | "/admin/collections/orders" | "/profile?mfa=required";
  accountCreated?: boolean;
  /** Effective privilege of the created session: ADMIN row + admin mode requested. */
  isAdmin?: boolean;
  mfaRequired?: boolean;
  mfaSetupRequired?: boolean;
  pendingLoginId?: string;
  pendingLoginSecret?: string;
  hasTotp?: boolean;
  hasPasskeys?: boolean;
}

export type RegisterResult = AuthActionResult;

/** Server actions accept both a typed object (client components) and FormData. */
type LoginSubmission = LoginInput | FormData | undefined;
type RegisterSubmission = RegisterInput | FormData | undefined;

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isFormData(value: unknown): value is FormData {
  return typeof FormData !== "undefined" && value instanceof FormData;
}

function readLoginSubmission(input: LoginSubmission): LoginInput {
  if (isFormData(input)) {
    const flag = readString(input.get("isAdminMode")) || readString(input.get("adminMode"));
    return {
      email: readString(input.get("email")),
      password: readString(input.get("password")),
      adminMode: flag === "true",
      pendingLoginId: readString(input.get("pendingLoginId")),
      pendingLoginSecret: readString(input.get("pendingLoginSecret")),
      mfaCode: readString(input.get("mfaCode")),
    };
  }
  return {
    email: readString(input?.email),
    password: readString(input?.password),
    adminMode: input?.adminMode === true || input?.isAdminMode === "true",
    pendingLoginId: readString(input?.pendingLoginId),
    pendingLoginSecret: readString(input?.pendingLoginSecret),
    mfaCode: readString(input?.mfaCode),
    webAuthnResponse: input?.webAuthnResponse,
  };
}

function readRegisterSubmission(input: RegisterSubmission): RegisterInput {
  if (isFormData(input)) {
    const password = readString(input.get("password"));
    return {
      firstName: readString(input.get("firstName")),
      lastName: readString(input.get("lastName")),
      email: readString(input.get("email")),
      password,
      // The confirm field is optional here: an absent value means "already confirmed".
      confirmPassword: readString(input.get("confirmPassword")) || password,
    };
  }
  return {
    firstName: readString(input?.firstName),
    lastName: readString(input?.lastName),
    email: readString(input?.email),
    password: readString(input?.password),
    confirmPassword: readString(input?.confirmPassword),
  };
}

const WINDOW_MS = 10 * 60 * 1000;

async function recordAuthActivity(action: "login" | "staff login" | "logout", userId: string): Promise<void> {
  try {
    const payload = await getPayloadClient();
    await payload.create({
      collection: "activity-logs",
      data: { action, entityType: "user", entityId: userId, title: "User account", actorId: userId },
      overrideAccess: true,
    });
  } catch (error) {
    logServerError("auth.audit.write_failed", error);
  }
}

async function writeAuthActivity(payload: Awaited<ReturnType<typeof getPayloadClient>>, req: PayloadTransactionRequest, action: string, userId: string): Promise<void> {
  await payload.create({
    collection: "activity-logs",
    data: { action, entityType: "user", entityId: userId, title: "User account", actorId: userId },
    overrideAccess: true,
    req,
  });
}

export async function loginUser(input: LoginSubmission): Promise<AuthActionResult> {
  const t = await getActionTranslator();
  if (!isAuthConfigured()) {
    return { ok: false, success: false, error: t("loginUnavailable") };
  }
  const submission = readLoginSubmission(input);
  const adminMode = submission.adminMode === true;
  const pendingStep = Boolean(submission.pendingLoginId || submission.pendingLoginSecret);
  let pending: Awaited<ReturnType<typeof readPendingLogin>> = null;
  let account: {
    id: string;
    role: string;
    mfaSecret?: string | null;
    webAuthnCredentials?: { id: string }[];
  } | null = null;
  let email = "";
  let password = "";

  try {
    if (pendingStep) {
      pending = await readPendingLogin(submission.pendingLoginId, submission.pendingLoginSecret);
      if (!pending) return { ok: false, success: false, error: t("invalidCredentials") };
      account = pending.user;
    } else {
      const credentials = loginSchema.safeParse({ email: submission.email, password: submission.password });
      if (!credentials.success) {
        logSecurityEvent("auth.login.malformed", { staffMode: adminMode });
        return { ok: false, success: false, error: t("invalidCredentials") };
      }
      email = credentials.data.email;
      password = credentials.data.password;
      // This lookup only selects a destination and never replaces Auth.js verification.
      const payload = await getPayloadClient();
      const result = await payload.find({
        collection: "accounts",
        depth: 0,
        limit: 1,
        overrideAccess: true,
        showHiddenFields: true,
        where: { email: { equals: email } },
      });
      const found = result.docs[0] as Account | undefined;
      const passkeys = found
        ? await payload.find({ collection: "webauthn-credentials", depth: 0, limit: 1, overrideAccess: true, where: { userId: { equals: found.id } } })
        : { docs: [] };
      account = found ? { ...found, webAuthnCredentials: passkeys.docs } : null;
    }
  } catch (error) {
    logServerError("auth.login.lookup_failed", error);
    return { ok: false, success: false, error: t("unableToLogIn") };
  }

  const staffRole =
    account?.role === "FOUNDER" || account?.role === "ADMIN" || account?.role === "MANAGER"
      ? account.role
      : null;
  const staffHome = staffRole === "MANAGER" ? "/admin/collections/orders" : "/admin";

  try {
    await signIn("credentials", pendingStep ? {
      pendingLoginId: submission.pendingLoginId,
      pendingLoginSecret: submission.pendingLoginSecret,
      mfaCode: submission.mfaCode,
      // Auth.js credentials are sent as URLSearchParams. Passing the assertion
      // object directly turns it into "[object Object]" before authorize() runs.
      // Keep the browser response intact as JSON and decode it at the credentials
      // boundary, where its size and shape are checked before WebAuthn verification.
      ...(submission.webAuthnResponse === undefined ? {} : {
        webAuthnResponse: JSON.stringify(submission.webAuthnResponse),
      }),
      redirect: false,
      redirectTo: staffRole && pending?.role !== "USER" ? staffHome : "/",
    } : {
      email,
      password,
      adminMode: String(adminMode),
      redirect: false,
      redirectTo: adminMode ? staffHome : "/",
    });
  } catch (error) {
    if (error instanceof CredentialsSignin) {
      if (error.code === "rate_limited") {
        logSecurityEvent("auth.login.rate_limited", { staffMode: adminMode });
        return { ok: false, success: false, error: t("tooManyLoginAttempts") };
      }
      if (error.code === "mfa_required") {
        const challenge = error as CredentialsSignin & {
          pendingLoginId?: unknown;
          pendingLoginSecret?: unknown;
          hasTotp?: unknown;
          hasPasskeys?: unknown;
        };
        if (typeof challenge.pendingLoginId === "string" && typeof challenge.pendingLoginSecret === "string") {
          return {
            ok: false,
            success: false,
            mfaRequired: true,
            pendingLoginId: challenge.pendingLoginId,
            pendingLoginSecret: challenge.pendingLoginSecret,
            hasTotp: challenge.hasTotp === true,
            hasPasskeys: challenge.hasPasskeys === true,
          };
        }
      }
      if (error.code === "mfa_invalid" && pending) {
        return {
          ok: false,
          success: false,
          error: t("invalidMfaCode"),
          mfaRequired: true,
          pendingLoginId: submission.pendingLoginId,
          pendingLoginSecret: submission.pendingLoginSecret,
          hasTotp: Boolean(pending.user.mfaSecret),
          hasPasskeys: pending.user.webAuthnCredentials.length > 0,
        };
      }
      logSecurityEvent("auth.login.failed", { staffMode: adminMode });
      return { ok: false, success: false, error: t("invalidCredentials") };
    }
    if (error instanceof AuthError) return { ok: false, success: false, error: t("unableToLogIn") };
    logServerError("auth.login.failed", error);
    return { ok: false, success: false, error: t("unableToLogIn") };
  }

  if (!account) return { ok: false, success: false, error: t("unableToLogIn") };
  const hasMfa = Boolean(account.mfaSecret || account.webAuthnCredentials?.length);
  const mfaSetupRequired = !pendingStep && adminMode && Boolean(staffRole) && !hasMfa;
  const effectiveStaffRole = pendingStep
    ? pending?.role !== "USER" && pending?.role === account.role ? staffRole : null
    : !mfaSetupRequired && adminMode ? staffRole : null;
  await recordAuthActivity(effectiveStaffRole ? "staff login" : "login", account.id);
  const isAdmin = effectiveStaffRole === "FOUNDER" || effectiveStaffRole === "ADMIN";
  if (mfaSetupRequired) {
    return { ok: true, success: true, isAdmin: false, mfaSetupRequired: true, redirectTo: "/profile?mfa=required" };
  }
  return effectiveStaffRole
    ? { ok: true, success: true, isAdmin, redirectTo: staffHome }
    : { ok: true, success: true, isAdmin: false };
}

/** Explicit allowlist: registration NEVER accepts a role, avatar path or user id. */
export async function registerUser(input: RegisterSubmission): Promise<RegisterResult> {
  const t = await getActionTranslator();
  const requestHeaders = await headers();
  const address = getClientAddress(requestHeaders.get("x-real-ip") ?? requestHeaders.get("x-forwarded-for"));
  if (!(await checkRateLimitAsync(hashRateLimitIdentifier(`register-address:${address}`), 5, WINDOW_MS)).allowed) {
    return { ok: false, success: false, error: t("tooManyRegistrationAttempts") };
  }
  const submitted = readRegisterSubmission(input);
  const result = registerSchema.safeParse(submitted);
  if (!result.success) {
    return { ok: false, success: false, error: t(firstIssueMessage(result.error)) };
  }
  // Only the allowlisted fields survive validation.
  const { email, password, firstName, lastName } = result.data;
  if (!isAuthConfigured()) {
    return { ok: false, success: false, error: t("registrationUnavailable") };
  }

  try {
    const payload = await getPayloadClient();
    const existing = await payload.find({ collection: "accounts", depth: 0, limit: 1, overrideAccess: true, where: { email: { equals: email } } });
    if (existing.docs.length) return { ok: false, success: false, error: t("registrationFailedWithDetails") };
    await assertPasswordNotCompromised(password);
    const passwordHash = await bcrypt.hash(password, 12);
    await withPayloadTransaction(payload, async (req) => {
      const user = await payload.create({
        collection: "accounts",
        data: { email, passwordHash, firstName, lastName, role: "USER" },
        overrideAccess: true,
        req,
      });
      await writeAuthActivity(payload, req, "registered", user.id);
    });
  } catch (error) {
    if (error instanceof CompromisedPasswordError) {
      return {
        ok: false,
        success: false,
        error: t(error.code === "compromised" ? "validation.passwordCompromised" : "validation.passwordBreachUnavailable"),
      };
    }
    if (isPayloadUniqueError(error)) return { ok: false, success: false, error: t("registrationFailedWithDetails") };
    logServerError("auth.registration.failed", error);
    return { ok: false, success: false, error: t("registrationFailed") };
  }

  revalidatePath("/admin/collections/accounts");
  revalidatePath("/admin");
  // A new account is always logged in in regular mode, independent of submitted extra fields.
  const login = await loginUser({ email, password, adminMode: false });
  return login.ok ? { ok: true, success: true, isAdmin: false } : {
    ok: false,
    success: false,
    accountCreated: true,
    error: t("accountCreatedPleaseLogIn"),
  };
}

export async function updateUserProfile(formData: FormData): Promise<AuthActionResult> {
  const t = await getActionTranslator();
  if (!isAuthConfigured()) return { ok: false, success: false, error: t("loginToEditProfile") };
  let newAvatar: string | null = null;
  let saved = false;
  try {
    const session = await auth();
    if (!session?.user?.id) return { ok: false, success: false, error: t("loginToEditProfile") };
    if (!(await checkRateLimitAsync(hashRateLimitIdentifier(`profile:${session.user.id}`), 20, WINDOW_MS)).allowed) {
      return { ok: false, success: false, error: t("tooManyProfileUpdates") };
    }
    const profile = profileSchema.safeParse({
      firstName: readString(formData.get("firstName")),
      lastName: readString(formData.get("lastName")),
    });
    if (!profile.success) return { ok: false, success: false, error: t(firstIssueMessage(profile.error)) };
    const { firstName, lastName } = profile.data;
    const payload = await getPayloadClient();
    const existingResult = await payload.find({ collection: "accounts", depth: 0, limit: 1, overrideAccess: true, where: { id: { equals: session.user.id } } });
    const existing = existingResult.docs[0];
    if (!existing) return { ok: false, success: false, error: t("accountGone") };
    const file = formData.get("avatar");
    if (typeof file === "string" && file) return { ok: false, success: false, error: t("chooseLocalImage") };
    if (file instanceof File && file.name && file.size === 0) throw new UploadValidationError(t("emptyImage"));
    if (file instanceof File && file.size > 0) newAvatar = await saveImageUpload(file, "avatars");

    await withPayloadTransaction(payload, async (req) => {
      await payload.update({
        collection: "accounts",
        id: existing.id,
        data: { firstName: firstName || null, lastName: lastName || null, ...(newAvatar ? { avatar: newAvatar } : {}) },
        overrideAccess: true,
        req,
      });
      await writeAuthActivity(payload, req, "updated profile", existing.id);
    });
    saved = true;
    if (newAvatar) await cleanupUpload(existing.avatar ?? null, "avatars");
  } catch (error) {
    if (newAvatar && !saved) await cleanupUpload(newAvatar, "avatars");
    if (error instanceof UploadValidationError) return { ok: false, success: false, error: error.message };
    logServerError("auth.profile.update_failed", error);
    return { ok: false, success: false, error: t("profileSaveFailed") };
  }
  revalidatePath("/admin/collections/accounts");
  revalidatePath("/admin");
  return { ok: true, success: true };
}

export async function logout(): Promise<AuthActionResult> {
  const t = await getActionTranslator();
  let actorId: string | null = null;
  try {
    actorId = (await auth())?.user?.id ?? null;
  } catch (error) {
    // Logout must remain available even if a best-effort audit lookup fails.
    logServerError("auth.logout.session_lookup_failed", error);
  }
  try {
    await signOut({ redirect: false, redirectTo: "/" });
    if (actorId) await recordAuthActivity("logout", actorId);
    return { ok: true, success: true };
  } catch (error) {
    logServerError("auth.logout.failed", error);
    return { ok: false, success: false, error: t("logoutFailed") };
  }
}
