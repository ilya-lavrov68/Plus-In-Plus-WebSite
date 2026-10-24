import { createHash } from "node:crypto";

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { authConfig } from "@/auth.config";
import { isAuthConfigured } from "@/lib/auth-secret";
import { authorizeCredentials } from "@/lib/credentials";
import { prisma } from "@/lib/prisma";
import { localAvatarPath } from "@/lib/upload-policy";
import { profileName, userProfileSelect } from "@/lib/user-profile";

/** A revocable session marker without putting the bcrypt hash itself in the JWT. */
function passwordStamp(passwordHash: string): string {
  return createHash("sha256").update(passwordHash).digest("base64url");
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        adminMode: { label: "Admin mode", type: "text" },
      },
      authorize: authorizeCredentials,
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (!isAuthConfigured() || !prisma) return null;
      try {
        if (user) {
          // Credentials never leave authorize(), so obtain the current hash
          // server-side and retain only a one-way marker in the encrypted JWT.
          const account = await prisma.user.findUnique({
            where: { id: user.id },
            select: { passwordHash: true, isBlocked: true },
          });
          if (!account || account.isBlocked) return null;
          token.id = user.id;
          token.email = user.email;
          token.firstName = user.firstName;
          token.lastName = user.lastName;
          token.avatar = user.avatar;
          token.role = user.role;
          token.passwordStamp = passwordStamp(account.passwordHash);
        } else {
          if (!token.id || !token.passwordStamp) return null;
          const account = await prisma.user.findUnique({
            where: { id: token.id },
            select: { ...userProfileSelect, passwordHash: true },
          });
          if (!account || account.isBlocked) return null;
          // Every existing session is revoked by a password change/reset. This
          // also invalidates pre-marker tokens instead of trusting them forever.
          if (token.passwordStamp !== passwordStamp(account.passwordHash)) return null;
          token.email = account.email;
          token.firstName = account.firstName;
          token.lastName = account.lastName;
          token.avatar = localAvatarPath(account.avatar);
          // Never trust useSession().update(data), nor elevate an existing USER session
          // when somebody promotes its account in the DB. A new admin login is required.
          // Роль сохраняется только при точном совпадении токена и базы: любое
          // изменение роли в БД (повышение или понижение) требует нового входа.
          token.role =
            token.role === account.role &&
            (token.role === "FOUNDER" || token.role === "ADMIN" || token.role === "MANAGER")
              ? token.role
              : "USER";
        }
      } catch (error) {
        console.error("Session refresh failed:", error);
        return null;
      }
      token.name = profileName(token);
      token.picture = localAvatarPath(token.avatar);
      return token;
    },
  },
});
