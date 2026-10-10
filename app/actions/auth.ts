"use server";

import bcrypt from "bcryptjs";
import { AuthError, CredentialsSignin } from "next-auth";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { auth, signIn, signOut } from "@/auth";
import { recordActivity } from "@/lib/activity-log";
import { isAuthConfigured } from "@/lib/auth-secret";
import { prisma } from "@/lib/prisma";
import { getClientAddress, checkRateLimit, hashRateLimitIdentifier } from "@/lib/rate-limit";
import { cleanupUpload, saveImageUpload, UploadValidationError } from "@/lib/uploads";

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
  redirectTo?: "/admin/dashboard";
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

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WINDOW_MS = 10 * 60 * 1000;

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";
}

function validName(value: unknown, required: boolean): value is string {
  return typeof value === "string" && (!required || value.trim().length > 0) &&
    value.trim().length <= 80 && !/[\u0000-\u001f\u007f]/.test(value);
}

export async function loginUser(input: LoginSubmission): Promise<AuthActionResult> {
  if (!isAuthConfigured() || !prisma) {
    return { ok: false, success: false, error: "Login is unavailable right now. Try again later." };
  }
  const submission = readLoginSubmission(input);
  const email = submission.email.trim().toLowerCase();
  const password = submission.password;
  const adminMode = submission.adminMode === true;

  // Admin mode is a privilege opt-in, not a role mutation: it passes only for an
  // existing ADMIN row (registration always creates USER accounts).
  let account: { role: "USER" | "ADMIN" } | null;
  try {
    account = await prisma.user.findUnique({ where: { email }, select: { role: true } });
  } catch (error) {
    console.error("Login lookup failed:", error);
    return { ok: false, success: false, error: "Unable to log in. Try again later." };
  }
  if (adminMode && account?.role !== "ADMIN") {
    return { ok: false, success: false, error: "Admin account not found. Please log in as a regular user." };
  }

  try {
    await signIn("credentials", {
      email,
      password,
      adminMode: String(adminMode),
      redirect: false,
      redirectTo: adminMode ? "/admin/dashboard" : "/",
    });
  } catch (error) {
    if (error instanceof CredentialsSignin) {
      if (error.code === "admin_account_not_found") {
        return { ok: false, success: false, error: "Admin account not found. Please log in as a regular user." };
      }
      if (error.code === "rate_limited") {
        return { ok: false, success: false, error: "Too many login attempts. Try again later." };
      }
      return { ok: false, success: false, error: "Invalid email or password." };
    }
    if (error instanceof AuthError) return { ok: false, success: false, error: "Unable to log in. Try again later." };
    console.error("Login failed:", error);
    return { ok: false, success: false, error: "Unable to log in. Try again later." };
  }

  const isAdmin = adminMode && account?.role === "ADMIN";
  return isAdmin
    ? { ok: true, success: true, isAdmin: true, redirectTo: "/admin/dashboard" }
    : { ok: true, success: true, isAdmin: false };
}

/** Explicit allowlist: registration NEVER accepts a role, avatar path or user id. */
export async function registerUser(input: RegisterSubmission): Promise<RegisterResult> {
  const requestHeaders = await headers();
  const address = getClientAddress(requestHeaders.get("x-real-ip") ?? requestHeaders.get("x-forwarded-for"));
  if (!checkRateLimit(hashRateLimitIdentifier(`register-address:${address}`), 5, WINDOW_MS).allowed) {
    return { ok: false, success: false, error: "Too many registration attempts. Try again later." };
  }
  const submission = readRegisterSubmission(input);
  const email = submission.email.trim().toLowerCase();
  const password = submission.password;
  if (!validName(submission.firstName, true) || !validName(submission.lastName, true)) {
    return { ok: false, success: false, error: "Please enter your first and last name (up to 80 characters each)." };
  }
  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    return { ok: false, success: false, error: "Please enter a valid email address." };
  }
  if (password.length < 12) return { ok: false, success: false, error: "Password must be at least 12 characters long." };
  if (Buffer.byteLength(password, "utf8") > 72) return { ok: false, success: false, error: "Password must not exceed 72 UTF-8 bytes." };
  if (password !== submission.confirmPassword) return { ok: false, success: false, error: "Passwords do not match." };
  if (!prisma || !isAuthConfigured()) {
    return { ok: false, success: false, error: "Registration is unavailable right now. Try again later." };
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) return { ok: false, success: false, error: "Unable to create an account with these details." };
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email, passwordHash, firstName: submission.firstName.trim(), lastName: submission.lastName.trim(), role: "USER" },
        select: { id: true, email: true },
      });
      await recordActivity(tx, { action: "registered", entityType: "user", entityId: user.id, title: user.email, actorId: user.id });
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, success: false, error: "Unable to create an account with these details." };
    console.error("Registration failed:", error);
    return { ok: false, success: false, error: "Registration failed. Try again later." };
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin/dashboard");
  // A new account is always logged in in regular mode, independent of submitted extra fields.
  const login = await loginUser({ email, password, adminMode: false });
  return login.ok ? { ok: true, success: true, isAdmin: false } : {
    ok: false,
    success: false,
    accountCreated: true,
    error: "Your account was created. Please log in.",
  };
}

export async function updateUserProfile(formData: FormData): Promise<AuthActionResult> {
  if (!isAuthConfigured() || !prisma) return { ok: false, success: false, error: "Please log in to edit your profile." };
  let newAvatar: string | null = null;
  let saved = false;
  try {
    const session = await auth();
    if (!session?.user?.id) return { ok: false, success: false, error: "Please log in to edit your profile." };
    if (!checkRateLimit(hashRateLimitIdentifier(`profile:${session.user.id}`), 20, WINDOW_MS).allowed) {
      return { ok: false, success: false, error: "Too many profile updates. Try again later." };
    }
    const firstName = formData.get("firstName");
    const lastName = formData.get("lastName");
    if (!validName(firstName, false) || !validName(lastName, false)) {
      return { ok: false, success: false, error: "Names must be at most 80 characters and contain no control characters." };
    }
    const existing = await prisma.user.findUnique({
      where: { id: session.user.id }, select: { id: true, avatar: true, email: true },
    });
    if (!existing) return { ok: false, success: false, error: "Your account no longer exists. Please log in again." };
    const file = formData.get("avatar");
    if (typeof file === "string" && file) return { ok: false, success: false, error: "Please choose a local image file." };
    if (file instanceof File && file.name && file.size === 0) throw new UploadValidationError("Image must not be empty.");
    if (file instanceof File && file.size > 0) newAvatar = await saveImageUpload(file, "avatars");

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        // The id comes ONLY from the verified session, never from formData.
        where: { id: existing.id },
        data: { firstName: firstName.trim() || null, lastName: lastName.trim() || null, ...(newAvatar ? { avatar: newAvatar } : {}) },
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
    return { ok: false, success: false, error: "Unable to save your profile. Try again later." };
  }
  revalidatePath("/admin/users");
  revalidatePath("/admin/dashboard");
  return { ok: true, success: true };
}

export async function logout(): Promise<AuthActionResult> {
  try {
    await signOut({ redirect: false, redirectTo: "/" });
    return { ok: true, success: true };
  } catch (error) {
    console.error("Logout failed:", error);
    return { ok: false, success: false, error: "Unable to log out. Please try again." };
  }
}
