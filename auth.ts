import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import {
  checkRateLimit,
  getClientAddress,
  hashRateLimitIdentifier,
} from "@/lib/rate-limit";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const DUMMY_PASSWORD_HASH = "$2b$12$qnL7tEhdPNWWPbkgx8fMpe5U3xM1IRqTjZma3qx4rlEztpzpV21QO";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const email =
          typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        const forwardedAddress =
          request.headers?.["x-real-ip"] ?? request.headers?.["x-forwarded-for"];
        const clientAddress = getClientAddress(forwardedAddress);
        const addressKey = hashRateLimitIdentifier(`login-address:${clientAddress}`);
        const accountKey = hashRateLimitIdentifier(`login-account:${clientAddress}:${email}`);

        const addressLimit = checkRateLimit(addressKey, 30, LOGIN_WINDOW_MS);
        const accountLimit = checkRateLimit(accountKey, 8, LOGIN_WINDOW_MS);
        if (!addressLimit.allowed || !accountLimit.allowed) return null;

        if (
          !EMAIL_PATTERN.test(email) ||
          email.length > 254 ||
          !password ||
          Buffer.byteLength(password, "utf8") > 72 ||
          !prisma
        ) {
          if (Buffer.byteLength(password, "utf8") <= 72) {
            await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
          }
          return null;
        }

        let user;
        try {
          user = await prisma.user.findUnique({ where: { email } });
        } catch (error) {
          console.error("Credential lookup failed:", error);
          await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
          return null;
        }

        const passwordValid = await bcrypt.compare(
          password,
          user?.passwordHash ?? DUMMY_PASSWORD_HASH,
        );
        if (!user || !passwordValid) return null;

        return {
          id: user.id,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.email = token.email;
        session.user.role = token.role;
      }
      return session;
    },
  },
};
