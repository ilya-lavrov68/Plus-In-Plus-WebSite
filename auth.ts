import { createHash } from "node:crypto";

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { authConfig } from "@/auth.config";
import { isAuthConfigured } from "@/lib/auth-secret";
import {
  authSessionIsActive,
  clearRefreshCookies,
  createAuthSession,
  downgradeAuthSession,
} from "@/lib/auth-sessions";
import { authorizeCredentials } from "@/lib/credentials";
import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/security-log";
import { localAvatarPath } from "@/lib/upload-policy";
import { normalizeRole, profileName, userProfileSelect } from "@/lib/user-profile";

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
        pendingLoginId: { label: "Pending login", type: "text" },
        pendingLoginSecret: { label: "Pending login secret", type: "text" },
        mfaCode: { label: "MFA code", type: "text" },
        webAuthnResponse: { label: "WebAuthn response", type: "text" },
        refreshToken: { label: "Refresh token", type: "text" },
        deviceId: { label: "Device", type: "text" },
      },
      authorize: authorizeCredentials,
    }),
  ],
  events: {
    async signOut(message) {
      try {
        const token = "token" in message ? message.token : null;
        if (prisma && token?.sessionId) {
          await prisma.authSession.updateMany({
            where: { id: token.sessionId, revokedAt: null },
            data: { revokedAt: new Date(), revokeReason: "logout" },
          });
        }
        await clearRefreshCookies();
      } catch (error) {
        logServerError("auth.logout.failed", error);
      }
    },
  },
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (!isAuthConfigured() || !prisma) return null;
      try {
        if (user) {
          const account = await prisma.user.findUnique({
            where: { id: user.id },
            select: { ...userProfileSelect, passwordHash: true },
          });
          if (!account || account.isBlocked) return null;

          const requestedRole = normalizeRole(user.role);
          token.id = account.id;
          token.email = account.email;
          token.firstName = account.firstName;
          token.lastName = account.lastName;
          token.avatar = localAvatarPath(account.avatar);
          // Staff mode survives refresh only while the DB still has exactly the
          // same staff role. Promotion never elevates an existing USER session.
          token.role = requestedRole !== "USER" && requestedRole === account.role
            ? requestedRole
            : "USER";
          token.passwordStamp = passwordStamp(account.passwordHash);

          const refreshed = user as typeof user & {
            sessionId?: string;
            deviceHash?: string;
            refreshEstablished?: boolean;
          };
          if (refreshed.refreshEstablished && refreshed.sessionId && refreshed.deviceHash) {
            if (!(await authSessionIsActive(refreshed.sessionId, refreshed.deviceHash))) return null;
            if (requestedRole !== "USER" && token.role === "USER") {
              await downgradeAuthSession(refreshed.sessionId, refreshed.deviceHash);
            }
            token.sessionId = refreshed.sessionId;
            token.deviceHash = refreshed.deviceHash;
          } else {
            const established = await createAuthSession(account.id, token.role);
            token.sessionId = established.sessionId;
            token.deviceHash = established.deviceHash;
          }
        } else {
          if (!token.id || !token.passwordStamp || !token.sessionId || !token.deviceHash) return null;
          const [account, activeSession] = await Promise.all([
            prisma.user.findUnique({
              where: { id: token.id },
              select: { ...userProfileSelect, passwordHash: true },
            }),
            authSessionIsActive(token.sessionId, token.deviceHash),
          ]);
          if (!account || account.isBlocked || !activeSession) return null;
          // Password reset and server-side session revocation are both immediate.
          if (token.passwordStamp !== passwordStamp(account.passwordHash)) return null;
          token.email = account.email;
          token.firstName = account.firstName;
          token.lastName = account.lastName;
          token.avatar = localAvatarPath(account.avatar);
          const hadStaffRole = token.role === "FOUNDER" || token.role === "ADMIN" || token.role === "MANAGER";
          token.role =
            token.role === account.role &&
            (token.role === "FOUNDER" || token.role === "ADMIN" || token.role === "MANAGER")
              ? token.role
              : "USER";
          if (hadStaffRole && token.role === "USER") {
            await downgradeAuthSession(token.sessionId, token.deviceHash);
          }
        }
      } catch (error) {
        logServerError("auth.session.refresh_failed", error);
        return null;
      }
      token.name = profileName(token);
      token.picture = localAvatarPath(token.avatar);
      return token;
    },
  },
});
