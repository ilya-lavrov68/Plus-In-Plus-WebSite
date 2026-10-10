import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { authConfig } from "@/auth.config";
import { isAuthConfigured } from "@/lib/auth-secret";
import { authorizeCredentials } from "@/lib/credentials";
import { prisma } from "@/lib/prisma";
import { localAvatarPath } from "@/lib/upload-policy";
import { profileName, userProfileSelect } from "@/lib/user-profile";

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
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.firstName = user.firstName;
        token.lastName = user.lastName;
        token.avatar = user.avatar;
        token.role = user.role;
      } else {
        if (!token.id) return null;
        try {
          const account = await prisma.user.findUnique({
            where: { id: token.id },
            select: userProfileSelect,
          });
          if (!account) return null;
          token.email = account.email;
          token.firstName = account.firstName;
          token.lastName = account.lastName;
          token.avatar = localAvatarPath(account.avatar);
          // Never trust useSession().update(data), nor elevate an existing USER session
          // when somebody promotes its account in the DB. A new admin login is required.
          token.role = token.role === "ADMIN" && account.role === "ADMIN" ? "ADMIN" : "USER";
        } catch (error) {
          console.error("Session refresh failed:", error);
          return null;
        }
      }
      token.name = profileName(token);
      token.picture = localAvatarPath(token.avatar);
      return token;
    },
  },
});
