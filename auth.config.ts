import type { NextAuthConfig } from "next-auth";

import { getAuthSecret } from "@/lib/auth-secret";
import { ACCESS_SESSION_SECONDS } from "@/lib/session-policy";
import { localAvatarPath } from "@/lib/upload-policy";
import { profileName } from "@/lib/user-profile";

function safeAuthLogCode(value: unknown): string {
  const code = String(value ?? "unknown");
  return /^[A-Za-z][A-Za-z0-9_.-]{0,79}$/.test(code) ? code : "unknown";
}

/** Edge-safe session decoding. Database and bcrypt are only imported by auth.ts. */
export const authConfig = {
  secret: getAuthSecret(),
  // Next.js runs behind our trusted reverse proxy (which must overwrite forwarded headers).
  trustHost: true,
  // Auth.js error details may contain decoded JWT profiles. Keep operational
  // codes, never tokens, email addresses, names, session IDs or error payloads.
  logger: {
    error(error) {
      const code = "code" in error ? error.code : undefined;
      const type = "type" in error ? error.type : undefined;
      console.error(`[auth] ${safeAuthLogCode(code ?? type ?? error.name)}`);
    },
    warn(code) {
      console.warn(`[auth] ${safeAuthLogCode(code)}`);
    },
    debug() {},
  },
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
