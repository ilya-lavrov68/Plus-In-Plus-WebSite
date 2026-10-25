import type { NextAuthConfig } from "next-auth";

import { getAuthSecret } from "@/lib/auth-secret";
import { ACCESS_SESSION_SECONDS } from "@/lib/session-policy";
import { localAvatarPath } from "@/lib/upload-policy";
import { profileName } from "@/lib/user-profile";

/** Edge-safe session decoding. Prisma and bcrypt are only imported by auth.ts. */
export const authConfig = {
  secret: getAuthSecret(),
  // Next.js runs behind our trusted reverse proxy (which must overwrite forwarded headers).
  trustHost: true,
  // Short access JWT only. The separate server-side refresh cookie rotates via
  // /api/auth/refresh; Auth.js must not silently slide this access token for days.
  session: { strategy: "jwt", maxAge: ACCESS_SESSION_SECONDS },
  pages: { signIn: "/?auth=login", error: "/?auth=login" },
  providers: [],
  callbacks: {
    session({ session, token }) {
      session.user.id = token.id;
      session.user.email = token.email;
      session.user.firstName = token.firstName ?? null;
      session.user.lastName = token.lastName ?? null;
      session.user.avatar = localAvatarPath(token.avatar);
      // Роль берётся только из токена, который подписан нами. Всё, что не
      // FOUNDER, не ADMIN и не MANAGER, сводится к USER.
      session.user.role =
        token.role === "FOUNDER" || token.role === "ADMIN" || token.role === "MANAGER"
          ? token.role
          : "USER";
      session.user.name = profileName(session.user);
      session.user.image = session.user.avatar;
      return session;
    },
  },
} satisfies NextAuthConfig;
