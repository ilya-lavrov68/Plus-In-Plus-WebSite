import type { DefaultSession } from "next-auth";

/**
 * Session carries id, email and role for every authenticated user.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      role: "USER" | "ADMIN";
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    email: string;
    role: "USER" | "ADMIN";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    email: string;
    role: "USER" | "ADMIN";
  }
}
