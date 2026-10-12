"use client";

import { SessionProvider } from "next-auth/react";

import { PageViewTracker } from "@/components/site/page-view-tracker";
import { Toaster } from "@/components/ui/toast";

/**
 * Client providers for the App Router shell.
 *
 * `SessionProvider` makes `useSession()` (header avatar, account modal) work in
 * every client component. Sessions live in the DB, so the client cache is
 * revalidated on focus and every 5 minutes; offline revalidation is disabled.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus refetchInterval={300} refetchWhenOffline={false}>
      <PageViewTracker />
      {children}
      <Toaster />
    </SessionProvider>
  );
}
