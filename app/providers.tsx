"use client";

import { MotionConfig } from "motion/react";
import { SessionProvider } from "next-auth/react";

import { PageViewTracker } from "@/components/site/page-view-tracker";
import { ScrollExperience } from "@/components/site/motion/scroll-experience";
import { SessionRefresh } from "@/components/site/session-refresh";
import { Toaster } from "@/components/ui/toast";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider
      refetchOnWindowFocus
      refetchInterval={300}
      refetchWhenOffline={false}
    >
      <MotionConfig reducedMotion="user">
        <ScrollExperience />
        <PageViewTracker />
        <SessionRefresh />
        {children}
        <Toaster />
      </MotionConfig>
    </SessionProvider>
  );
}
