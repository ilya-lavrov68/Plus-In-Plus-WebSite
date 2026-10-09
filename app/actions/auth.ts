"use server";

import bcrypt from "bcryptjs";

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
const MIN_PASSWORD_LENGTH = 8;

/**
 * Registers a new USER account. The password is hashed with bcrypt before it
 * ever reaches the database. The caller performs the automatic login through
 * NextAuth after a successful registration.
 */
export async function registerUser(input: RegisterInput): Promise<RegisterResult> {
  const email = (input.email || "").trim().toLowerCase();
  const password = input.password || "";

  if (!EMAIL_PATTERN.test(email)) {
    return { ok: false, error: "Please enter a valid email address." };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.` };
  }
  if (!prisma) {
    return { ok: false, error: "Registration is unavailable right now. Try again later." };
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return { ok: false, error: "An account with this email already exists." };
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: "USER",
      },
    });

    return { ok: true };
  } catch (error) {
    console.error("Failed to register user:", error);
    return { ok: false, error: "Registration failed. Try again later." };
  }
}
