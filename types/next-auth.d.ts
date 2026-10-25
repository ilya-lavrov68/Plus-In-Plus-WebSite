import type { DefaultSession } from "next-auth";
import type { UserProfile, UserRole } from "@/lib/user-profile";
import "@auth/core/jwt";

declare module "next-auth" {
  interface Session {
    user: UserProfile & DefaultSession["user"];
  }

  interface User extends UserProfile {
    id: string;
    email: string;
    /** Set only by the trusted refresh authorize branch, never by the browser form. */
    sessionId?: string;
    deviceHash?: string;
    refreshEstablished?: boolean;
  }
}

// Auth.js v5 defines the JWT in @auth/core; next-auth/jwt re-exports this type.
declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    avatar: string | null;
    role: UserRole;
    /** SHA-256 marker of the bcrypt hash; never the hash or password itself. */
    passwordStamp?: string;
    /** Server-side refresh-session binding; never serialized into Session.user. */
    sessionId?: string;
    deviceHash?: string;
  }
}
