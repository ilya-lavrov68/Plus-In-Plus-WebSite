"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";

import { getClientAddress, checkRateLimit, hashRateLimitIdentifier } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";

export interface RegisterInput {
  email: string;
  password: string;
}

export interface RegisterResult {
  ok: boolean;
  error?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 12;
const MAX_BCRYPT_PASSWORD_BYTES = 72;
const REGISTER_WINDOW_MS = 10 * 60 * 1000;

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";
}

/**
 * Registers a new USER account. The password is hashed with bcrypt before it
 * ever reaches the database. The caller performs the automatic login through
 * NextAuth after a successful registration.
 */
export async function registerUser(input: RegisterInput): Promise<RegisterResult> {
  const requestHeaders = await headers();
  const clientAddress = getClientAddress(
    requestHeaders.get("x-real-ip") ?? requestHeaders.get("x-forwarded-for"),
  );
  const addressKey = hashRateLimitIdentifier(`register-address:${clientAddress}`);
  if (!checkRateLimit(addressKey, 5, REGISTER_WINDOW_MS).allowed) {
    return { ok: false, error: "Too many registration attempts. Try again later." };
  }

  const email = typeof input?.email === "string" ? input.email.trim().toLowerCase() : "";
  const password = typeof input?.password === "string" ? input.password : "";

  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    return { ok: false, error: "Please enter a valid email address." };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.` };
  }
  if (Buffer.byteLength(password, "utf8") > MAX_BCRYPT_PASSWORD_BYTES) {
    return { ok: false, error: "Password must not exceed 72 UTF-8 bytes." };
  }
  if (!prisma) {
    return { ok: false, error: "Registration is unavailable right now. Try again later." };
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return { ok: false, error: "Unable to create an account with these details." };
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: "USER",
      },
    });

    return { ok: true };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: "Unable to create an account with these details." };
    }
    console.error("Failed to register user:", error);
    return { ok: false, error: "Registration failed. Try again later." };
  }
}
