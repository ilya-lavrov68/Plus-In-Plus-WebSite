"use server";

import bcrypt from "bcryptjs";
import { AuthError, CredentialsSignin } from "next-auth";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { auth, signIn, signOut } from "@/auth";
import { getActionTranslator } from "@/lib/action-i18n";
import { recordActivity } from "@/lib/activity-log";
import { isAuthConfigured } from "@/lib/auth-secret";
import { prisma } from "@/lib/prisma";
import { getClientAddress, checkRateLimitAsync, hashRateLimitIdentifier } from "@/lib/rate-limit";
import { cleanupUpload, saveImageUpload, UploadValidationError } from "@/lib/uploads";
import { firstIssueMessage, loginSchema, profileSchema, registerSchema } from "@/lib/validators";

export interface LoginInput {
  email: string;
  password: string;
  /** Boolean form used by the typed client components. */
  adminMode?: boolean;
  /** String form ("true" / "false") used by plain FormData submissions. */
  isAdminMode?: string;
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
  redirectTo?: "/admin/dashboard" | "/manager/orders";
  accountCreated?: boolean;
  /** Effective privilege of the created session: ADMIN row + admin mode requested. */
  isAdmin?: boolean;
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
    return { email: readString(input.get("email")), password: readString(input.get("password")), adminMode: flag === "true" };
  }
  return {
    email: readString(input?.email),
    password: readString(input?.password),
    adminMode: input?.adminMode === true || input?.isAdminMode === "true",
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

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";
}

export async function loginUser(input: LoginSubmission): Promise<AuthActionResult> {
  const t = await getActionTranslator();
  if (!isAuthConfigured() || !prisma) {
    return { ok: false, success: false, error: t("loginUnavailable") };
  }
  const submission = readLoginSubmission(input);
  const credentials = loginSchema.safeParse({ email: submission.email, password: submission.password });
  if (!credentials.success) {
    // Never confirm which part of a credential pair was wrong.
    console.warn("Rejected malformed login input:", firstIssueMessage(credentials.error));
    return { ok: false, success: false, error: t("invalidCredentials") };
  }
  const { email, password } = credentials.data;
  const adminMode = submission.adminMode === true;

  // Admin mode is a privilege opt-in, not a role mutation: it passes only for an
  // existing staff row (FOUNDER, ADMIN or MANAGER — registration always
  // creates USER accounts).
  let account: { role: string } | null;
  try {
    account = await prisma.user.findUnique({ where: { email }, select: { role: true } });
  } catch (error) {
    console.error("Login lookup failed:", error);
    return { ok: false, success: false, error: t("unableToLogIn") };
  }
  const staffRole =
    account?.role === "FOUNDER" || account?.role === "ADMIN" || account?.role === "MANAGER"
      ? account.role
      : null;
  // The lookup only chooses a post-success destination. It must never short-circuit
  // Admin mode: Auth.js performs the same password and staff checks for every account.
  // Куда вести сотрудника после служебного входа: менеджеру — в его заявки,
  // администратору и основателю — в админку.
  const staffHome = staffRole === "MANAGER" ? "/manager/orders" : "/admin/dashboard";

  try {
    await signIn("credentials", {
      email,
      password,
      adminMode: String(adminMode),
      redirect: false,
      redirectTo: adminMode ? staffHome : "/",
    });
  } catch (error) {
    if (error instanceof CredentialsSignin) {
      if (error.code === "rate_limited") {
        return { ok: false, success: false, error: t("tooManyLoginAttempts") };
      }
      return { ok: false, success: false, error: t("invalidCredentials") };
    }
    if (error instanceof AuthError) return { ok: false, success: false, error: t("unableToLogIn") };
    console.error("Login failed:", error);
    return { ok: false, success: false, error: t("unableToLogIn") };
  }

  const isAdmin = adminMode && (staffRole === "FOUNDER" || staffRole === "ADMIN");
  return adminMode && staffRole
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
  if (!prisma || !isAuthConfigured()) {
    return { ok: false, success: false, error: t("registrationUnavailable") };
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) return { ok: false, success: false, error: t("registrationFailedWithDetails") };
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email, passwordHash, firstName, lastName, role: "USER" },
        select: { id: true, email: true },
      });
      await recordActivity(tx, { action: "registered", entityType: "user", entityId: user.id, title: user.email, actorId: user.id });
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, success: false, error: t("registrationFailedWithDetails") };
    console.error("Registration failed:", error);
    return { ok: false, success: false, error: t("registrationFailed") };
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin/dashboard");
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
  if (!isAuthConfigured() || !prisma) return { ok: false, success: false, error: t("loginToEditProfile") };
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
    const existing = await prisma.user.findUnique({
      where: { id: session.user.id }, select: { id: true, avatar: true, email: true },
    });
    if (!existing) return { ok: false, success: false, error: t("accountGone") };
    const file = formData.get("avatar");
    if (typeof file === "string" && file) return { ok: false, success: false, error: t("chooseLocalImage") };
    if (file instanceof File && file.name && file.size === 0) throw new UploadValidationError(t("emptyImage"));
    if (file instanceof File && file.size > 0) newAvatar = await saveImageUpload(file, "avatars");

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        // The id comes ONLY from the verified session, never from formData.
        where: { id: existing.id },
        data: { firstName: firstName || null, lastName: lastName || null, ...(newAvatar ? { avatar: newAvatar } : {}) },
        select: { id: true },
      });
      await recordActivity(tx, { action: "updated profile", entityType: "user", entityId: existing.id, title: existing.email, actorId: existing.id });
    });
    saved = true;
    if (newAvatar) await cleanupUpload(existing.avatar, "avatars");
  } catch (error) {
    if (newAvatar && !saved) await cleanupUpload(newAvatar, "avatars");
    if (error instanceof UploadValidationError) return { ok: false, success: false, error: error.message };
    console.error("Profile update failed:", error);
    return { ok: false, success: false, error: t("profileSaveFailed") };
  }
  revalidatePath("/admin/users");
  revalidatePath("/admin/dashboard");
  return { ok: true, success: true };
}

export async function logout(): Promise<AuthActionResult> {
  const t = await getActionTranslator();
  try {
    await signOut({ redirect: false, redirectTo: "/" });
    return { ok: true, success: true };
  } catch (error) {
    console.error("Logout failed:", error);
    return { ok: false, success: false, error: t("logoutFailed") };
  }
}
