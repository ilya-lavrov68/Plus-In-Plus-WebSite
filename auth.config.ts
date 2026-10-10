import type { NextAuthConfig } from "next-auth";

import { getAuthSecret } from "@/lib/auth-secret";
import { localAvatarPath } from "@/lib/upload-policy";
import { profileName } from "@/lib/user-profile";

/** Edge-safe session decoding. Prisma and bcrypt are only imported by auth.ts. */
export const authConfig = {
  secret: getAuthSecret(),
  // Next.js runs behind our trusted reverse proxy (which must overwrite forwarded headers).
  trustHost: true,
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },
  pages: { signIn: "/?auth=login", error: "/?auth=login" },
  providers: [],
  callbacks: {
    session({ session, token }) {
      session.user.id = token.id;
      session.user.email = token.email;
      session.user.firstName = token.firstName ?? null;
      session.user.lastName = token.lastName ?? null;
      session.user.avatar = localAvatarPath(token.avatar);
      session.user.role = token.role === "ADMIN" ? "ADMIN" : "USER";
      session.user.name = profileName(session.user);
      session.user.image = session.user.avatar;
      return session;
    },
  },
} satisfies NextAuthConfig;
